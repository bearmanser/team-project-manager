import asyncio
import json
import re
from collections import defaultdict

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import JsonResponse, StreamingHttpResponse
from django.utils import timezone
from django.utils.text import slugify
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from accounts.auth import jwt_required
from accounts.github import (
    GitHubAPIError,
    create_repository_branch,
    get_github_issue,
    get_github_repositories,
    get_github_repository_issues,
)
from accounts.models import UserProfile

from .models import (
    Activity,
    BugComment,
    BugCommentReaction,
    BugReport,
    GitHubIssueLink,
    Notification,
    Organization,
    Project,
    ensure_personal_organization,
    ProjectMembership,
    ProjectRepository,
    Sprint,
    Task,
    TaskComment,
    TaskCommentReaction,
)


User = get_user_model()

ROLE_ORDER = {
    ProjectMembership.ROLE_VIEWER: 0,
    ProjectMembership.ROLE_MEMBER: 1,
    ProjectMembership.ROLE_ADMIN: 2,
    ProjectMembership.ROLE_OWNER: 3,
}
MENTION_PATTERN = re.compile(r"(?<![\w-])@([A-Za-z0-9_][A-Za-z0-9_-]{0,63})")
ISSUE_URL_PATTERN = re.compile(r"^https?://github\.com/([^/]+/[^/]+)/issues/(\d+)")
BOARD_COLUMNS = [
    {"id": Task.STATUS_TODO, "label": "To Do"},
    {"id": Task.STATUS_IN_PROGRESS, "label": "In Progress"},
    {"id": Task.STATUS_IN_REVIEW, "label": "In Review"},
    {"id": Task.STATUS_DONE, "label": "Done"},
]
INLINE_COMMENT_ANCHORS = {"description", "comment"}
COMMENT_REACTION_EMOJIS = ["\U0001F44D", "\u2764\uFE0F", "\U0001F389", "\U0001F440", "\U0001F525"]
BUG_STATUS_LABELS = {
    BugReport.STATUS_OPEN: "Open",
    BugReport.STATUS_INVESTIGATING: "Investigating",
    BugReport.STATUS_MONITORING: "Monitoring",
    BugReport.STATUS_CLOSED: "Closed",
}
PRIORITY_LABELS = {
    Task.PRIORITY_LOW: "Low",
    Task.PRIORITY_MEDIUM: "Medium",
    Task.PRIORITY_HIGH: "High",
    Task.PRIORITY_CRITICAL: "Critical",
}
TASK_STATUS_LABELS = {
    Task.STATUS_TODO: "To Do",
    Task.STATUS_IN_PROGRESS: "In Progress",
    Task.STATUS_IN_REVIEW: "In Review",
    Task.STATUS_DONE: "Done",
}
UNFINISHED_SPRINT_ACTIONS = {"done", "carryover", "product"}
DEFAULT_PROJECT_EVENTS_RETRY_MS = 2000
DEFAULT_PROJECT_EVENTS_POLL_INTERVAL_SECONDS = 1.5


def _get_project_events_retry_ms() -> int:
    value = getattr(settings, "PROJECT_EVENTS_RETRY_MS", DEFAULT_PROJECT_EVENTS_RETRY_MS)
    try:
        return max(500, int(value))
    except (TypeError, ValueError):
        return DEFAULT_PROJECT_EVENTS_RETRY_MS


def _get_project_events_poll_interval_seconds() -> float:
    value = getattr(
        settings,
        "PROJECT_EVENTS_POLL_INTERVAL_SECONDS",
        DEFAULT_PROJECT_EVENTS_POLL_INTERVAL_SECONDS,
    )
    try:
        return max(0.1, float(value))
    except (TypeError, ValueError):
        return DEFAULT_PROJECT_EVENTS_POLL_INTERVAL_SECONDS


def _get_active_sprint(project: Project) -> Sprint | None:
    return Sprint.objects.filter(project=project, status=Sprint.STATUS_ACTIVE).order_by("-number", "-id").first()


def _create_sprint(project: Project) -> Sprint:
    latest_sprint = Sprint.objects.filter(project=project).order_by("-number", "-id").first()
    next_number = (latest_sprint.number if latest_sprint else 0) + 1
    return Sprint.objects.create(
        project=project,
        number=next_number,
        name=f"Sprint {next_number}",
    )


def _ensure_active_sprint(project: Project) -> Sprint:
    return _get_active_sprint(project) or _create_sprint(project)


def _serialize_board_columns(project: Project, active_sprint: Sprint | None) -> list[dict]:
    return [
        {
            "id": column["id"],
            "label": column["label"],
        }
        for column in BOARD_COLUMNS
    ]


def _serialize_sprint_task_snapshot(task: Task) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "status": task.status,
        "priority": task.priority,
    }


def _serialize_sprint(sprint: Sprint | None) -> dict | None:
    if sprint is None:
        return None

    return {
        "id": sprint.id,
        "number": sprint.number,
        "name": sprint.name,
        "status": sprint.status,
        "reviewText": sprint.review_text,
        "summary": sprint.summary or {},
        "startedAt": sprint.started_at.isoformat(),
        "endedAt": sprint.ended_at.isoformat() if sprint.ended_at else None,
        "createdAt": sprint.created_at.isoformat(),
        "updatedAt": sprint.updated_at.isoformat(),
    }


def _parse_comment_anchor(payload: dict) -> tuple[str, str, str]:
    anchor_type = (payload.get("anchorType") or "").strip()
    anchor_id = str(payload.get("anchorId") or "").strip()
    anchor_label = (payload.get("anchorLabel") or "").strip()[:255]

    if anchor_type and anchor_type not in INLINE_COMMENT_ANCHORS:
        raise ValueError("Choose a valid inline comment target.")
    if anchor_type and not anchor_id:
        raise ValueError("Inline comments need a target anchor.")
    if not anchor_type:
        return "", "", ""

    return anchor_type, anchor_id, anchor_label


def _parse_comment_reaction(payload: dict) -> str:
    emoji = str(payload.get("emoji") or "").strip()
    if emoji not in COMMENT_REACTION_EMOJIS:
        raise ValueError("Choose a valid reaction emoji.")
    return emoji


def _json_error(message: str, status: int = 400) -> JsonResponse:
    return JsonResponse({"error": message}, status=status)


def _parse_json_body(request) -> dict:
    if not request.body:
        return {}

    try:
        return json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("Invalid JSON payload.") from exc


def _get_profile(user) -> UserProfile:
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile


def _get_github_access_token(user) -> str:
    return _get_profile(user).github_access_token or ""


def _serialize_user(user) -> dict:
    profile = _get_profile(user)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "githubConnected": bool(profile.github_access_token),
        "githubUsername": profile.github_username,
        "githubAvatarUrl": profile.github_avatar_url,
    }


def _serialize_available_repo(repo: dict) -> dict:
    owner = repo.get("owner") or {}
    return {
        "id": repo.get("id"),
        "name": repo.get("name") or "",
        "fullName": repo.get("full_name") or "",
        "description": repo.get("description") or "",
        "htmlUrl": repo.get("html_url") or "",
        "language": repo.get("language") or "Unknown",
        "stargazersCount": repo.get("stargazers_count", 0),
        "visibility": "private" if repo.get("private") else "public",
        "updatedAt": repo.get("updated_at") or "",
        "owner": owner.get("login", ""),
        "defaultBranch": repo.get("default_branch") or "main",
    }


def _get_project_github_access_token(project: Project, user=None) -> str:
    if user is not None:
        access_token = _get_github_access_token(user)
        if access_token:
            return access_token

    return _get_github_access_token(project.owner)


def _create_project_repository(project: Project, repo: dict) -> ProjectRepository:
    owner = repo.get("owner") or {}
    return ProjectRepository.objects.create(
        project=project,
        github_repo_id=str(repo.get("id")),
        name=repo.get("name") or "",
        full_name=repo.get("full_name") or "",
        html_url=repo.get("html_url") or "",
        default_branch=repo.get("default_branch") or "main",
        visibility="private" if repo.get("private") else "public",
        owner_login=owner.get("login", ""),
    )


def _parse_selected_repository_id(payload: dict) -> str | None:
    candidate_ids = []

    repository_id = str(payload.get("repositoryId") or "").strip()
    if repository_id:
        candidate_ids.append(repository_id)

    candidate_ids.extend(
        str(item).strip() for item in payload.get("repositoryIds") or [] if str(item).strip()
    )

    selected_ids = []
    for candidate_id in candidate_ids:
        if candidate_id not in selected_ids:
            selected_ids.append(candidate_id)

    if len(selected_ids) > 1:
        raise ValueError("Choose at most one repository per project.")

    return selected_ids[0] if selected_ids else None


