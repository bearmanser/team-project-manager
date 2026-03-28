from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.utils.text import slugify
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from accounts.auth import jwt_required
from accounts.github import GitHubAPIError, create_repository_branch

from ..constants import PRIORITY_LABELS, TASK_STATUS_LABELS
from ..models import BugReport, GitHubIssueLink, Project, ProjectMembership, ProjectRepository, Task, TaskComment, TaskCommentReaction
from ..serializers import build_project_snapshot
from ..services import (
    close_bugs_from_resolution_task,
    ensure_active_sprint,
    ensure_issue_repo_allowed,
    get_github_access_token,
    load_project,
    notify_mentions,
    notify_new_assignees,
    notify_task_comment_assignees,
    parse_issue_reference,
    project_members_by_ids,
    record_activity,
    refresh_issue_details,
    role_at_least,
)
from ..utils import json_error, parse_comment_anchor, parse_comment_reaction, parse_json_body


User = get_user_model()


def _project_response(project: Project, user, membership: ProjectMembership, status: int = 200) -> JsonResponse:
    return JsonResponse({"project": build_project_snapshot(project, user, membership)}, status=status)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_tasks_view(request, project_id: int):
    project, membership, error = load_project(project_id, request.user)
    if error:
        return error
    if not role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return json_error("Only project members can create tasks.", 403)

    try:
        payload = parse_json_body(request)
    except ValueError as exc:
        return json_error(str(exc))

    title = (payload.get("title") or "").strip()
    description = (payload.get("description") or "").strip()
    status = (payload.get("status") or Task.STATUS_TODO).strip() or Task.STATUS_TODO
    priority = (payload.get("priority") or Task.PRIORITY_MEDIUM).strip() or Task.PRIORITY_MEDIUM
    placement = (payload.get("placement") or "").strip() or ("sprint" if project.use_sprints else "product")
    assignee_ids = []
    for value in payload.get("assigneeIds") or []:
        try:
            assignee_ids.append(int(value))
        except (TypeError, ValueError):
            continue
    bug_report_id = payload.get("bugReportId")
    mark_as_resolution = bool(payload.get("markAsResolution"))

    if not title:
        return json_error("Task title is required.")
    if status not in dict(Task.STATUS_CHOICES):
        return json_error("Choose a valid task status.")
    if priority not in dict(Task.PRIORITY_CHOICES):
        return json_error("Choose a valid task priority.")
    if placement not in {"sprint", "product"}:
        return json_error("Choose a valid backlog placement.")

    bug_report = None
    if bug_report_id:
        bug_report = BugReport.objects.filter(project=project, id=bug_report_id).first()
        if bug_report is None:
            return json_error("Bug report not found.", 404)

    sprint = ensure_active_sprint(project) if project.use_sprints and placement == "sprint" else None
    task = Task.objects.create(
        project=project,
        bug_report=bug_report,
        sprint=sprint,
        title=title,
        description=description,
        status=status,
        priority=priority,
        creator=request.user,
    )
    assignees = project_members_by_ids(project, assignee_ids)
    task.assignees.set(assignees)

    location_label = sprint.name if sprint else "Product Backlog"
    record_activity(
        project,
        request.user,
        "task.created",
        f'Created task "{task.title}" in {location_label}.',
        task=task,
        bug_report=bug_report,
    )
    if assignees:
        record_activity(
            project,
            request.user,
            "task.assigned",
            f"Assigned {', '.join(user.username for user in assignees)} to task \"{task.title}\".",
            task=task,
            bug_report=bug_report,
        )
        notify_new_assignees(task, request.user, assignees)
    if mark_as_resolution and bug_report is not None:
        bug_report.resolution_task = task
        bug_report.save(update_fields=["resolution_task", "updated_at"])
        record_activity(
            project,
            request.user,
            "bug.resolution_task_set",
            f'Set task "{task.title}" as the resolution task for bug "{bug_report.title}".',
            task=task,
            bug_report=bug_report,
        )
    notify_mentions(
        project,
        request.user,
        description,
        task=task,
        bug_report=bug_report,
        context_label=f'task "{task.title}"',
    )
    close_bugs_from_resolution_task(task, request.user)
    return _project_response(project, request.user, membership, status=201)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def task_update_view(request, task_id: int):
    task = Task.objects.filter(id=task_id).select_related("project", "bug_report", "sprint").first()
    if task is None:
        return json_error("Task not found.", 404)

    project, membership, error = load_project(task.project_id, request.user)
    if error:
        return error
    if not role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return json_error("Only project members can update tasks.", 403)

    try:
        payload = parse_json_body(request)
    except ValueError as exc:
        return json_error(str(exc))

    changed_fields = []
    if "title" in payload:
        title = (payload.get("title") or "").strip()
        if not title:
            return json_error("Task title is required.")
        if title != task.title:
            task.title = title
            changed_fields.append("title")
    if "description" in payload:
        description = (payload.get("description") or "").strip()
        if description != task.description:
            task.description = description
            changed_fields.append("description")
            notify_mentions(
                project,
                request.user,
                description,
                task=task,
                bug_report=task.bug_report,
                context_label=f'task "{task.title}"',
            )
    if "status" in payload:
        next_status = (payload.get("status") or "").strip()
        if next_status not in dict(Task.STATUS_CHOICES):
            return json_error("Choose a valid task status.")
        if next_status != task.status:
            previous_label = TASK_STATUS_LABELS.get(task.status, task.status)
            next_label = TASK_STATUS_LABELS.get(next_status, next_status)
            task.status = next_status
            changed_fields.append("status")
            record_activity(
                project,
                request.user,
                "task.status_changed",
                f'Moved task "{task.title}" from {previous_label} to {next_label}.',
                task=task,
                bug_report=task.bug_report,
            )
    if "priority" in payload:
        next_priority = (payload.get("priority") or "").strip()
        if next_priority not in dict(Task.PRIORITY_CHOICES):
            return json_error("Choose a valid task priority.")
        if next_priority != task.priority:
            previous_label = PRIORITY_LABELS.get(task.priority, task.priority)
            next_label = PRIORITY_LABELS.get(next_priority, next_priority)
            task.priority = next_priority
            changed_fields.append("priority")
            record_activity(
                project,
                request.user,
                "task.priority_changed",
                f'Changed task "{task.title}" priority from {previous_label} to {next_label}.',
                task=task,
                bug_report=task.bug_report,
            )
    if "placement" in payload:
        placement = (payload.get("placement") or "").strip()
        if placement not in {"sprint", "product"}:
            return json_error("Choose a valid backlog placement.")
        next_sprint = ensure_active_sprint(project) if project.use_sprints and placement == "sprint" else None
        if task.sprint_id != (next_sprint.id if next_sprint else None):
            previous_label = task.sprint.name if task.sprint else "Product Backlog"
            next_label = next_sprint.name if next_sprint else "Product Backlog"
            task.sprint = next_sprint
            changed_fields.append("sprint")
            record_activity(
                project,
                request.user,
                "task.backlog_changed",
                f'Moved task "{task.title}" from {previous_label} to {next_label}.',
                task=task,
                bug_report=task.bug_report,
            )

    if changed_fields:
        task.save()
        if any(field in changed_fields for field in ["title", "description"]):
            record_activity(
                project,
                request.user,
                "task.updated",
                f'Updated task "{task.title}" details.',
                task=task,
                bug_report=task.bug_report,
            )

    if "assigneeIds" in payload:
        requested_ids = []
        for value in payload.get("assigneeIds") or []:
            try:
                requested_ids.append(int(value))
            except (TypeError, ValueError):
                continue
        current_ids = set(task.assignees.values_list("id", flat=True))
        next_assignees = project_members_by_ids(project, requested_ids)
        next_ids = {user.id for user in next_assignees}
        added_users = [user for user in next_assignees if user.id not in current_ids]
        removed_ids = current_ids - next_ids
        task.assignees.set(next_assignees)
        if added_users or removed_ids:
            changes = []
            if added_users:
                changes.append(f"added {', '.join(user.username for user in added_users)}")
            if removed_ids:
                removed_names = list(User.objects.filter(id__in=removed_ids).values_list("username", flat=True))
                changes.append(f"removed {', '.join(sorted(removed_names))}")
            record_activity(
                project,
                request.user,
                "task.assignees_changed",
                f"Updated assignees on task \"{task.title}\": {'; '.join(changes)}.",
                task=task,
                bug_report=task.bug_report,
            )
            notify_new_assignees(task, request.user, added_users)

    if "resolvedBugIds" in payload:
        requested_bug_ids = []
        for value in payload.get("resolvedBugIds") or []:
            try:
                requested_bug_ids.append(int(value))
            except (TypeError, ValueError):
                continue
        requested_bug_ids = list(dict.fromkeys(requested_bug_ids))
        requested_bugs = list(
            BugReport.objects.filter(project=project, id__in=requested_bug_ids)
            .select_related("reporter", "resolution_task")
        )
        found_bug_ids = {bug_report.id for bug_report in requested_bugs}
        if len(found_bug_ids) != len(requested_bug_ids):
            return json_error("Choose valid bugs for this task to resolve.")

        current_bug_ids = set(
            BugReport.objects.filter(project=project, resolution_task=task).values_list("id", flat=True)
        )
        next_bug_ids = {bug_report.id for bug_report in requested_bugs}
        removed_bug_ids = current_bug_ids - next_bug_ids

        for bug_report in requested_bugs:
            if bug_report.resolution_task_id == task.id:
                continue

            previous_task_title = bug_report.resolution_task.title if bug_report.resolution_task else None
            bug_report.resolution_task = task
            bug_report.save(update_fields=["resolution_task", "updated_at"])
            record_activity(
                project,
                request.user,
                "bug.resolution_task_set",
                (
                    f"Changed bug \"{bug_report.title}\" resolution task from \"{previous_task_title}\" to \"{task.title}\"."
                    if previous_task_title
                    else f"Set task \"{task.title}\" as the resolution task for bug \"{bug_report.title}\"."
                ),
                task=task,
                bug_report=bug_report,
            )

        if removed_bug_ids:
            removed_bugs = list(
                BugReport.objects.filter(project=project, id__in=removed_bug_ids, resolution_task=task)
                .select_related("reporter")
            )
            for bug_report in removed_bugs:
                bug_report.resolution_task = None
                bug_report.save(update_fields=["resolution_task", "updated_at"])
                record_activity(
                    project,
                    request.user,
                    "bug.resolution_task_cleared",
                    f"Removed task \"{task.title}\" as the resolution task for bug \"{bug_report.title}\".",
                    task=task,
                    bug_report=bug_report,
                )

    close_bugs_from_resolution_task(task, request.user)
    return _project_response(project, request.user, membership)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def task_comment_view(request, task_id: int):
    task = Task.objects.filter(id=task_id).select_related("project", "bug_report").first()
    if task is None:
        return json_error("Task not found.", 404)

    project, membership, error = load_project(task.project_id, request.user)
    if error:
        return error
    if not role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return json_error("Only project members can comment on tasks.", 403)

    try:
        payload = parse_json_body(request)
        anchor_type, anchor_id, anchor_label = parse_comment_anchor(payload)
    except ValueError as exc:
        return json_error(str(exc))

    body = (payload.get("body") or "").strip()
    if not body:
        return json_error("Comment text is required.")

    TaskComment.objects.create(
        task=task,
        author=request.user,
        body=body,
        anchor_type=anchor_type,
        anchor_id=anchor_id,
        anchor_label=anchor_label,
    )
    record_activity(
        project,
        request.user,
        "task.comment_added",
        f'Added {"an inline comment" if anchor_type else "a comment"} on task "{task.title}".',
        task=task,
        bug_report=task.bug_report,
    )
    mentioned_user_ids = notify_mentions(
        project,
        request.user,
        body,
        task=task,
        bug_report=task.bug_report,
        context_label=f'task "{task.title}"',
    )
    notify_task_comment_assignees(
        task,
        request.user,
        excluded_user_ids=mentioned_user_ids,
    )
    return _project_response(project, request.user, membership)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def task_comment_reaction_view(request, comment_id: int):
    comment = TaskComment.objects.filter(id=comment_id).select_related("task__project", "task__bug_report").first()
    if comment is None:
        return json_error("Task comment not found.", 404)

    project, membership, error = load_project(comment.task.project_id, request.user)
    if error:
        return error
    if not role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return json_error("Only project members can react to task comments.", 403)

    try:
        payload = parse_json_body(request)
        emoji = parse_comment_reaction(payload)
    except ValueError as exc:
        return json_error(str(exc))

    reaction = TaskCommentReaction.objects.filter(comment=comment, user=request.user).first()
    if reaction and reaction.emoji == emoji:
        reaction.delete()
    elif reaction:
        reaction.emoji = emoji
        reaction.save(update_fields=["emoji", "updated_at"])
    else:
        TaskCommentReaction.objects.create(comment=comment, user=request.user, emoji=emoji)

    return _project_response(project, request.user, membership)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def task_issue_link_view(request, task_id: int):
    task = Task.objects.filter(id=task_id).select_related("project", "bug_report").first()
    if task is None:
        return json_error("Task not found.", 404)

    project, membership, error = load_project(task.project_id, request.user)
    if error:
        return error
    if not role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return json_error("Only project members can link GitHub issues.", 403)

    try:
        payload = parse_json_body(request)
        repository_full_name, issue_number, issue_url, title, state = parse_issue_reference(payload)
        ensure_issue_repo_allowed(project, repository_full_name)
    except ValueError as exc:
        return json_error(str(exc))

    access_token = get_github_access_token(request.user) or get_github_access_token(project.owner)
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
        task=task,
        repository_full_name=repository_full_name,
        issue_number=issue_number,
    ).first()
    if existing is not None:
        return json_error("That GitHub issue is already linked to this task.", 409)

    GitHubIssueLink.objects.create(
        project=project,
        task=task,
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
        "task.issue_linked",
        f"Linked {repository_full_name}#{issue_number} to task \"{task.title}\".",
        task=task,
        bug_report=task.bug_report,
    )
    return _project_response(project, request.user, membership)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def task_branch_view(request, task_id: int):
    task = Task.objects.filter(id=task_id).select_related("project", "bug_report").first()
    if task is None:
        return json_error("Task not found.", 404)

    project, membership, error = load_project(task.project_id, request.user)
    if error:
        return error
    if not role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return json_error("Only project members can create branches.", 403)

    try:
        payload = parse_json_body(request)
    except ValueError as exc:
        return json_error(str(exc))

    repository_id = payload.get("repositoryId")
    repository = None
    if repository_id:
        repository = ProjectRepository.objects.filter(project=project, id=repository_id).first()
    if repository is None:
        repository = ProjectRepository.objects.filter(project=project).first()
    if repository is None:
        return json_error("This project does not have a connected repository.")

    suggested_branch_name = f"task-{task.id}-{slugify(task.title)[:40]}".strip("-") or f"task-{task.id}"
    branch_name = (payload.get("branchName") or suggested_branch_name).strip()
    base_branch = (payload.get("baseBranch") or repository.default_branch).strip() or repository.default_branch
    access_token = get_github_access_token(request.user) or get_github_access_token(project.owner)
    if not access_token:
        return json_error("Connect GitHub before creating a branch.")

    try:
        branch_url = create_repository_branch(
            access_token,
            repository.full_name,
            base_branch,
            branch_name,
        )
    except GitHubAPIError as exc:
        return json_error(str(exc), exc.status_code)

    task.branch_name = branch_name
    task.branch_url = branch_url
    task.branch_repository = repository
    task.save(update_fields=["branch_name", "branch_url", "branch_repository", "updated_at"])
    record_activity(
        project,
        request.user,
        "task.branch_created",
        f"Created branch \"{branch_name}\" for task \"{task.title}\" in {repository.full_name}.",
        task=task,
        bug_report=task.bug_report,
    )
    return _project_response(project, request.user, membership)
