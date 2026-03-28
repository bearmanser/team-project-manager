from django.contrib.auth import get_user_model
from django.utils import timezone

from accounts.github import GitHubAPIError, get_github_issue
from accounts.models import UserProfile

from .constants import ISSUE_URL_PATTERN, MENTION_PATTERN, ROLE_ORDER
from .models import (
    Activity,
    BugReport,
    Notification,
    Organization,
    OrganizationMembership,
    Project,
    ProjectMembership,
    ProjectRepository,
    Sprint,
    Task,
    ensure_personal_organization,
)
from .utils import json_error


User = get_user_model()


def get_active_sprint(project: Project) -> Sprint | None:
    return Sprint.objects.filter(project=project, status=Sprint.STATUS_ACTIVE).order_by("-number", "-id").first()


def create_sprint(project: Project) -> Sprint:
    latest_sprint = Sprint.objects.filter(project=project).order_by("-number", "-id").first()
    next_number = (latest_sprint.number if latest_sprint else 0) + 1
    return Sprint.objects.create(
        project=project,
        number=next_number,
        name=f"Sprint {next_number}",
    )


def ensure_active_sprint(project: Project) -> Sprint:
    return get_active_sprint(project) or create_sprint(project)


def get_profile(user) -> UserProfile:
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile


def get_github_access_token(user) -> str:
    return get_profile(user).github_access_token or ""


def get_project_github_access_token(project: Project, user=None) -> str:
    if user is not None:
        access_token = get_github_access_token(user)
        if access_token:
            return access_token

    return get_github_access_token(project.owner)


def create_project_repository(project: Project, repo: dict) -> ProjectRepository:
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


def parse_selected_repository_id(payload: dict) -> str | None:
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


def active_organization_membership(organization: Organization, user) -> OrganizationMembership | None:
    if organization.owner_id == user.id:
        OrganizationMembership.objects.update_or_create(
            organization=organization,
            user=user,
            defaults={
                "role": OrganizationMembership.ROLE_OWNER,
                "status": OrganizationMembership.STATUS_ACTIVE,
                "invited_by": user,
            },
        )

    return (
        OrganizationMembership.objects.filter(
            organization=organization,
            user=user,
            status=OrganizationMembership.STATUS_ACTIVE,
        )
        .select_related("user")
        .first()
    )


def organization_role_for_user(organization: Organization, user) -> str | None:
    membership = active_organization_membership(organization, user)
    return membership.role if membership else None


def accessible_organizations(user) -> list[Organization]:
    ensure_personal_organization(user)
    return list(
        (
            Organization.objects.filter(owner=user)
            | Organization.objects.filter(
                memberships__user=user,
                memberships__status=OrganizationMembership.STATUS_ACTIVE,
            )
        )
        .distinct()
        .order_by("-updated_at", "-id")
    )


def organization_member_count(organization: Organization) -> int:
    return (
        OrganizationMembership.objects.filter(
            organization=organization,
            status=OrganizationMembership.STATUS_ACTIVE,
        )
        .values("user_id")
        .distinct()
        .count()
    )


def touch_organization(organization_id: int | None) -> None:
    if organization_id is None:
        return

    Organization.objects.filter(id=organization_id).update(updated_at=timezone.now())


def touch_project(project: Project) -> None:
    now = timezone.now()
    Project.objects.filter(id=project.id).update(updated_at=now)
    touch_organization(project.organization_id)


def can_manage_organization_members(role: str | None) -> bool:
    return role in {OrganizationMembership.ROLE_OWNER, OrganizationMembership.ROLE_ADMIN}


def load_organization(organization_id: int, user):
    ensure_personal_organization(user)
    organization = Organization.objects.filter(id=organization_id).select_related("owner").first()
    if organization is None:
        return None, None, json_error("Organization not found.", 404)

    membership = active_organization_membership(organization, user)
    if membership is None:
        return None, None, json_error("Organization not found.", 404)

    return organization, membership, None


def load_manageable_organization(organization_id: int, user):
    organization, membership, error = load_organization(organization_id, user)
    if error:
        return None, None, error
    if not can_manage_organization_members(membership.role):
        return None, None, json_error("Only admins and owners can manage this organization.", 403)
    if organization.is_personal:
        return None, None, json_error("Personal workspaces do not support sharing projects.", 403)

    return organization, membership, None


