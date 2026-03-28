import re
from collections import defaultdict

from .constants import BOARD_COLUMNS, BUG_STATUS_LABELS, COMMENT_REACTION_EMOJIS, TASK_STATUS_LABELS
from .models import (
    Activity,
    BugComment,
    BugCommentReaction,
    BugReport,
    GitHubIssueLink,
    Notification,
    Organization,
    OrganizationMembership,
    Project,
    ProjectMembership,
    ProjectRepository,
    Sprint,
    Task,
    TaskComment,
    TaskCommentReaction,
)
from .services import (
    ensure_active_sprint,
    get_active_sprint,
    get_profile,
    organization_member_count,
    organization_role_for_user,
    role_at_least,
)


def serialize_board_columns() -> list[dict]:
    return [
        {
            "id": column["id"],
            "label": column["label"],
        }
        for column in BOARD_COLUMNS
    ]


def serialize_sprint_task_snapshot(task: Task) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "status": task.status,
        "priority": task.priority,
    }


def serialize_sprint(sprint: Sprint | None) -> dict | None:
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


def serialize_user(user) -> dict:
    profile = get_profile(user)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "githubConnected": bool(profile.github_access_token),
        "githubUsername": profile.github_username,
        "githubAvatarUrl": profile.github_avatar_url,
    }


def serialize_available_repo(repo: dict) -> dict:
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


def serialize_github_issue_candidate(repository: ProjectRepository, issue: dict) -> dict:
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


def serialize_organization_summary(organization: Organization, user) -> dict:
    role = organization_role_for_user(organization, user)
    display_name = user.username if organization.is_personal and organization.owner_id == user.id else organization.name
    return {
        "id": organization.id,
        "name": organization.name,
        "displayName": display_name,
        "description": organization.description,
        "isPersonal": organization.is_personal,
        "role": role or OrganizationMembership.ROLE_VIEWER,
        "memberCount": organization_member_count(organization),
        "projectCount": organization.projects.count(),
        "repoCount": ProjectRepository.objects.filter(project__organization=organization).count(),
        "openBugCount": BugReport.objects.filter(project__organization=organization)
        .exclude(status=BugReport.STATUS_CLOSED)
        .count(),
        "updatedAt": organization.updated_at.isoformat(),
    }


def serialize_organization_member(entry: OrganizationMembership) -> dict:
    project_names = list(
        Project.objects.filter(
            organization=entry.organization,
            memberships__user=entry.user,
        )
        .distinct()
        .order_by("name", "id")
        .values_list("name", flat=True)
    )
    return {
        "id": entry.id,
        "role": entry.role,
        "status": entry.status,
        "user": serialize_user(entry.user),
        "projectNames": project_names,
        "addedAt": entry.created_at.isoformat(),
    }


def serialize_permissions(membership: ProjectMembership) -> dict:
    return {
        "canCreateTasks": role_at_least(membership, ProjectMembership.ROLE_MEMBER),
        "canCreateBugReports": role_at_least(membership, ProjectMembership.ROLE_MEMBER),
        "canMoveTasks": role_at_least(membership, ProjectMembership.ROLE_MEMBER),
        "canAssignTasks": role_at_least(membership, ProjectMembership.ROLE_MEMBER),
        "canComment": role_at_least(membership, ProjectMembership.ROLE_MEMBER),
        "canEditTasks": role_at_least(membership, ProjectMembership.ROLE_MEMBER),
        "canEditBugs": role_at_least(membership, ProjectMembership.ROLE_ADMIN),
        "canManageUsers": role_at_least(membership, ProjectMembership.ROLE_ADMIN),
        "canManageProject": role_at_least(membership, ProjectMembership.ROLE_ADMIN),
        "canManageRepos": membership.role == ProjectMembership.ROLE_OWNER,
        "canDeleteProject": membership.role == ProjectMembership.ROLE_OWNER,
        "isReadOnly": membership.role == ProjectMembership.ROLE_VIEWER,
    }


def serialize_repository(repo: ProjectRepository) -> dict:
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


def serialize_issue_link(link: GitHubIssueLink) -> dict:
    return {
        "id": link.id,
        "repositoryFullName": link.repository_full_name,
        "issueNumber": link.issue_number,
        "title": link.title,
        "htmlUrl": link.html_url,
        "state": link.state,
        "createdAt": link.created_at.isoformat(),
    }


def serialize_comment_reactions(reactions: list, user_id: int | None) -> list[dict]:
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


def serialize_comment(comment, *, reactions: list, user_id: int | None) -> dict:
    return {
        "id": comment.id,
        "body": comment.body,
        "author": serialize_user(comment.author),
        "anchorType": getattr(comment, "anchor_type", ""),
        "anchorId": getattr(comment, "anchor_id", ""),
        "anchorLabel": getattr(comment, "anchor_label", ""),
        "reactions": serialize_comment_reactions(reactions, user_id),
        "createdAt": comment.created_at.isoformat(),
        "updatedAt": comment.updated_at.isoformat(),
    }


def serialize_activity(activity: Activity) -> dict:
    return {
        "id": activity.id,
        "action": activity.action,
        "description": activity.description,
        "actor": serialize_user(activity.actor) if activity.actor else None,
        "taskId": activity.task_id,
        "bugReportId": activity.bug_report_id,
        "metadata": activity.metadata,
        "createdAt": activity.created_at.isoformat(),
    }