def _serialize_github_issue_candidate(repository: ProjectRepository, issue: dict) -> dict:
    body = (issue.get("body") or "").strip()
    preview = re.sub(r"\s+", " ", body)
    if len(preview) > 180:
        preview = preview[:177].rstrip() + "..."

    author = issue.get("user") or {}
    return {
        "repositoryId": repository.id,
        "repositoryFullName": repository.full_name,
        "issueNumber": issue.get("number"),
        "title": issue.get("title") or "",
        "htmlUrl": issue.get("html_url") or "",
        "state": issue.get("state") or "open",
        "authorLogin": author.get("login", ""),
        "labels": [label.get("name") or "" for label in issue.get("labels") or [] if label.get("name")],
        "bodyPreview": preview,
        "updatedAt": issue.get("updated_at") or issue.get("created_at") or "",
    }


def _organization_display_name(organization: Organization, user) -> str:
    if organization.is_personal and organization.owner_id == user.id:
        return user.username

    return organization.name


def _accessible_organizations(user) -> list[Organization]:
    ensure_personal_organization(user)
    return list(
        (
            Organization.objects.filter(owner=user)
            | Organization.objects.filter(projects__memberships__user=user)
        )
        .distinct()
        .order_by("-updated_at", "-id")
    )


def _organization_member_count(organization: Organization) -> int:
    user_ids = set(
        ProjectMembership.objects.filter(project__organization=organization).values_list(
            "user_id", flat=True
        )
    )
    user_ids.add(organization.owner_id)
    return len(user_ids)


def _serialize_organization_summary(organization: Organization, user) -> dict:
    return {
        "id": organization.id,
        "name": organization.name,
        "displayName": _organization_display_name(organization, user),
        "description": organization.description,
        "isPersonal": organization.is_personal,
        "role": "owner" if organization.owner_id == user.id else "member",
        "memberCount": _organization_member_count(organization),
        "projectCount": organization.projects.count(),
        "repoCount": ProjectRepository.objects.filter(project__organization=organization).count(),
        "openBugCount": BugReport.objects.filter(project__organization=organization)
        .exclude(status=BugReport.STATUS_CLOSED)
        .count(),
        "updatedAt": organization.updated_at.isoformat(),
    }


def _touch_organization(organization_id: int | None) -> None:
    if organization_id is None:
        return

    Organization.objects.filter(id=organization_id).update(updated_at=timezone.now())


def _touch_project(project: Project) -> None:
    now = timezone.now()
    Project.objects.filter(id=project.id).update(updated_at=now)
    _touch_organization(project.organization_id)



def _sharing_allowed(project: Project) -> bool:
    return not bool(project.organization and project.organization.is_personal)

def _record_activity(
    project: Project,
    actor,
    action: str,
    description: str,
    *,
    task: Task | None = None,
    bug_report: BugReport | None = None,
    metadata: dict | None = None,
) -> Activity:
    activity = Activity.objects.create(
        project=project,
        actor=actor,
        task=task,
        bug_report=bug_report,
        action=action,
        description=description,
        metadata=metadata or {},
    )
    _touch_project(project)
    return activity


def _load_project(project_id: int, user):
    project = (
        Project.objects.filter(id=project_id)
        .select_related("owner", "organization")
        .first()
    )
    if project is None:
        return None, None, _json_error("Project not found.", 404)

    membership = (
        ProjectMembership.objects.filter(project=project, user=user)
        .select_related("user")
        .first()
    )
    if membership is None:
        return None, None, _json_error("Project not found.", 404)

    return project, membership, None


def _load_owned_organization(organization_id: int, user):
    ensure_personal_organization(user)
    organization = Organization.objects.filter(id=organization_id, owner=user).first()
    if organization is None:
        return None, _json_error("Organization not found.", 404)

    return organization, None


def _role_at_least(membership: ProjectMembership, required_role: str) -> bool:
    return ROLE_ORDER.get(membership.role, -1) >= ROLE_ORDER[required_role]


def _serialize_permissions(membership: ProjectMembership) -> dict:
    return {
        "canCreateTasks": _role_at_least(membership, ProjectMembership.ROLE_MEMBER),
        "canCreateBugReports": _role_at_least(membership, ProjectMembership.ROLE_MEMBER),
        "canMoveTasks": _role_at_least(membership, ProjectMembership.ROLE_MEMBER),
        "canAssignTasks": _role_at_least(membership, ProjectMembership.ROLE_MEMBER),
        "canComment": _role_at_least(membership, ProjectMembership.ROLE_MEMBER),
        "canEditTasks": _role_at_least(membership, ProjectMembership.ROLE_MEMBER),
        "canEditBugs": _role_at_least(membership, ProjectMembership.ROLE_ADMIN),
        "canManageUsers": _role_at_least(membership, ProjectMembership.ROLE_ADMIN),
        "canManageProject": membership.role == ProjectMembership.ROLE_OWNER,
        "canManageRepos": membership.role == ProjectMembership.ROLE_OWNER,
        "canDeleteProject": membership.role == ProjectMembership.ROLE_OWNER,
        "isReadOnly": membership.role == ProjectMembership.ROLE_VIEWER,
    }


def _project_member_lookup(project: Project) -> dict[str, User]:
    return {
        membership.user.username.lower(): membership.user
        for membership in ProjectMembership.objects.filter(project=project).select_related("user")
    }


def _notify_mentions(
    project: Project,
    actor,
    text: str,
    *,
    task: Task | None = None,
    bug_report: BugReport | None = None,
    context_label: str,
) -> None:
    mentioned_usernames = {match.group(1).lower() for match in MENTION_PATTERN.finditer(text or "")}
    if not mentioned_usernames:
        return

    member_lookup = _project_member_lookup(project)
    for username in sorted(mentioned_usernames):
        user = member_lookup.get(username)
        if user is None or user.id == actor.id:
            continue

        Notification.objects.create(
            recipient=user,
            actor=actor,
            project=project,
            task=task,
            bug_report=bug_report,
            kind=Notification.KIND_MENTION,
            message=f"{actor.username} mentioned you in {context_label}.",
        )


def _notify_new_assignees(task: Task, actor, assignees: list[User]) -> None:
    for user in assignees:
        if user.id == actor.id:
            continue

        Notification.objects.create(
            recipient=user,
            actor=actor,
            project=task.project,
            task=task,
            kind=Notification.KIND_ASSIGNMENT,
            message=f"{actor.username} assigned you to task \"{task.title}\".",
        )


def _project_members_by_ids(project: Project, user_ids: list[int]) -> list[User]:
    if not user_ids:
        return []

    return list(
        User.objects.filter(project_memberships__project=project, id__in=user_ids)
        .distinct()
        .order_by("username")
    )


def _parse_issue_reference(payload: dict) -> tuple[str, int, str, str, str]:
    issue_url = (payload.get("issueUrl") or "").strip()
    repository_full_name = (payload.get("repositoryFullName") or "").strip()
    issue_number = payload.get("issueNumber")
    title = (payload.get("title") or "").strip()
    state = (payload.get("state") or "open").strip() or "open"

    if issue_url:
        match = ISSUE_URL_PATTERN.match(issue_url)
        if not match:
            raise ValueError("Enter a valid GitHub issue URL.")
        repository_full_name = match.group(1)
        issue_number = int(match.group(2))
    else:
        if not repository_full_name:
            raise ValueError("Choose a connected repository for the issue link.")
        try:
            issue_number = int(issue_number)
        except (TypeError, ValueError) as exc:
            raise ValueError("Provide a valid GitHub issue number.") from exc
        issue_url = f"https://github.com/{repository_full_name}/issues/{issue_number}"

    return (
        repository_full_name,
        issue_number,
        issue_url,
        title or f"Issue #{issue_number}",
        state,
    )


def _ensure_issue_repo_allowed(project: Project, repository_full_name: str) -> None:
    allowed = set(
        ProjectRepository.objects.filter(project=project).values_list("full_name", flat=True)
    )
    if repository_full_name not in allowed:
        raise ValueError("Issue links must belong to one of the project's connected repositories.")


def _refresh_issue_details(
    access_token: str,
    repository_full_name: str,
    issue_number: int,
    fallback_title: str,
    fallback_url: str,
    fallback_state: str,
) -> tuple[str, str, str]:
    if not access_token:
        return fallback_title, fallback_url, fallback_state

    try:
        issue = get_github_issue(access_token, repository_full_name, issue_number)
    except GitHubAPIError:
        return fallback_title, fallback_url, fallback_state

    return (
        issue.get("title") or fallback_title,
        issue.get("html_url") or fallback_url,
        issue.get("state") or fallback_state,
    )