def can_manage_target_organization_membership(
    actor_membership: OrganizationMembership,
    target_membership: OrganizationMembership,
) -> bool:
    if actor_membership.role == OrganizationMembership.ROLE_OWNER:
        return True
    if actor_membership.role != OrganizationMembership.ROLE_ADMIN:
        return False
    return target_membership.user_id == actor_membership.user_id or target_membership.role not in {
        OrganizationMembership.ROLE_OWNER,
        OrganizationMembership.ROLE_ADMIN,
    }


def sync_project_membership_for_org_member(
    project: Project,
    organization_membership: OrganizationMembership,
) -> ProjectMembership:
    desired_role = (
        ProjectMembership.ROLE_OWNER
        if organization_membership.user_id == project.owner_id
        else organization_membership.role
    )
    membership, created = ProjectMembership.objects.get_or_create(
        project=project,
        user=organization_membership.user,
        defaults={
            "role": desired_role,
            "status": organization_membership.status,
            "added_by": organization_membership.invited_by,
        },
    )
    if created:
        return membership

    changed = []
    if membership.role != desired_role:
        membership.role = desired_role
        changed.append("role")
    if membership.status != organization_membership.status:
        membership.status = organization_membership.status
        changed.append("status")
    if membership.added_by_id is None and organization_membership.invited_by_id is not None:
        membership.added_by = organization_membership.invited_by
        changed.append("added_by")
    if changed:
        membership.save(update_fields=[*changed, "updated_at"])
    return membership


def sync_organization_memberships_to_project(project: Project) -> None:
    if project.organization_id is None:
        return

    memberships = OrganizationMembership.objects.filter(organization=project.organization)
    for organization_membership in memberships.select_related("user", "invited_by"):
        sync_project_membership_for_org_member(project, organization_membership)


def sync_organization_membership_to_projects(organization_membership: OrganizationMembership) -> None:
    projects = Project.objects.filter(organization=organization_membership.organization).select_related("owner")
    for project in projects:
        sync_project_membership_for_org_member(project, organization_membership)


def remove_organization_membership_from_projects(
    organization: Organization,
    user_id: int,
) -> None:
    ProjectMembership.objects.filter(project__organization=organization, user_id=user_id).delete()


def invite_user_to_organization(
    organization: Organization,
    actor,
    invited_user,
    role: str,
) -> OrganizationMembership:
    membership = OrganizationMembership.objects.create(
        organization=organization,
        user=invited_user,
        role=role,
        status=OrganizationMembership.STATUS_INVITED,
        invited_by=actor,
    )
    sync_organization_membership_to_projects(membership)
    Notification.objects.create(
        recipient=invited_user,
        actor=actor,
        organization=organization,
        kind=Notification.KIND_INVITE,
        message=f'{actor.username} invited you to "{organization.name}" as {role.title()}.',
        metadata={"organizationMembershipId": membership.id},
    )
    return membership


def activate_organization_invite(
    organization_membership: OrganizationMembership,
    notification: Notification | None = None,
) -> None:
    organization_membership.status = OrganizationMembership.STATUS_ACTIVE
    organization_membership.save(update_fields=["status", "updated_at"])
    sync_organization_membership_to_projects(organization_membership)

    if notification is not None:
        close_notification(notification)


def sharing_allowed(project: Project) -> bool:
    return not bool(project.organization and project.organization.is_personal)