def serialize_notification(notification: Notification) -> dict:
    action = None
    membership_id = notification.metadata.get("organizationMembershipId")
    if (
        notification.kind == Notification.KIND_INVITE
        and notification.organization_id
        and membership_id
        and not notification.is_read
    ):
        invite = OrganizationMembership.objects.filter(
            id=membership_id,
            organization_id=notification.organization_id,
            user_id=notification.recipient_id,
            status=OrganizationMembership.STATUS_INVITED,
        ).first()
        if invite is not None:
            action = {
                "type": "accept_organization_invite",
                "label": "Accept",
                "organizationMembershipId": invite.id,
            }

    return {
        "id": notification.id,
        "kind": notification.kind,
        "message": notification.message,
        "isRead": notification.is_read,
        "isClosed": notification.is_closed,
        "actor": serialize_user(notification.actor) if notification.actor else None,
        "organizationId": notification.organization_id,
        "projectId": notification.project_id,
        "taskId": notification.task_id,
        "bugReportId": notification.bug_report_id,
        "action": action,
        "createdAt": notification.created_at.isoformat(),
    }


def serialize_task_summary(task: Task, bug_report: BugReport | None = None) -> dict:
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


def serialize_resolved_bug_summary(bug_report: BugReport) -> dict:
    return {
        "id": bug_report.id,
        "title": bug_report.title,
        "status": bug_report.status,
        "priority": bug_report.priority,
    }


def serialize_task(
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
        "creator": serialize_user(task.creator),
        "assignees": [serialize_user(user) for user in task.assignees.all()],
        "sprintId": task.sprint_id,
        "sprintName": task.sprint.name if task.sprint else "",
        "bugReportId": task.bug_report_id,
        "bugReportTitle": bug_report.title if bug_report else "",
        "isResolutionTask": bool(bug_report and bug_report.resolution_task_id == task.id),
        "branchName": task.branch_name,
        "branchUrl": task.branch_url,
        "branchRepositoryId": task.branch_repository_id,
        "resolvedBugs": [serialize_resolved_bug_summary(item) for item in resolved_bugs],
        "directGitHubIssues": [serialize_issue_link(link) for link in direct_issue_links],
        "inheritedGitHubIssues": [serialize_issue_link(link) for link in inherited_issue_links],
        "comments": [
            serialize_comment(
                comment,
                reactions=task_comment_reactions_by_comment[comment.id],
                user_id=current_user_id,
            )
            for comment in task_comments
        ],
        "activity": [serialize_activity(activity) for activity in task_activities],
        "createdAt": task.created_at.isoformat(),
        "updatedAt": task.updated_at.isoformat(),
    }


def serialize_bug_report(
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
        "reporter": serialize_user(bug_report.reporter),
        "resolutionTaskId": bug_report.resolution_task_id,
        "resolutionTaskTitle": bug_report.resolution_task.title if bug_report.resolution_task else "",
        "linkedGitHubIssues": [serialize_issue_link(link) for link in issue_links],
        "tasks": [serialize_task_summary(task, bug_report) for task in bug_tasks],
        "comments": [
            serialize_comment(
                comment,
                reactions=bug_comment_reactions_by_comment[comment.id],
                user_id=current_user_id,
            )
            for comment in bug_comments
        ],
        "activity": [serialize_activity(activity) for activity in bug_activities],
        "closedAt": bug_report.closed_at.isoformat() if bug_report.closed_at else None,
        "createdAt": bug_report.created_at.isoformat(),
        "updatedAt": bug_report.updated_at.isoformat(),
    }


def serialize_project_summary(project: Project, membership: ProjectMembership) -> dict:
    return {
        "id": project.id,
        "organizationId": project.organization_id,
        "name": project.name,
        "description": project.description,
        "role": membership.role,
        "memberCount": project.memberships.filter(status=ProjectMembership.STATUS_ACTIVE).count(),
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


def build_project_snapshot(
    project: Project,
    user,
    membership: ProjectMembership | None = None,
) -> dict:
    membership = membership or (
        ProjectMembership.objects.filter(
            project=project,
            user=user,
            status=ProjectMembership.STATUS_ACTIVE,
        )
        .select_related("user")
        .first()
    )
    if membership is None:
        raise PermissionError("Project membership required.")

    active_sprint = ensure_active_sprint(project) if project.use_sprints else get_active_sprint(project)
    sprint_history = list(
        Sprint.objects.filter(project=project, status=Sprint.STATUS_COMPLETED).order_by("-number", "-id")
    )
    members = list(
        ProjectMembership.objects.filter(
            project=project,
            status=ProjectMembership.STATUS_ACTIVE,
        ).select_related("user")
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
        serialize_task(
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
        serialize_bug_report(
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
        serialize_activity(activity)
        for activity in sorted(activities, key=lambda item: item.created_at, reverse=True)[:40]
    ]

    return {
        "id": project.id,
        "organizationId": project.organization_id,
        "organizationName": project.organization.name if project.organization else "",
        "name": project.name,
        "description": project.description,
        "useSprints": project.use_sprints,
        "activeSprint": serialize_sprint(active_sprint),
        "sprintHistory": [serialize_sprint(item) for item in sprint_history],
        "ownerId": project.owner_id,
        "role": membership.role,
        "permissions": serialize_permissions(membership),
        "repositories": [serialize_repository(repo) for repo in repositories],
        "members": [
            {
                "id": item.id,
                "role": item.role,
                "user": serialize_user(item.user),
                "addedAt": item.created_at.isoformat(),
            }
            for item in members
        ],
        "boardColumns": serialize_board_columns(),
        "taskStatusLabels": TASK_STATUS_LABELS,
        "bugStatusLabels": BUG_STATUS_LABELS,
        "tasks": serialized_tasks,
        "bugReports": serialized_bugs,
        "recentActivity": recent_activity,
        "createdAt": project.created_at.isoformat(),
        "updatedAt": project.updated_at.isoformat(),
    }