def _close_bugs_from_resolution_task(task: Task, actor) -> None:
    if task.status != Task.STATUS_DONE:
        return

    closed_at = timezone.now()
    bug_reports = list(
        BugReport.objects.filter(project=task.project, resolution_task=task)
        .select_related("reporter")
    )
    for bug_report in bug_reports:
        if bug_report.status == BugReport.STATUS_CLOSED:
            continue

        bug_report.status = BugReport.STATUS_CLOSED
        bug_report.closed_at = closed_at
        bug_report.save(update_fields=["status", "closed_at", "updated_at"])
        _record_activity(
            task.project,
            actor,
            "bug.auto_closed",
            f"Closed bug \"{bug_report.title}\" because its resolution task reached Done.",
            task=task,
            bug_report=bug_report,
        )

        if bug_report.reporter_id != actor.id:
            Notification.objects.create(
                recipient=bug_report.reporter,
                actor=actor,
                project=task.project,
                task=task,
                bug_report=bug_report,
                kind=Notification.KIND_SYSTEM,
                message=f"Bug \"{bug_report.title}\" was closed when its resolution task was completed.",
            )


def _can_edit_bug(membership: ProjectMembership, bug_report: BugReport, user) -> bool:
    return _role_at_least(membership, ProjectMembership.ROLE_ADMIN) or bug_report.reporter_id == user.id

def _serialize_repository(repo: ProjectRepository) -> dict:
    return {
        "id": repo.id,
        "githubRepoId": repo.github_repo_id,
        "name": repo.name,
        "fullName": repo.full_name,
        "htmlUrl": repo.html_url,
        "defaultBranch": repo.default_branch,
        "visibility": repo.visibility,
        "owner": repo.owner_login,
    }


def _serialize_issue_link(link: GitHubIssueLink) -> dict:
    return {
        "id": link.id,
        "repositoryFullName": link.repository_full_name,
        "issueNumber": link.issue_number,
        "title": link.title,
        "htmlUrl": link.html_url,
        "state": link.state,
        "createdAt": link.created_at.isoformat(),
    }


def _serialize_comment_reactions(reactions: list, user_id: int | None) -> list[dict]:
    grouped: dict[str, dict] = {}

    for reaction in reactions:
        entry = grouped.setdefault(
            reaction.emoji,
            {
                "emoji": reaction.emoji,
                "count": 0,
                "reactedByUser": False,
            },
        )
        entry["count"] += 1
        if user_id is not None and reaction.user_id == user_id:
            entry["reactedByUser"] = True

    ordered: list[dict] = []
    for emoji in COMMENT_REACTION_EMOJIS:
        if emoji in grouped:
            ordered.append(grouped[emoji])
    return ordered


def _serialize_comment(comment, *, reactions: list, user_id: int | None) -> dict:
    return {
        "id": comment.id,
        "body": comment.body,
        "author": _serialize_user(comment.author),
        "anchorType": getattr(comment, "anchor_type", ""),
        "anchorId": getattr(comment, "anchor_id", ""),
        "anchorLabel": getattr(comment, "anchor_label", ""),
        "reactions": _serialize_comment_reactions(reactions, user_id),
        "createdAt": comment.created_at.isoformat(),
        "updatedAt": comment.updated_at.isoformat(),
    }


def _serialize_activity(activity: Activity) -> dict:
    return {
        "id": activity.id,
        "action": activity.action,
        "description": activity.description,
        "actor": _serialize_user(activity.actor) if activity.actor else None,
        "taskId": activity.task_id,
        "bugReportId": activity.bug_report_id,
        "metadata": activity.metadata,
        "createdAt": activity.created_at.isoformat(),
    }


def _serialize_notification(notification: Notification) -> dict:
    return {
        "id": notification.id,
        "kind": notification.kind,
        "message": notification.message,
        "isRead": notification.is_read,
        "actor": _serialize_user(notification.actor) if notification.actor else None,
        "projectId": notification.project_id,
        "taskId": notification.task_id,
        "bugReportId": notification.bug_report_id,
        "createdAt": notification.created_at.isoformat(),
    }


def _serialize_task_summary(task: Task, bug_report: BugReport | None = None) -> dict:
    bug = bug_report or task.bug_report
    return {
        "id": task.id,
        "title": task.title,
        "status": task.status,
        "priority": task.priority,
        "assigneeCount": task.assignees.count(),
        "sprintId": task.sprint_id,
        "sprintName": task.sprint.name if task.sprint else "",
        "isResolutionTask": bool(bug and bug.resolution_task_id == task.id),
    }


def _serialize_resolved_bug_summary(bug_report: BugReport) -> dict:
    return {
        "id": bug_report.id,
        "title": bug_report.title,
        "status": bug_report.status,
        "priority": bug_report.priority,
    }


def _serialize_task(
    task: Task,
    *,
    task_comments: list[TaskComment],
    task_comment_reactions_by_comment: dict[int, list[TaskCommentReaction]],
    current_user_id: int | None,
    task_activities: list[Activity],
    direct_issue_links: list[GitHubIssueLink],
    inherited_issue_links: list[GitHubIssueLink],
    resolved_bugs: list[BugReport],
) -> dict:
    bug_report = task.bug_report
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "creator": _serialize_user(task.creator),
        "assignees": [_serialize_user(user) for user in task.assignees.all()],
        "sprintId": task.sprint_id,
        "sprintName": task.sprint.name if task.sprint else "",
        "bugReportId": task.bug_report_id,
        "bugReportTitle": bug_report.title if bug_report else "",
        "isResolutionTask": bool(bug_report and bug_report.resolution_task_id == task.id),
        "branchName": task.branch_name,
        "branchUrl": task.branch_url,
        "branchRepositoryId": task.branch_repository_id,
        "resolvedBugs": [_serialize_resolved_bug_summary(bug_report) for bug_report in resolved_bugs],
        "directGitHubIssues": [_serialize_issue_link(link) for link in direct_issue_links],
        "inheritedGitHubIssues": [_serialize_issue_link(link) for link in inherited_issue_links],
        "comments": [
            _serialize_comment(
                comment,
                reactions=task_comment_reactions_by_comment[comment.id],
                user_id=current_user_id,
            )
            for comment in task_comments
        ],
        "activity": [_serialize_activity(activity) for activity in task_activities],
        "createdAt": task.created_at.isoformat(),
        "updatedAt": task.updated_at.isoformat(),
    }


def _serialize_bug_report(
    bug_report: BugReport,
    *,
    bug_comments: list[BugComment],
    bug_comment_reactions_by_comment: dict[int, list[BugCommentReaction]],
    current_user_id: int | None,
    bug_activities: list[Activity],
    issue_links: list[GitHubIssueLink],
    bug_tasks: list[Task],
) -> dict:
    return {
        "id": bug_report.id,
        "title": bug_report.title,
        "description": bug_report.description,
        "status": bug_report.status,
        "priority": bug_report.priority,
        "reporter": _serialize_user(bug_report.reporter),
        "resolutionTaskId": bug_report.resolution_task_id,
        "resolutionTaskTitle": bug_report.resolution_task.title if bug_report.resolution_task else "",
        "linkedGitHubIssues": [_serialize_issue_link(link) for link in issue_links],
        "tasks": [_serialize_task_summary(task, bug_report) for task in bug_tasks],
        "comments": [
            _serialize_comment(
                comment,
                reactions=bug_comment_reactions_by_comment[comment.id],
                user_id=current_user_id,
            )
            for comment in bug_comments
        ],
        "activity": [_serialize_activity(activity) for activity in bug_activities],
        "closedAt": bug_report.closed_at.isoformat() if bug_report.closed_at else None,
        "createdAt": bug_report.created_at.isoformat(),
        "updatedAt": bug_report.updated_at.isoformat(),
    }


def _serialize_project_summary(project: Project, membership: ProjectMembership) -> dict:
    return {
        "id": project.id,
        "organizationId": project.organization_id,
        "name": project.name,
        "description": project.description,
        "role": membership.role,
        "memberCount": project.memberships.count(),
        "repoCount": project.repositories.count(),
        "openBugCount": project.bug_reports.exclude(status=BugReport.STATUS_CLOSED).count(),
        "taskCounts": {
            Task.STATUS_TODO: project.tasks.filter(status=Task.STATUS_TODO).count(),
            Task.STATUS_IN_PROGRESS: project.tasks.filter(status=Task.STATUS_IN_PROGRESS).count(),
            Task.STATUS_IN_REVIEW: project.tasks.filter(status=Task.STATUS_IN_REVIEW).count(),
            Task.STATUS_DONE: project.tasks.filter(status=Task.STATUS_DONE).count(),
        },
        "updatedAt": project.updated_at.isoformat(),
    }