def record_activity(
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
    touch_project(project)
    return activity


def load_project(project_id: int, user):
    project = (
        Project.objects.filter(id=project_id)
        .select_related("owner", "organization")
        .first()
    )
    if project is None:
        return None, None, json_error("Project not found.", 404)

    membership = (
        ProjectMembership.objects.filter(
            project=project,
            user=user,
            status=ProjectMembership.STATUS_ACTIVE,
        )
        .select_related("user")
        .first()
    )
    if membership is None:
        return None, None, json_error("Project not found.", 404)

    return project, membership, None


def load_owned_organization(organization_id: int, user):
    ensure_personal_organization(user)
    organization = Organization.objects.filter(id=organization_id, owner=user).first()
    if organization is None:
        return None, json_error("Organization not found.", 404)

    return organization, None


def role_at_least(membership: ProjectMembership, required_role: str) -> bool:
    return ROLE_ORDER.get(membership.role, -1) >= ROLE_ORDER[required_role]


def project_member_lookup(project: Project) -> dict[str, User]:
    return {
        membership.user.username.lower(): membership.user
        for membership in ProjectMembership.objects.filter(
            project=project,
            status=ProjectMembership.STATUS_ACTIVE,
        ).select_related("user")
    }


def mentioned_project_users(project: Project, text: str) -> list[User]:
    mentioned_usernames = {match.group(1).lower() for match in MENTION_PATTERN.finditer(text or "")}
    if not mentioned_usernames:
        return []

    member_lookup = project_member_lookup(project)
    mentioned_users: list[User] = []
    for username in sorted(mentioned_usernames):
        user = member_lookup.get(username)
        if user is not None:
            mentioned_users.append(user)
    return mentioned_users


def notify_mentions(
    project: Project,
    actor,
    text: str,
    *,
    task: Task | None = None,
    bug_report: BugReport | None = None,
    context_label: str,
) -> set[int]:
    notified_user_ids: set[int] = set()

    for user in mentioned_project_users(project, text):
        if user.id == actor.id:
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
        notified_user_ids.add(user.id)

    return notified_user_ids


def close_notification(notification: Notification) -> None:
    update_fields: list[str] = []
    if not notification.is_read:
        notification.is_read = True
        update_fields.append("is_read")
    if not notification.is_closed:
        notification.is_closed = True
        update_fields.append("is_closed")
    if update_fields:
        notification.save(update_fields=update_fields)


def close_related_notifications_for_user(
    user,
    *,
    task_id: int | None = None,
    bug_report_id: int | None = None,
) -> list[int]:
    if task_id is None and bug_report_id is None:
        return []

    notifications = Notification.objects.filter(
        recipient=user,
        is_closed=False,
    ).exclude(kind=Notification.KIND_INVITE)

    if task_id is not None and bug_report_id is not None:
        notifications = notifications.filter(task_id=task_id, bug_report_id=bug_report_id)
    elif task_id is not None:
        notifications = notifications.filter(task_id=task_id)
    else:
        notifications = notifications.filter(bug_report_id=bug_report_id)

    notification_ids = list(notifications.values_list("id", flat=True))
    if notification_ids:
        notifications.update(is_read=True, is_closed=True)
    return notification_ids


def notify_new_assignees(task: Task, actor, assignees: list[User]) -> None:
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


def notify_task_comment_assignees(
    task: Task,
    actor,
    *,
    excluded_user_ids: set[int] | None = None,
) -> None:
    skipped_user_ids = set(excluded_user_ids or set())
    skipped_user_ids.add(actor.id)

    for user in task.assignees.exclude(id__in=skipped_user_ids).order_by("username"):
        Notification.objects.create(
            recipient=user,
            actor=actor,
            project=task.project,
            task=task,
            bug_report=task.bug_report,
            kind=Notification.KIND_SYSTEM,
            message=f"{actor.username} commented on task \"{task.title}\" that you are assigned to.",
        )


def project_members_by_ids(project: Project, user_ids: list[int]) -> list[User]:
    if not user_ids:
        return []

    return list(
        User.objects.filter(
            project_memberships__project=project,
            project_memberships__status=ProjectMembership.STATUS_ACTIVE,
            id__in=user_ids,
        )
        .distinct()
        .order_by("username")
    )


def parse_issue_reference(payload: dict) -> tuple[str, int, str, str, str]:
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


def ensure_issue_repo_allowed(project: Project, repository_full_name: str) -> None:
    allowed = set(
        ProjectRepository.objects.filter(project=project).values_list("full_name", flat=True)
    )
    if repository_full_name not in allowed:
        raise ValueError("Issue links must belong to one of the project's connected repositories.")


def refresh_issue_details(
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


def close_bugs_from_resolution_task(task: Task, actor) -> None:
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
        record_activity(
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


def can_edit_bug(membership: ProjectMembership, bug_report: BugReport, user) -> bool:
    return role_at_least(membership, ProjectMembership.ROLE_ADMIN) or bug_report.reporter_id == user.id
