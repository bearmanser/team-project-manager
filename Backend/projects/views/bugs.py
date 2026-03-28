from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from accounts.auth import jwt_required
from accounts.github import GitHubAPIError, get_github_issue, get_github_repository_issues

from ..constants import BUG_STATUS_LABELS, PRIORITY_LABELS
from ..models import BugComment, BugCommentReaction, BugReport, GitHubIssueLink, Project, ProjectMembership, ProjectRepository, Task
from ..serializers import build_project_snapshot, serialize_github_issue_candidate
from ..services import (
    can_edit_bug,
    close_bugs_from_resolution_task,
    ensure_issue_repo_allowed,
    get_project_github_access_token,
    load_project,
    notify_mentions,
    parse_issue_reference,
    record_activity,
    refresh_issue_details,
    role_at_least,
)
from ..utils import json_error, parse_comment_anchor, parse_comment_reaction, parse_json_body


def _project_response(project: Project, user, membership: ProjectMembership, status: int = 200) -> JsonResponse:
    return JsonResponse({"project": build_project_snapshot(project, user, membership)}, status=status)


@require_GET
@jwt_required
def project_github_issues_view(request, project_id: int):
    project, membership, error = load_project(project_id, request.user)
    if error:
        return error
    if not role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return json_error("Only project members can import GitHub issues as bugs.", 403)

    repositories = list(ProjectRepository.objects.filter(project=project).order_by("full_name", "id"))
    if not repositories:
        return JsonResponse({"issues": []})

    access_token = get_project_github_access_token(project, request.user)
    if not access_token:
        return json_error("Connect GitHub before importing issues.")

    imported_issue_keys = set(
        GitHubIssueLink.objects.filter(project=project, bug_report__isnull=False).values_list(
            "repository_full_name", "issue_number"
        )
    )
    seen_issue_keys = set()
    issues = []
    for repository in repositories:
        try:
            repository_issues = get_github_repository_issues(access_token, repository.full_name)
        except GitHubAPIError as exc:
            return json_error(str(exc), exc.status_code)

        for issue in repository_issues:
            if issue.get("pull_request"):
                continue

            issue_number = issue.get("number")
            if not isinstance(issue_number, int):
                continue

            issue_key = (repository.full_name, issue_number)
            if issue_key in imported_issue_keys or issue_key in seen_issue_keys:
                continue

            seen_issue_keys.add(issue_key)
            issues.append(serialize_github_issue_candidate(repository, issue))

    issues.sort(key=lambda item: item["updatedAt"], reverse=True)
    return JsonResponse({"issues": issues})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_bug_import_view(request, project_id: int):
    project, membership, error = load_project(project_id, request.user)
    if error:
        return error
    if not role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return json_error("Only project members can import GitHub issues as bugs.", 403)
    if not ProjectRepository.objects.filter(project=project).exists():
        return json_error("Connect a GitHub repository before importing issues.")

    try:
        payload = parse_json_body(request)
        repository_full_name, issue_number, issue_url, fallback_title, fallback_state = parse_issue_reference(payload)
        ensure_issue_repo_allowed(project, repository_full_name)
    except ValueError as exc:
        return json_error(str(exc))

    existing_link = (
        GitHubIssueLink.objects.filter(
            project=project,
            bug_report__isnull=False,
            repository_full_name=repository_full_name,
            issue_number=issue_number,
        )
        .select_related("bug_report")
        .first()
    )
    if existing_link is not None:
        return json_error(
            f"That GitHub issue is already imported as bug \"{existing_link.bug_report.title}\".",
            409,
        )

    access_token = get_project_github_access_token(project, request.user)
    if not access_token:
        return json_error("Connect GitHub before importing issues.")

    try:
        issue = get_github_issue(access_token, repository_full_name, issue_number)
    except GitHubAPIError as exc:
        return json_error(str(exc), exc.status_code)

    if issue.get("pull_request"):
        return json_error("Pull requests cannot be imported as bug reports.")

    status = (payload.get("status") or BugReport.STATUS_OPEN).strip() or BugReport.STATUS_OPEN
    priority = (payload.get("priority") or BugReport.PRIORITY_MEDIUM).strip() or BugReport.PRIORITY_MEDIUM
    if status not in dict(BugReport.STATUS_CHOICES):
        return json_error("Choose a valid bug report status.")
    if priority not in dict(BugReport.PRIORITY_CHOICES):
        return json_error("Choose a valid bug report priority.")

    title = (issue.get("title") or fallback_title or f"Issue #{issue_number}").strip()
    description = (payload.get("description") or "").strip() or (issue.get("body") or "").strip()
    issue_url = issue.get("html_url") or issue_url
    issue_state = (issue.get("state") or fallback_state or "open").strip() or "open"

    bug_report = BugReport.objects.create(
        project=project,
        title=title,
        description=description,
        reporter=request.user,
        status=status,
        priority=priority,
    )
    GitHubIssueLink.objects.create(
        project=project,
        bug_report=bug_report,
        repository_full_name=repository_full_name,
        issue_number=issue_number,
        title=title,
        html_url=issue_url,
        state=issue_state,
        created_by=request.user,
    )
    record_activity(
        project,
        request.user,
        "bug.imported_from_github",
        f"Imported GitHub issue {repository_full_name}#{issue_number} as bug \"{bug_report.title}\".",
        bug_report=bug_report,
        metadata={
            "repositoryFullName": repository_full_name,
            "issueNumber": issue_number,
            "issueUrl": issue_url,
        },
    )
    return _project_response(project, request.user, membership, status=201)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_bugs_view(request, project_id: int):
    project, membership, error = load_project(project_id, request.user)
    if error:
        return error
    if not role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return json_error("Only project members can create bug reports.", 403)

    try:
        payload = parse_json_body(request)
    except ValueError as exc:
        return json_error(str(exc))

    title = (payload.get("title") or "").strip()
    description = (payload.get("description") or "").strip()
    status = (payload.get("status") or BugReport.STATUS_OPEN).strip() or BugReport.STATUS_OPEN
    priority = (payload.get("priority") or BugReport.PRIORITY_MEDIUM).strip() or BugReport.PRIORITY_MEDIUM
    if not title:
        return json_error("Bug report title is required.")
    if status not in dict(BugReport.STATUS_CHOICES):
        return json_error("Choose a valid bug report status.")
    if priority not in dict(BugReport.PRIORITY_CHOICES):
        return json_error("Choose a valid bug report priority.")

    bug_report = BugReport.objects.create(
        project=project,
        title=title,
        description=description,
        reporter=request.user,
        status=status,
        priority=priority,
    )
    record_activity(
        project,
        request.user,
        "bug.created",
        f"Reported bug \"{bug_report.title}\".",
        bug_report=bug_report,
    )
    notify_mentions(
        project,
        request.user,
        description,
        bug_report=bug_report,
        context_label=f"bug report \"{bug_report.title}\"",
    )
    return _project_response(project, request.user, membership, status=201)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def bug_update_view(request, bug_id: int):
    bug_report = BugReport.objects.filter(id=bug_id).select_related("project", "reporter", "resolution_task").first()
    if bug_report is None:
        return json_error("Bug report not found.", 404)

    project, membership, error = load_project(bug_report.project_id, request.user)
    if error:
        return error
    if not can_edit_bug(membership, bug_report, request.user):
        return json_error("You do not have permission to update this bug report.", 403)

    try:
        payload = parse_json_body(request)
    except ValueError as exc:
        return json_error(str(exc))

    changed = []
    if "title" in payload:
        title = (payload.get("title") or "").strip()
        if not title:
            return json_error("Bug report title is required.")
        if title != bug_report.title:
            bug_report.title = title
            changed.append("title")
    if "description" in payload:
        description = (payload.get("description") or "").strip()
        if description != bug_report.description:
            bug_report.description = description
            changed.append("description")
            notify_mentions(
                project,
                request.user,
                description,
                bug_report=bug_report,
                context_label=f"bug report \"{bug_report.title}\"",
            )
    if "status" in payload:
        status = (payload.get("status") or "").strip()
        if status not in dict(BugReport.STATUS_CHOICES):
            return json_error("Choose a valid bug report status.")
        if status != bug_report.status:
            previous_label = BUG_STATUS_LABELS.get(bug_report.status, bug_report.status)
            next_label = BUG_STATUS_LABELS.get(status, status)
            bug_report.status = status
            changed.append("status")
            if status == BugReport.STATUS_CLOSED and not bug_report.closed_at:
                bug_report.closed_at = timezone.now()
            elif status != BugReport.STATUS_CLOSED:
                bug_report.closed_at = None
            record_activity(
                project,
                request.user,
                "bug.status_changed",
                f"Changed bug \"{bug_report.title}\" from {previous_label} to {next_label}.",
                bug_report=bug_report,
            )
    if "priority" in payload:
        priority = (payload.get("priority") or "").strip()
        if priority not in dict(BugReport.PRIORITY_CHOICES):
            return json_error("Choose a valid bug report priority.")
        if priority != bug_report.priority:
            previous_label = PRIORITY_LABELS.get(bug_report.priority, bug_report.priority)
            next_label = PRIORITY_LABELS.get(priority, priority)
            bug_report.priority = priority
            changed.append("priority")
            record_activity(
                project,
                request.user,
                "bug.priority_changed",
                f"Changed bug \"{bug_report.title}\" priority from {previous_label} to {next_label}.",
                bug_report=bug_report,
            )

    if changed:
        bug_report.save()
        if any(field in changed for field in ["title", "description"]):
            record_activity(
                project,
                request.user,
                "bug.updated",
                f"Updated bug report \"{bug_report.title}\" details.",
                bug_report=bug_report,
            )

    return _project_response(project, request.user, membership)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def bug_comment_view(request, bug_id: int):
    bug_report = BugReport.objects.filter(id=bug_id).select_related("project").first()
    if bug_report is None:
        return json_error("Bug report not found.", 404)

    project, membership, error = load_project(bug_report.project_id, request.user)
    if error:
        return error
    if not role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return json_error("Only project members can comment on bug reports.", 403)

    try:
        payload = parse_json_body(request)
        anchor_type, anchor_id, anchor_label = parse_comment_anchor(payload)
    except ValueError as exc:
        return json_error(str(exc))

    body = (payload.get("body") or "").strip()
    if not body:
        return json_error("Comment text is required.")

    BugComment.objects.create(
        bug_report=bug_report,
        author=request.user,
        body=body,
        anchor_type=anchor_type,
        anchor_id=anchor_id,
        anchor_label=anchor_label,
    )
    record_activity(
        project,
        request.user,
        "bug.comment_added",
        f'Added {"an inline comment" if anchor_type else "a comment"} on bug report "{bug_report.title}".',
        bug_report=bug_report,
    )
    notify_mentions(
        project,
        request.user,
        body,
        bug_report=bug_report,
        context_label=f'bug report "{bug_report.title}"',
    )
    return _project_response(project, request.user, membership)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def bug_comment_reaction_view(request, comment_id: int):
    comment = BugComment.objects.filter(id=comment_id).select_related("bug_report__project").first()
    if comment is None:
        return json_error("Bug comment not found.", 404)

    project, membership, error = load_project(comment.bug_report.project_id, request.user)
    if error:
        return error
    if not role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return json_error("Only project members can react to bug comments.", 403)

    try:
        payload = parse_json_body(request)
        emoji = parse_comment_reaction(payload)
    except ValueError as exc:
        return json_error(str(exc))

    reaction = BugCommentReaction.objects.filter(comment=comment, user=request.user).first()
    if reaction and reaction.emoji == emoji:
        reaction.delete()
    elif reaction:
        reaction.emoji = emoji
        reaction.save(update_fields=["emoji", "updated_at"])
    else:
        BugCommentReaction.objects.create(comment=comment, user=request.user, emoji=emoji)

    return _project_response(project, request.user, membership)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def bug_issue_link_view(request, bug_id: int):
    bug_report = BugReport.objects.filter(id=bug_id).select_related("project", "reporter").first()
    if bug_report is None:
        return json_error("Bug report not found.", 404)

    project, membership, error = load_project(bug_report.project_id, request.user)
    if error:
        return error
    if not can_edit_bug(membership, bug_report, request.user):
        return json_error("You do not have permission to link issues to this bug report.", 403)

    try:
        payload = parse_json_body(request)
        repository_full_name, issue_number, issue_url, title, state = parse_issue_reference(payload)
        ensure_issue_repo_allowed(project, repository_full_name)
    except ValueError as exc:
        return json_error(str(exc))

    access_token = get_project_github_access_token(project, request.user)
    title, issue_url, state = refresh_issue_details(
        access_token,
        repository_full_name,
        issue_number,
        title,
        issue_url,
        state,
    )

    existing = GitHubIssueLink.objects.filter(
        project=project,
        bug_report=bug_report,
        repository_full_name=repository_full_name,
        issue_number=issue_number,
    ).first()
    if existing is not None:
        return json_error("That GitHub issue is already linked to this bug report.", 409)

    GitHubIssueLink.objects.create(
        project=project,
        bug_report=bug_report,
        repository_full_name=repository_full_name,
        issue_number=issue_number,
        title=title,
        html_url=issue_url,
        state=state,
        created_by=request.user,
    )
    record_activity(
        project,
        request.user,
        "bug.issue_linked",
        f"Linked {repository_full_name}#{issue_number} to bug report \"{bug_report.title}\".",
        bug_report=bug_report,
    )
    return _project_response(project, request.user, membership)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def bug_resolution_view(request, bug_id: int):
    bug_report = BugReport.objects.filter(id=bug_id).select_related("project", "reporter", "resolution_task").first()
    if bug_report is None:
        return json_error("Bug report not found.", 404)

    project, membership, error = load_project(bug_report.project_id, request.user)
    if error:
        return error
    if not can_edit_bug(membership, bug_report, request.user):
        return json_error("You do not have permission to change the resolution task.", 403)

    try:
        payload = parse_json_body(request)
    except ValueError as exc:
        return json_error(str(exc))

    task_id = payload.get("taskId")
    if task_id in [None, ""]:
        bug_report.resolution_task = None
        bug_report.save(update_fields=["resolution_task", "updated_at"])
        record_activity(
            project,
            request.user,
            "bug.resolution_task_cleared",
            f"Cleared the resolution task for bug \"{bug_report.title}\".",
            bug_report=bug_report,
        )
        return _project_response(project, request.user, membership)

    task = Task.objects.filter(project=project, id=task_id, bug_report=bug_report).first()
    if task is None:
        return json_error("Choose a task created from this bug report.")

    bug_report.resolution_task = task
    bug_report.save(update_fields=["resolution_task", "updated_at"])
    record_activity(
        project,
        request.user,
        "bug.resolution_task_set",
        f"Set task \"{task.title}\" as the resolution task for bug \"{bug_report.title}\".",
        task=task,
        bug_report=bug_report,
    )
    close_bugs_from_resolution_task(task, request.user)
    return _project_response(project, request.user, membership)