def _build_project_snapshot(
    project: Project,
    user,
    membership: ProjectMembership | None = None,
) -> dict:
    membership = membership or (
        ProjectMembership.objects.filter(project=project, user=user)
        .select_related("user")
        .first()
    )
    if membership is None:
        raise PermissionError("Project membership required.")

    active_sprint = _ensure_active_sprint(project) if project.use_sprints else _get_active_sprint(project)
    sprint_history = list(
        Sprint.objects.filter(project=project, status=Sprint.STATUS_COMPLETED).order_by("-number", "-id")
    )
    members = list(
        ProjectMembership.objects.filter(project=project).select_related("user")
    )
    repositories = list(ProjectRepository.objects.filter(project=project))
    tasks = list(
        Task.objects.filter(project=project)
        .select_related("creator", "bug_report", "branch_repository", "sprint")
        .prefetch_related("assignees")
    )
    bug_reports = list(
        BugReport.objects.filter(project=project).select_related("reporter", "resolution_task")
    )
    task_comments = list(
        TaskComment.objects.filter(task__project=project).select_related("author")
    )
    bug_comments = list(
        BugComment.objects.filter(bug_report__project=project).select_related("author")
    )
    task_comment_reactions = list(
        TaskCommentReaction.objects.filter(comment__task__project=project).select_related("user", "comment")
    )
    bug_comment_reactions = list(
        BugCommentReaction.objects.filter(comment__bug_report__project=project).select_related("user", "comment")
    )
    activities = list(
        Activity.objects.filter(project=project)
        .select_related("actor", "task", "bug_report")
    )
    issue_links = list(GitHubIssueLink.objects.filter(project=project))

    task_comments_by_task: dict[int, list[TaskComment]] = defaultdict(list)
    for comment in task_comments:
        task_comments_by_task[comment.task_id].append(comment)

    bug_comments_by_bug: dict[int, list[BugComment]] = defaultdict(list)
    for comment in bug_comments:
        bug_comments_by_bug[comment.bug_report_id].append(comment)

    task_comment_reactions_by_comment: dict[int, list[TaskCommentReaction]] = defaultdict(list)
    for reaction in task_comment_reactions:
        task_comment_reactions_by_comment[reaction.comment_id].append(reaction)

    bug_comment_reactions_by_comment: dict[int, list[BugCommentReaction]] = defaultdict(list)
    for reaction in bug_comment_reactions:
        bug_comment_reactions_by_comment[reaction.comment_id].append(reaction)

    task_activities_by_task: dict[int, list[Activity]] = defaultdict(list)
    bug_activities_by_bug: dict[int, list[Activity]] = defaultdict(list)
    for activity in activities:
        if activity.task_id:
            task_activities_by_task[activity.task_id].append(activity)
        if activity.bug_report_id:
            bug_activities_by_bug[activity.bug_report_id].append(activity)

    direct_links_by_task: dict[int, list[GitHubIssueLink]] = defaultdict(list)
    links_by_bug: dict[int, list[GitHubIssueLink]] = defaultdict(list)
    for link in issue_links:
        if link.task_id:
            direct_links_by_task[link.task_id].append(link)
        if link.bug_report_id:
            links_by_bug[link.bug_report_id].append(link)

    bug_tasks: dict[int, list[Task]] = defaultdict(list)
    resolved_bugs_by_task: dict[int, list[BugReport]] = defaultdict(list)
    for task in tasks:
        if task.bug_report_id:
            bug_tasks[task.bug_report_id].append(task)
    for bug_report in bug_reports:
        if bug_report.resolution_task_id:
            resolved_bugs_by_task[bug_report.resolution_task_id].append(bug_report)

    serialized_tasks = [
        _serialize_task(
            task,
            task_comments=task_comments_by_task[task.id],
            task_comment_reactions_by_comment=task_comment_reactions_by_comment,
            current_user_id=user.id if user else None,
            task_activities=task_activities_by_task[task.id],
            direct_issue_links=direct_links_by_task[task.id],
            inherited_issue_links=links_by_bug[task.bug_report_id] if task.bug_report_id else [],
            resolved_bugs=resolved_bugs_by_task[task.id],
        )
        for task in tasks
    ]
    serialized_bugs = [
        _serialize_bug_report(
            bug_report,
            bug_comments=bug_comments_by_bug[bug_report.id],
            bug_comment_reactions_by_comment=bug_comment_reactions_by_comment,
            current_user_id=user.id if user else None,
            bug_activities=bug_activities_by_bug[bug_report.id],
            issue_links=links_by_bug[bug_report.id],
            bug_tasks=bug_tasks[bug_report.id],
        )
        for bug_report in bug_reports
    ]
    recent_activity = [
        _serialize_activity(activity)
        for activity in sorted(activities, key=lambda item: item.created_at, reverse=True)[:40]
    ]

    return {
        "id": project.id,
        "organizationId": project.organization_id,
        "organizationName": project.organization.name if project.organization else "",
        "name": project.name,
        "description": project.description,
        "useSprints": project.use_sprints,
        "activeSprint": _serialize_sprint(active_sprint),
        "sprintHistory": [_serialize_sprint(item) for item in sprint_history],
        "ownerId": project.owner_id,
        "role": membership.role,
        "permissions": _serialize_permissions(membership),
        "repositories": [_serialize_repository(repo) for repo in repositories],
        "members": [
            {
                "id": item.id,
                "role": item.role,
                "user": _serialize_user(item.user),
                "addedAt": item.created_at.isoformat(),
            }
            for item in members
        ],
        "boardColumns": _serialize_board_columns(project, active_sprint),
        "taskStatusLabels": TASK_STATUS_LABELS,
        "bugStatusLabels": BUG_STATUS_LABELS,
        "tasks": serialized_tasks,
        "bugReports": serialized_bugs,
        "recentActivity": recent_activity,
        "createdAt": project.created_at.isoformat(),
        "updatedAt": project.updated_at.isoformat(),
    }

@require_GET
@jwt_required
def workspace_view(request):
    memberships = list(
        ProjectMembership.objects.filter(user=request.user)
        .select_related("project", "project__owner", "project__organization")
        .order_by("-project__updated_at")
    )
    projects = [_serialize_project_summary(item.project, item) for item in memberships]
    organizations = [
        _serialize_organization_summary(organization, request.user)
        for organization in _accessible_organizations(request.user)
    ]
    notifications = [
        _serialize_notification(notification)
        for notification in Notification.objects.filter(recipient=request.user)
        .select_related("actor")[:20]
    ]

    available_repos: list[dict] = []
    github_repo_error = None
    access_token = _get_github_access_token(request.user)
    if access_token:
        try:
            available_repos = [
                _serialize_available_repo(repo)
                for repo in get_github_repositories(access_token)
            ]
        except GitHubAPIError as exc:
            github_repo_error = str(exc)

    return JsonResponse(
        {
            "user": _serialize_user(request.user),
            "organizations": organizations,
            "projects": projects,
            "notifications": notifications,
            "availableRepos": available_repos,
            "githubRepoError": github_repo_error,
        }
    )


@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def organizations_view(request):
    if request.method == "GET":
        return JsonResponse(
            {
                "organizations": [
                    _serialize_organization_summary(organization, request.user)
                    for organization in _accessible_organizations(request.user)
                ]
            }
        )

    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    name = (payload.get("name") or "").strip()
    description = (payload.get("description") or "").strip()
    if not name:
        return _json_error("Organization name is required.")

    organization = Organization.objects.create(
        name=name,
        description=description,
        owner=request.user,
    )
    return JsonResponse(
        {"organization": _serialize_organization_summary(organization, request.user)},
        status=201,
    )




@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def organization_settings_view(request, organization_id: int):
    organization, error = _load_owned_organization(organization_id, request.user)
    if error:
        return error
    if organization.is_personal:
        return _json_error("Personal workspaces cannot be edited here.", 403)

    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    name = (payload.get("name") or "").strip()
    if not name:
        return _json_error("Organization name is required.")

    if name != organization.name:
        organization.name = name
        organization.save(update_fields=["name", "updated_at"])

    return JsonResponse({"organization": _serialize_organization_summary(organization, request.user)})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def organization_delete_view(request, organization_id: int):
    organization, error = _load_owned_organization(organization_id, request.user)
    if error:
        return error
    if organization.is_personal:
        return _json_error("Personal workspaces cannot be deleted.", 403)

    deleted_organization_id = organization.id
    organization.delete()
    return JsonResponse({"success": True, "organizationId": deleted_organization_id})
@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def projects_view(request):
    if request.method == "GET":
        memberships = list(
            ProjectMembership.objects.filter(user=request.user)
            .select_related("project", "project__organization")
            .order_by("-project__updated_at")
        )
        return JsonResponse(
            {"projects": [_serialize_project_summary(item.project, item) for item in memberships]}
        )

    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    organization_id = payload.get("organizationId")
    name = (payload.get("name") or "").strip()
    description = (payload.get("description") or "").strip()

    try:
        repository_id = _parse_selected_repository_id(payload)
    except ValueError as exc:
        return _json_error(str(exc))
    try:
        organization_id = int(organization_id)
    except (TypeError, ValueError):
        return _json_error("Choose an organization for the new project.")

    organization = Organization.objects.filter(id=organization_id, owner=request.user).first()
    if organization is None:
        return _json_error("You can only create projects inside organizations you own.", 403)

    if not name:
        return _json_error("Project name is required.")

    selected_repo = None
    if repository_id:
        access_token = _get_github_access_token(request.user)
        if not access_token:
            return _json_error("Connect your GitHub account before selecting a GitHub repository.")

        try:
            available_repos = get_github_repositories(access_token)
        except GitHubAPIError as exc:
            return _json_error(str(exc), exc.status_code)

        available_repo_map = {str(repo.get("id")): repo for repo in available_repos}
        selected_repo = available_repo_map.get(repository_id)
        if selected_repo is None:
            return _json_error("The selected repository is no longer available.")

    project = Project.objects.create(
        name=name,
        description=description,
        organization=organization,
        owner=request.user,
    )
    membership = ProjectMembership.objects.create(
        project=project,
        user=request.user,
        role=ProjectMembership.ROLE_OWNER,
        added_by=request.user,
    )
    if selected_repo is not None:
        _create_project_repository(project, selected_repo)

    repo_description = " and connected a GitHub repository." if selected_repo else " without a connected GitHub repository."
    _record_activity(
        project,
        request.user,
        "project.created",
        f"Created project \"{project.name}\" inside \"{organization.name}\"{repo_description}",
    )
    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)}, status=201)


@require_GET
@jwt_required
def project_detail_view(request, project_id: int):
    project, membership, error = _load_project(project_id, request.user)
    if error:
        return error

    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)})


@require_GET
@jwt_required
def project_events_view(request, project_id: int):
    project, _, error = _load_project(project_id, request.user)
    if error:
        return error

    retry_ms = _get_project_events_retry_ms()
    poll_interval_seconds = _get_project_events_poll_interval_seconds()

    async def event_stream():
        last_seen = project.updated_at.isoformat()
        yield f"retry: {retry_ms}\n\n"
        yield f"event: stream.open\ndata: {json.dumps({'updatedAt': last_seen})}\n\n"
        while True:
            await asyncio.sleep(poll_interval_seconds)
            current_project = await Project.objects.filter(id=project.id).only("updated_at").afirst()
            if current_project is None:
                yield "event: project.deleted\ndata: {}\n\n"
                break
            current_stamp = current_project.updated_at.isoformat()
            if current_stamp != last_seen:
                last_seen = current_stamp
                yield f"event: project.updated\ndata: {json.dumps({'updatedAt': current_stamp})}\n\n"
            else:
                yield ": keepalive\n\n"

    response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


@require_GET
@jwt_required
def project_github_issues_view(request, project_id: int):
    project, membership, error = _load_project(project_id, request.user)
    if error:
        return error
    if not _role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return _json_error("Only project members can import GitHub issues as bugs.", 403)

    repositories = list(ProjectRepository.objects.filter(project=project).order_by("full_name", "id"))
    if not repositories:
        return JsonResponse({"issues": []})

    access_token = _get_project_github_access_token(project, request.user)
    if not access_token:
        return _json_error("Connect GitHub before importing issues.")

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
            return _json_error(str(exc), exc.status_code)

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
            issues.append(_serialize_github_issue_candidate(repository, issue))

    issues.sort(key=lambda item: item["updatedAt"], reverse=True)
    return JsonResponse({"issues": issues})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_settings_view(request, project_id: int):
    project, membership, error = _load_project(project_id, request.user)
    if error:
        return error
    if membership.role != ProjectMembership.ROLE_OWNER:
        return _json_error("Only the project owner can update project settings.", 403)

    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    name = (payload.get("name") or "").strip()
    description = (payload.get("description") or "").strip()
    use_sprints = bool(payload.get("useSprints"))
    if not name:
        return _json_error("Project name is required.")

    changed = []
    update_fields = ["updated_at"]
    if name != project.name:
        changed.append("name")
        update_fields.append("name")
    if description != project.description:
        changed.append("description")
        update_fields.append("description")
    if use_sprints != project.use_sprints:
        changed.append("sprint mode")
        update_fields.append("use_sprints")

    project.name = name
    project.description = description
    project.use_sprints = use_sprints
    project.save(update_fields=update_fields)

    if use_sprints:
        _ensure_active_sprint(project)

    if changed:
        _record_activity(
            project,
            request.user,
            "project.updated",
            f"Updated project settings ({', '.join(changed)}).",
        )

    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_delete_view(request, project_id: int):
    project, membership, error = _load_project(project_id, request.user)
    if error:
        return error
    if membership.role != ProjectMembership.ROLE_OWNER:
        return _json_error("Only the project owner can delete the project.", 403)

    deleted_project_id = project.id
    organization_id = project.organization_id
    project.delete()
    _touch_organization(organization_id)
    return JsonResponse({"success": True, "projectId": deleted_project_id})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_sprint_end_view(request, project_id: int):
    project, membership, error = _load_project(project_id, request.user)
    if error:
        return error
    if not _role_at_least(membership, ProjectMembership.ROLE_ADMIN):
        return _json_error("Only admins and owners can end a sprint.", 403)
    if not project.use_sprints:
        return _json_error("Enable sprint mode before ending a sprint.")

    active_sprint = _get_active_sprint(project)
    if active_sprint is None:
        return _json_error("There is no active sprint to end.", 404)

    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    review_text = (payload.get("reviewText") or "").strip()
    unfinished_action = (payload.get("unfinishedAction") or "carryover").strip() or "carryover"
    if unfinished_action not in UNFINISHED_SPRINT_ACTIONS:
        return _json_error("Choose a valid action for unfinished sprint tasks.")

    sprint_tasks = list(
        Task.objects.filter(project=project, sprint=active_sprint)
        .select_related("bug_report")
        .prefetch_related("assignees")
        .order_by("status", "-updated_at", "-id")
    )
    completed_tasks = [task for task in sprint_tasks if task.status == Task.STATUS_DONE]
    unfinished_tasks = [task for task in sprint_tasks if task.status != Task.STATUS_DONE]
    carryover_tasks = []
    returned_to_product_tasks = []
    auto_completed_tasks = []

    active_sprint.status = Sprint.STATUS_COMPLETED
    active_sprint.review_text = review_text
    active_sprint.ended_at = timezone.now()

    next_sprint = _create_sprint(project)

    if unfinished_action == "done":
        for task in unfinished_tasks:
            task.status = Task.STATUS_DONE
            task.save(update_fields=["status", "updated_at"])
            _close_bugs_from_resolution_task(task, request.user)
        auto_completed_tasks = unfinished_tasks
    elif unfinished_action == "product":
        for task in unfinished_tasks:
            task.sprint = None
            task.save(update_fields=["sprint", "updated_at"])
        returned_to_product_tasks = unfinished_tasks
    else:
        for task in unfinished_tasks:
            task.sprint = next_sprint
            task.save(update_fields=["sprint", "updated_at"])
        carryover_tasks = unfinished_tasks

    completed_task_snapshots = completed_tasks + auto_completed_tasks
    active_sprint.summary = {
        "totalCount": len(sprint_tasks),
        "completedCount": len(completed_task_snapshots),
        "carryoverCount": len(carryover_tasks),
        "returnedToProductCount": len(returned_to_product_tasks),
        "completedTasks": [_serialize_sprint_task_snapshot(task) for task in completed_task_snapshots],
        "carryoverTasks": [_serialize_sprint_task_snapshot(task) for task in carryover_tasks],
        "returnedToProductTasks": [
            _serialize_sprint_task_snapshot(task) for task in returned_to_product_tasks
        ],
        "unfinishedAction": unfinished_action,
    }
    active_sprint.save(update_fields=["status", "review_text", "ended_at", "summary", "updated_at"])

    if unfinished_action == "done":
        unfinished_summary = f"{len(auto_completed_tasks)} auto-completed tasks"
    elif unfinished_action == "product":
        unfinished_summary = f"{len(returned_to_product_tasks)} tasks returned to the product backlog"
    else:
        unfinished_summary = f"{len(carryover_tasks)} carryover tasks"

    _record_activity(
        project,
        request.user,
        "sprint.ended",
        f"Ended {active_sprint.name} with {len(completed_task_snapshots)} completed tasks and {unfinished_summary}.",
        metadata={
            "endedSprintId": active_sprint.id,
            "nextSprintId": next_sprint.id,
            "unfinishedAction": unfinished_action,
        },
    )

    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_sprint_update_view(request, project_id: int, sprint_id: int):
    project, membership, error = _load_project(project_id, request.user)
    if error:
        return error
    if not _role_at_least(membership, ProjectMembership.ROLE_ADMIN):
        return _json_error("Only admins and owners can rename sprints.", 403)

    sprint = Sprint.objects.filter(project=project, id=sprint_id).first()
    if sprint is None:
        return _json_error("Sprint not found.", 404)

    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    name = (payload.get("name") or "").strip()
    if not name:
        return _json_error("Sprint name is required.")

    if name != sprint.name:
        previous_name = sprint.name
        sprint.name = name
        sprint.save(update_fields=["name", "updated_at"])
        _record_activity(
            project,
            request.user,
            "sprint.renamed",
            f'Renamed sprint "{previous_name}" to "{name}".',
            metadata={"sprintId": sprint.id},
        )

    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_repo_add_view(request, project_id: int):
    project, membership, error = _load_project(project_id, request.user)
    if error:
        return error
    if membership.role != ProjectMembership.ROLE_OWNER:
        return _json_error("Only the project owner can connect a repository.", 403)

    access_token = _get_github_access_token(request.user)
    if not access_token:
        return _json_error("Connect GitHub before connecting a repository.")

    try:
        payload = _parse_json_body(request)
        repository_id = _parse_selected_repository_id(payload)
    except ValueError as exc:
        return _json_error(str(exc))

    if not repository_id:
        return _json_error("Choose a repository to connect.")

    existing_repository = project.repositories.order_by("id").first()
    if existing_repository is not None:
        if existing_repository.github_repo_id == repository_id:
            return _json_error("That repository is already connected to this project.")
        return _json_error("This project already has a connected repository. Remove it first to connect a different one.")

    try:
        available_repos = get_github_repositories(access_token)
    except GitHubAPIError as exc:
        return _json_error(str(exc), exc.status_code)

    available_repo_map = {str(repo.get("id")): repo for repo in available_repos}
    repo = available_repo_map.get(repository_id)
    if repo is None:
        return _json_error("The selected repository is no longer available.")

    _create_project_repository(project, repo)
    _record_activity(
        project,
        request.user,
        "project.repo_added",
        f"Connected GitHub repository \"{repo.get('full_name') or repo.get('name') or repository_id}\" to the project.",
    )
    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_repo_remove_view(request, project_id: int, repository_id: int):
    project, membership, error = _load_project(project_id, request.user)
    if error:
        return error
    if membership.role != ProjectMembership.ROLE_OWNER:
        return _json_error("Only the project owner can disconnect the repository.", 403)

    repository = ProjectRepository.objects.filter(project=project, id=repository_id).first()
    if repository is None:
        return _json_error("Repository not found.", 404)

    full_name = repository.full_name
    repository.delete()
    _record_activity(
        project,
        request.user,
        "project.repo_removed",
        f"Disconnected GitHub repository \"{full_name}\" from the project.",
    )
    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_members_view(request, project_id: int):
    project, membership, error = _load_project(project_id, request.user)
    if error:
        return error
    if not _role_at_least(membership, ProjectMembership.ROLE_ADMIN):
        return _json_error("Only admins and owners can manage users.", 403)
    if not _sharing_allowed(project):
        return _json_error("Personal workspaces do not support sharing projects.", 403)


    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    identifier = (payload.get("identifier") or "").strip()
    role = (payload.get("role") or ProjectMembership.ROLE_MEMBER).strip()
    if not identifier:
        return _json_error("Provide a username or email address.")
    if role not in {
        ProjectMembership.ROLE_ADMIN,
        ProjectMembership.ROLE_MEMBER,
        ProjectMembership.ROLE_VIEWER,
    }:
        return _json_error("Choose a valid project role.")

    if "@" in identifier:
        user = User.objects.filter(email__iexact=identifier).first()
    else:
        user = User.objects.filter(username__iexact=identifier).first()
    if user is None:
        return _json_error("That user does not exist yet.", 404)

    existing_membership = ProjectMembership.objects.filter(project=project, user=user).first()
    if existing_membership is not None:
        return _json_error("That user is already part of this project.", 409)

    ProjectMembership.objects.create(
        project=project,
        user=user,
        role=role,
        added_by=request.user,
    )
    _record_activity(
        project,
        request.user,
        "project.member_added",
        f"Added {user.username} to the project as {role.title()}.",
    )
    Notification.objects.create(
        recipient=user,
        actor=request.user,
        project=project,
        kind=Notification.KIND_SYSTEM,
        message=f"{request.user.username} added you to project \"{project.name}\" as {role.title()}.",
    )
    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_member_role_view(request, project_id: int, membership_id: int):
    project, membership, error = _load_project(project_id, request.user)
    if error:
        return error
    if not _role_at_least(membership, ProjectMembership.ROLE_ADMIN):
        return _json_error("Only admins and owners can change roles.", 403)

    target_membership = ProjectMembership.objects.filter(project=project, id=membership_id).select_related("user").first()
    if target_membership is None:
        return _json_error("Project member not found.", 404)
    if target_membership.role == ProjectMembership.ROLE_OWNER:
        return _json_error("The project owner role cannot be reassigned here.")

    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    next_role = (payload.get("role") or "").strip()
    if next_role not in {
        ProjectMembership.ROLE_ADMIN,
        ProjectMembership.ROLE_MEMBER,
        ProjectMembership.ROLE_VIEWER,
    }:
        return _json_error("Choose a valid project role.")

    target_membership.role = next_role
    target_membership.save(update_fields=["role", "updated_at"])
    _record_activity(
        project,
        request.user,
        "project.role_changed",
        f"Changed {target_membership.user.username}'s role to {next_role.title()}.",
    )
    if target_membership.user_id != request.user.id:
        Notification.objects.create(
            recipient=target_membership.user,
            actor=request.user,
            project=project,
            kind=Notification.KIND_SYSTEM,
            message=f"{request.user.username} changed your role in \"{project.name}\" to {next_role.title()}.",
        )
    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_member_remove_view(request, project_id: int, membership_id: int):
    project, membership, error = _load_project(project_id, request.user)
    if error:
        return error
    if not _role_at_least(membership, ProjectMembership.ROLE_ADMIN):
        return _json_error("Only admins and owners can remove users.", 403)

    target_membership = ProjectMembership.objects.filter(project=project, id=membership_id).select_related("user").first()
    if target_membership is None:
        return _json_error("Project member not found.", 404)
    if target_membership.role == ProjectMembership.ROLE_OWNER:
        return _json_error("The project owner cannot be removed.")

    username = target_membership.user.username
    target_membership.delete()
    _record_activity(
        project,
        request.user,
        "project.member_removed",
        f"Removed {username} from the project.",
    )
    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)})

@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_tasks_view(request, project_id: int):
    project, membership, error = _load_project(project_id, request.user)
    if error:
        return error
    if not _role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return _json_error("Only project members can create tasks.", 403)

    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

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
        return _json_error("Task title is required.")
    if status not in dict(Task.STATUS_CHOICES):
        return _json_error("Choose a valid task status.")
    if priority not in dict(Task.PRIORITY_CHOICES):
        return _json_error("Choose a valid task priority.")
    if placement not in {"sprint", "product"}:
        return _json_error("Choose a valid backlog placement.")

    bug_report = None
    if bug_report_id:
        bug_report = BugReport.objects.filter(project=project, id=bug_report_id).first()
        if bug_report is None:
            return _json_error("Bug report not found.", 404)

    sprint = _ensure_active_sprint(project) if project.use_sprints and placement == "sprint" else None
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
    assignees = _project_members_by_ids(project, assignee_ids)
    task.assignees.set(assignees)

    location_label = sprint.name if sprint else "Product Backlog"
    _record_activity(
        project,
        request.user,
        "task.created",
        f'Created task "{task.title}" in {location_label}.',
        task=task,
        bug_report=bug_report,
    )
    if assignees:
        _record_activity(
            project,
            request.user,
            "task.assigned",
            f"Assigned {', '.join(user.username for user in assignees)} to task \"{task.title}\".",
            task=task,
            bug_report=bug_report,
        )
        _notify_new_assignees(task, request.user, assignees)
    if mark_as_resolution and bug_report is not None:
        bug_report.resolution_task = task
        bug_report.save(update_fields=["resolution_task", "updated_at"])
        _record_activity(
            project,
            request.user,
            "bug.resolution_task_set",
            f'Set task "{task.title}" as the resolution task for bug "{bug_report.title}".',
            task=task,
            bug_report=bug_report,
        )
    _notify_mentions(
        project,
        request.user,
        description,
        task=task,
        bug_report=bug_report,
        context_label=f'task "{task.title}"',
    )
    _close_bugs_from_resolution_task(task, request.user)
    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)}, status=201)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_bug_import_view(request, project_id: int):
    project, membership, error = _load_project(project_id, request.user)
    if error:
        return error
    if not _role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return _json_error("Only project members can import GitHub issues as bugs.", 403)
    if not ProjectRepository.objects.filter(project=project).exists():
        return _json_error("Connect a GitHub repository before importing issues.")

    try:
        payload = _parse_json_body(request)
        repository_full_name, issue_number, issue_url, fallback_title, fallback_state = _parse_issue_reference(payload)
        _ensure_issue_repo_allowed(project, repository_full_name)
    except ValueError as exc:
        return _json_error(str(exc))

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
        return _json_error(
            f"That GitHub issue is already imported as bug \"{existing_link.bug_report.title}\".",
            409,
        )

    access_token = _get_project_github_access_token(project, request.user)
    if not access_token:
        return _json_error("Connect GitHub before importing issues.")

    try:
        issue = get_github_issue(access_token, repository_full_name, issue_number)
    except GitHubAPIError as exc:
        return _json_error(str(exc), exc.status_code)

    if issue.get("pull_request"):
        return _json_error("Pull requests cannot be imported as bug reports.")

    status = (payload.get("status") or BugReport.STATUS_OPEN).strip() or BugReport.STATUS_OPEN
    priority = (payload.get("priority") or BugReport.PRIORITY_MEDIUM).strip() or BugReport.PRIORITY_MEDIUM
    if status not in dict(BugReport.STATUS_CHOICES):
        return _json_error("Choose a valid bug report status.")
    if priority not in dict(BugReport.PRIORITY_CHOICES):
        return _json_error("Choose a valid bug report priority.")

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
    _record_activity(
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
    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)}, status=201)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_bugs_view(request, project_id: int):
    project, membership, error = _load_project(project_id, request.user)
    if error:
        return error
    if not _role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return _json_error("Only project members can create bug reports.", 403)

    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    title = (payload.get("title") or "").strip()
    description = (payload.get("description") or "").strip()
    status = (payload.get("status") or BugReport.STATUS_OPEN).strip() or BugReport.STATUS_OPEN
    priority = (payload.get("priority") or BugReport.PRIORITY_MEDIUM).strip() or BugReport.PRIORITY_MEDIUM
    if not title:
        return _json_error("Bug report title is required.")
    if status not in dict(BugReport.STATUS_CHOICES):
        return _json_error("Choose a valid bug report status.")
    if priority not in dict(BugReport.PRIORITY_CHOICES):
        return _json_error("Choose a valid bug report priority.")

    bug_report = BugReport.objects.create(
        project=project,
        title=title,
        description=description,
        reporter=request.user,
        status=status,
        priority=priority,
    )
    _record_activity(
        project,
        request.user,
        "bug.created",
        f"Reported bug \"{bug_report.title}\".",
        bug_report=bug_report,
    )
    _notify_mentions(
        project,
        request.user,
        description,
        bug_report=bug_report,
        context_label=f"bug report \"{bug_report.title}\"",
    )
    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)}, status=201)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def task_update_view(request, task_id: int):
    task = Task.objects.filter(id=task_id).select_related("project", "bug_report", "sprint").first()
    if task is None:
        return _json_error("Task not found.", 404)

    project, membership, error = _load_project(task.project_id, request.user)
    if error:
        return error
    if not _role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return _json_error("Only project members can update tasks.", 403)

    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    changed_fields = []
    if "title" in payload:
        title = (payload.get("title") or "").strip()
        if not title:
            return _json_error("Task title is required.")
        if title != task.title:
            task.title = title
            changed_fields.append("title")
    if "description" in payload:
        description = (payload.get("description") or "").strip()
        if description != task.description:
            task.description = description
            changed_fields.append("description")
            _notify_mentions(
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
            return _json_error("Choose a valid task status.")
        if next_status != task.status:
            previous_label = TASK_STATUS_LABELS.get(task.status, task.status)
            next_label = TASK_STATUS_LABELS.get(next_status, next_status)
            task.status = next_status
            changed_fields.append("status")
            _record_activity(
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
            return _json_error("Choose a valid task priority.")
        if next_priority != task.priority:
            previous_label = PRIORITY_LABELS.get(task.priority, task.priority)
            next_label = PRIORITY_LABELS.get(next_priority, next_priority)
            task.priority = next_priority
            changed_fields.append("priority")
            _record_activity(
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
            return _json_error("Choose a valid backlog placement.")
        next_sprint = _ensure_active_sprint(project) if project.use_sprints and placement == "sprint" else None
        if task.sprint_id != (next_sprint.id if next_sprint else None):
            previous_label = task.sprint.name if task.sprint else "Product Backlog"
            next_label = next_sprint.name if next_sprint else "Product Backlog"
            task.sprint = next_sprint
            changed_fields.append("sprint")
            _record_activity(
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
            _record_activity(
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
        next_assignees = _project_members_by_ids(project, requested_ids)
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
            _record_activity(
                project,
                request.user,
                "task.assignees_changed",
                f"Updated assignees on task \"{task.title}\": {'; '.join(changes)}.",
                task=task,
                bug_report=task.bug_report,
            )
            _notify_new_assignees(task, request.user, added_users)

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
            return _json_error("Choose valid bugs for this task to resolve.")

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
            _record_activity(
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
                _record_activity(
                    project,
                    request.user,
                    "bug.resolution_task_cleared",
                    f"Removed task \"{task.title}\" as the resolution task for bug \"{bug_report.title}\".",
                    task=task,
                    bug_report=bug_report,
                )

    _close_bugs_from_resolution_task(task, request.user)
    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def task_comment_view(request, task_id: int):
    task = Task.objects.filter(id=task_id).select_related("project", "bug_report").first()
    if task is None:
        return _json_error("Task not found.", 404)

    project, membership, error = _load_project(task.project_id, request.user)
    if error:
        return error
    if not _role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return _json_error("Only project members can comment on tasks.", 403)

    try:
        payload = _parse_json_body(request)
        anchor_type, anchor_id, anchor_label = _parse_comment_anchor(payload)
    except ValueError as exc:
        return _json_error(str(exc))

    body = (payload.get("body") or "").strip()
    if not body:
        return _json_error("Comment text is required.")

    TaskComment.objects.create(
        task=task,
        author=request.user,
        body=body,
        anchor_type=anchor_type,
        anchor_id=anchor_id,
        anchor_label=anchor_label,
    )
    _record_activity(
        project,
        request.user,
        "task.comment_added",
        f'Added {"an inline comment" if anchor_type else "a comment"} on task "{task.title}".',
        task=task,
        bug_report=task.bug_report,
    )
    _notify_mentions(
        project,
        request.user,
        body,
        task=task,
        bug_report=task.bug_report,
        context_label=f'task "{task.title}"',
    )
    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def task_comment_reaction_view(request, comment_id: int):
    comment = TaskComment.objects.filter(id=comment_id).select_related("task__project", "task__bug_report").first()
    if comment is None:
        return _json_error("Task comment not found.", 404)

    project, membership, error = _load_project(comment.task.project_id, request.user)
    if error:
        return error
    if not _role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return _json_error("Only project members can react to task comments.", 403)

    try:
        payload = _parse_json_body(request)
        emoji = _parse_comment_reaction(payload)
    except ValueError as exc:
        return _json_error(str(exc))

    reaction = TaskCommentReaction.objects.filter(comment=comment, user=request.user).first()
    if reaction and reaction.emoji == emoji:
        reaction.delete()
    elif reaction:
        reaction.emoji = emoji
        reaction.save(update_fields=["emoji", "updated_at"])
    else:
        TaskCommentReaction.objects.create(comment=comment, user=request.user, emoji=emoji)

    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)})
@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def task_issue_link_view(request, task_id: int):
    task = Task.objects.filter(id=task_id).select_related("project", "bug_report").first()
    if task is None:
        return _json_error("Task not found.", 404)

    project, membership, error = _load_project(task.project_id, request.user)
    if error:
        return error
    if not _role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return _json_error("Only project members can link GitHub issues.", 403)

    try:
        payload = _parse_json_body(request)
        repository_full_name, issue_number, issue_url, title, state = _parse_issue_reference(payload)
        _ensure_issue_repo_allowed(project, repository_full_name)
    except ValueError as exc:
        return _json_error(str(exc))

    access_token = _get_github_access_token(request.user) or _get_github_access_token(project.owner)
    title, issue_url, state = _refresh_issue_details(
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
        return _json_error("That GitHub issue is already linked to this task.", 409)

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
    _record_activity(
        project,
        request.user,
        "task.issue_linked",
        f"Linked {repository_full_name}#{issue_number} to task \"{task.title}\".",
        task=task,
        bug_report=task.bug_report,
    )
    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def task_branch_view(request, task_id: int):
    task = Task.objects.filter(id=task_id).select_related("project", "bug_report").first()
    if task is None:
        return _json_error("Task not found.", 404)

    project, membership, error = _load_project(task.project_id, request.user)
    if error:
        return error
    if not _role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return _json_error("Only project members can create branches.", 403)

    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    repository_id = payload.get("repositoryId")
    repository = None
    if repository_id:
        repository = ProjectRepository.objects.filter(project=project, id=repository_id).first()
    if repository is None:
        repository = ProjectRepository.objects.filter(project=project).first()
    if repository is None:
        return _json_error("This project does not have a connected repository.")

    suggested_branch_name = f"task-{task.id}-{slugify(task.title)[:40]}".strip("-") or f"task-{task.id}"
    branch_name = (payload.get("branchName") or suggested_branch_name).strip()
    base_branch = (payload.get("baseBranch") or repository.default_branch).strip() or repository.default_branch
    access_token = _get_github_access_token(request.user) or _get_github_access_token(project.owner)
    if not access_token:
        return _json_error("Connect GitHub before creating a branch.")

    try:
        branch_url = create_repository_branch(
            access_token,
            repository.full_name,
            base_branch,
            branch_name,
        )
    except GitHubAPIError as exc:
        return _json_error(str(exc), exc.status_code)

    task.branch_name = branch_name
    task.branch_url = branch_url
    task.branch_repository = repository
    task.save(update_fields=["branch_name", "branch_url", "branch_repository", "updated_at"])
    _record_activity(
        project,
        request.user,
        "task.branch_created",
        f"Created branch \"{branch_name}\" for task \"{task.title}\" in {repository.full_name}.",
        task=task,
        bug_report=task.bug_report,
    )
    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def bug_update_view(request, bug_id: int):
    bug_report = BugReport.objects.filter(id=bug_id).select_related("project", "reporter", "resolution_task").first()
    if bug_report is None:
        return _json_error("Bug report not found.", 404)

    project, membership, error = _load_project(bug_report.project_id, request.user)
    if error:
        return error
    if not _can_edit_bug(membership, bug_report, request.user):
        return _json_error("You do not have permission to update this bug report.", 403)

    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    changed = []
    if "title" in payload:
        title = (payload.get("title") or "").strip()
        if not title:
            return _json_error("Bug report title is required.")
        if title != bug_report.title:
            bug_report.title = title
            changed.append("title")
    if "description" in payload:
        description = (payload.get("description") or "").strip()
        if description != bug_report.description:
            bug_report.description = description
            changed.append("description")
            _notify_mentions(
                project,
                request.user,
                description,
                bug_report=bug_report,
                context_label=f"bug report \"{bug_report.title}\"",
            )
    if "status" in payload:
        status = (payload.get("status") or "").strip()
        if status not in dict(BugReport.STATUS_CHOICES):
            return _json_error("Choose a valid bug report status.")
        if status != bug_report.status:
            previous_label = BUG_STATUS_LABELS.get(bug_report.status, bug_report.status)
            next_label = BUG_STATUS_LABELS.get(status, status)
            bug_report.status = status
            changed.append("status")
            if status == BugReport.STATUS_CLOSED and not bug_report.closed_at:
                bug_report.closed_at = timezone.now()
            elif status != BugReport.STATUS_CLOSED:
                bug_report.closed_at = None
            _record_activity(
                project,
                request.user,
                "bug.status_changed",
                f"Changed bug \"{bug_report.title}\" from {previous_label} to {next_label}.",
                bug_report=bug_report,
            )
    if "priority" in payload:
        priority = (payload.get("priority") or "").strip()
        if priority not in dict(BugReport.PRIORITY_CHOICES):
            return _json_error("Choose a valid bug report priority.")
        if priority != bug_report.priority:
            previous_label = PRIORITY_LABELS.get(bug_report.priority, bug_report.priority)
            next_label = PRIORITY_LABELS.get(priority, priority)
            bug_report.priority = priority
            changed.append("priority")
            _record_activity(
                project,
                request.user,
                "bug.priority_changed",
                f"Changed bug \"{bug_report.title}\" priority from {previous_label} to {next_label}.",
                bug_report=bug_report,
            )

    if changed:
        bug_report.save()
        if any(field in changed for field in ["title", "description"]):
            _record_activity(
                project,
                request.user,
                "bug.updated",
                f"Updated bug report \"{bug_report.title}\" details.",
                bug_report=bug_report,
            )

    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def bug_comment_view(request, bug_id: int):
    bug_report = BugReport.objects.filter(id=bug_id).select_related("project").first()
    if bug_report is None:
        return _json_error("Bug report not found.", 404)

    project, membership, error = _load_project(bug_report.project_id, request.user)
    if error:
        return error
    if not _role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return _json_error("Only project members can comment on bug reports.", 403)

    try:
        payload = _parse_json_body(request)
        anchor_type, anchor_id, anchor_label = _parse_comment_anchor(payload)
    except ValueError as exc:
        return _json_error(str(exc))

    body = (payload.get("body") or "").strip()
    if not body:
        return _json_error("Comment text is required.")

    BugComment.objects.create(
        bug_report=bug_report,
        author=request.user,
        body=body,
        anchor_type=anchor_type,
        anchor_id=anchor_id,
        anchor_label=anchor_label,
    )
    _record_activity(
        project,
        request.user,
        "bug.comment_added",
        f'Added {"an inline comment" if anchor_type else "a comment"} on bug report "{bug_report.title}".',
        bug_report=bug_report,
    )
    _notify_mentions(
        project,
        request.user,
        body,
        bug_report=bug_report,
        context_label=f'bug report "{bug_report.title}"',
    )
    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def bug_comment_reaction_view(request, comment_id: int):
    comment = BugComment.objects.filter(id=comment_id).select_related("bug_report__project").first()
    if comment is None:
        return _json_error("Bug comment not found.", 404)

    project, membership, error = _load_project(comment.bug_report.project_id, request.user)
    if error:
        return error
    if not _role_at_least(membership, ProjectMembership.ROLE_MEMBER):
        return _json_error("Only project members can react to bug comments.", 403)

    try:
        payload = _parse_json_body(request)
        emoji = _parse_comment_reaction(payload)
    except ValueError as exc:
        return _json_error(str(exc))

    reaction = BugCommentReaction.objects.filter(comment=comment, user=request.user).first()
    if reaction and reaction.emoji == emoji:
        reaction.delete()
    elif reaction:
        reaction.emoji = emoji
        reaction.save(update_fields=["emoji", "updated_at"])
    else:
        BugCommentReaction.objects.create(comment=comment, user=request.user, emoji=emoji)

    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)})

@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def bug_issue_link_view(request, bug_id: int):
    bug_report = BugReport.objects.filter(id=bug_id).select_related("project", "reporter").first()
    if bug_report is None:
        return _json_error("Bug report not found.", 404)

    project, membership, error = _load_project(bug_report.project_id, request.user)
    if error:
        return error
    if not _can_edit_bug(membership, bug_report, request.user):
        return _json_error("You do not have permission to link issues to this bug report.", 403)

    try:
        payload = _parse_json_body(request)
        repository_full_name, issue_number, issue_url, title, state = _parse_issue_reference(payload)
        _ensure_issue_repo_allowed(project, repository_full_name)
    except ValueError as exc:
        return _json_error(str(exc))

    access_token = _get_github_access_token(request.user) or _get_github_access_token(project.owner)
    title, issue_url, state = _refresh_issue_details(
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
        return _json_error("That GitHub issue is already linked to this bug report.", 409)

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
    _record_activity(
        project,
        request.user,
        "bug.issue_linked",
        f"Linked {repository_full_name}#{issue_number} to bug report \"{bug_report.title}\".",
        bug_report=bug_report,
    )
    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def bug_resolution_view(request, bug_id: int):
    bug_report = BugReport.objects.filter(id=bug_id).select_related("project", "reporter", "resolution_task").first()
    if bug_report is None:
        return _json_error("Bug report not found.", 404)

    project, membership, error = _load_project(bug_report.project_id, request.user)
    if error:
        return error
    if not _can_edit_bug(membership, bug_report, request.user):
        return _json_error("You do not have permission to change the resolution task.", 403)

    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    task_id = payload.get("taskId")
    if task_id in [None, ""]:
        bug_report.resolution_task = None
        bug_report.save(update_fields=["resolution_task", "updated_at"])
        _record_activity(
            project,
            request.user,
            "bug.resolution_task_cleared",
            f"Cleared the resolution task for bug \"{bug_report.title}\".",
            bug_report=bug_report,
        )
        return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)})

    task = Task.objects.filter(project=project, id=task_id, bug_report=bug_report).first()
    if task is None:
        return _json_error("Choose a task created from this bug report.")

    bug_report.resolution_task = task
    bug_report.save(update_fields=["resolution_task", "updated_at"])
    _record_activity(
        project,
        request.user,
        "bug.resolution_task_set",
        f"Set task \"{task.title}\" as the resolution task for bug \"{bug_report.title}\".",
        task=task,
        bug_report=bug_report,
    )
    _close_bugs_from_resolution_task(task, request.user)
    return JsonResponse({"project": _build_project_snapshot(project, request.user, membership)})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def notification_read_view(request, notification_id: int):
    notification = Notification.objects.filter(id=notification_id, recipient=request.user).first()
    if notification is None:
        return _json_error("Notification not found.", 404)

    notification.is_read = True
    notification.save(update_fields=["is_read"])
    return JsonResponse({"notification": _serialize_notification(notification)})






