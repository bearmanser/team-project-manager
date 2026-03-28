from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from accounts.auth import jwt_required
from accounts.github import GitHubAPIError, get_github_repositories

from ..constants import UNFINISHED_SPRINT_ACTIONS
from ..models import Notification, OrganizationMembership, Project, ProjectMembership, ProjectRepository, Sprint, Task
from ..serializers import build_project_snapshot, serialize_project_summary, serialize_sprint_task_snapshot
from ..services import (
    active_organization_membership,
    can_manage_target_organization_membership,
    close_bugs_from_resolution_task,
    create_project_repository,
    create_sprint,
    ensure_active_sprint,
    get_active_sprint,
    get_github_access_token,
    invite_user_to_organization,
    load_organization,
    load_project,
    parse_selected_repository_id,
    record_activity,
    remove_organization_membership_from_projects,
    role_at_least,
    sharing_allowed,
    sync_organization_membership_to_projects,
    sync_organization_memberships_to_project,
    touch_organization,
)
from ..utils import json_error, parse_json_body


User = get_user_model()


def _project_response(project: Project, user, membership: ProjectMembership, status: int = 200) -> JsonResponse:
    return JsonResponse({"project": build_project_snapshot(project, user, membership)}, status=status)


@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def projects_view(request):
    if request.method == "GET":
        memberships = list(
            ProjectMembership.objects.filter(user=request.user, status=ProjectMembership.STATUS_ACTIVE)
            .select_related("project", "project__organization")
            .order_by("-project__updated_at")
        )
        return JsonResponse(
            {"projects": [serialize_project_summary(item.project, item) for item in memberships]}
        )

    try:
        payload = parse_json_body(request)
    except ValueError as exc:
        return json_error(str(exc))

    organization_id = payload.get("organizationId")
    name = (payload.get("name") or "").strip()
    description = (payload.get("description") or "").strip()

    try:
        repository_id = parse_selected_repository_id(payload)
    except ValueError as exc:
        return json_error(str(exc))
    try:
        organization_id = int(organization_id)
    except (TypeError, ValueError):
        return json_error("Choose an organization for the new project.")

    organization, organization_membership, error = load_organization(organization_id, request.user)
    if error:
        return error
    if organization_membership.role not in {OrganizationMembership.ROLE_OWNER, OrganizationMembership.ROLE_ADMIN}:
        return json_error("Only admins and owners can create projects in this organization.", 403)

    if not name:
        return json_error("Project name is required.")

    selected_repo = None
    if repository_id:
        access_token = get_github_access_token(request.user)
        if not access_token:
            return json_error("Connect your GitHub account before selecting a GitHub repository.")

        try:
            available_repos = get_github_repositories(access_token)
        except GitHubAPIError as exc:
            return json_error(str(exc), exc.status_code)

        available_repo_map = {str(repo.get("id")): repo for repo in available_repos}
        selected_repo = available_repo_map.get(repository_id)
        if selected_repo is None:
            return json_error("The selected repository is no longer available.")

    project = Project.objects.create(
        name=name,
        description=description,
        organization=organization,
        owner=organization.owner,
    )
    sync_organization_memberships_to_project(project)
    membership = (
        ProjectMembership.objects.filter(
            project=project,
            user=request.user,
            status=ProjectMembership.STATUS_ACTIVE,
        )
        .select_related("user")
        .first()
    )
    if membership is None:
        membership = ProjectMembership.objects.create(
            project=project,
            user=request.user,
            role=ProjectMembership.ROLE_OWNER if request.user.id == project.owner_id else organization_membership.role,
            status=ProjectMembership.STATUS_ACTIVE,
            added_by=request.user,
        )
    if selected_repo is not None:
        create_project_repository(project, selected_repo)

    repo_description = " and connected a GitHub repository." if selected_repo else " without a connected GitHub repository."
    record_activity(
        project,
        request.user,
        "project.created",
        f"Created project \"{project.name}\" inside \"{organization.name}\"{repo_description}",
    )
    return _project_response(project, request.user, membership, status=201)


@require_GET
@jwt_required
def project_detail_view(request, project_id: int):
    project, membership, error = load_project(project_id, request.user)
    if error:
        return error

    return _project_response(project, request.user, membership)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_settings_view(request, project_id: int):
    project, membership, error = load_project(project_id, request.user)
    if error:
        return error
    if not role_at_least(membership, ProjectMembership.ROLE_ADMIN):
        return json_error("Only project admins can update project settings.", 403)

    try:
        payload = parse_json_body(request)
    except ValueError as exc:
        return json_error(str(exc))

    name = (payload.get("name") or "").strip()
    description = (payload.get("description") or "").strip()
    use_sprints = bool(payload.get("useSprints"))
    if not name:
        return json_error("Project name is required.")

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
        ensure_active_sprint(project)

    if changed:
        record_activity(
            project,
            request.user,
            "project.updated",
            f"Updated project settings ({', '.join(changed)}).",
        )

    return _project_response(project, request.user, membership)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_delete_view(request, project_id: int):
    project, membership, error = load_project(project_id, request.user)
    if error:
        return error
    if membership.role != ProjectMembership.ROLE_OWNER:
        return json_error("Only the project owner can delete the project.", 403)

    deleted_project_id = project.id
    organization_id = project.organization_id
    project.delete()
    touch_organization(organization_id)
    return JsonResponse({"success": True, "projectId": deleted_project_id})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_sprint_end_view(request, project_id: int):
    project, membership, error = load_project(project_id, request.user)
    if error:
        return error
    if not role_at_least(membership, ProjectMembership.ROLE_ADMIN):
        return json_error("Only admins and owners can end a sprint.", 403)
    if not project.use_sprints:
        return json_error("Enable sprint mode before ending a sprint.")

    active_sprint = get_active_sprint(project)
    if active_sprint is None:
        return json_error("There is no active sprint to end.", 404)

    try:
        payload = parse_json_body(request)
    except ValueError as exc:
        return json_error(str(exc))

    review_text = (payload.get("reviewText") or "").strip()
    unfinished_action = (payload.get("unfinishedAction") or "carryover").strip() or "carryover"
    if unfinished_action not in UNFINISHED_SPRINT_ACTIONS:
        return json_error("Choose a valid action for unfinished sprint tasks.")

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

    next_sprint = create_sprint(project)

    if unfinished_action == "done":
        for task in unfinished_tasks:
            task.status = Task.STATUS_DONE
            task.save(update_fields=["status", "updated_at"])
            close_bugs_from_resolution_task(task, request.user)
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
        "completedTasks": [serialize_sprint_task_snapshot(task) for task in completed_task_snapshots],
        "carryoverTasks": [serialize_sprint_task_snapshot(task) for task in carryover_tasks],
        "returnedToProductTasks": [
            serialize_sprint_task_snapshot(task) for task in returned_to_product_tasks
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

    record_activity(
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

    return _project_response(project, request.user, membership)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_sprint_update_view(request, project_id: int, sprint_id: int):
    project, membership, error = load_project(project_id, request.user)
    if error:
        return error
    if not role_at_least(membership, ProjectMembership.ROLE_ADMIN):
        return json_error("Only admins and owners can rename sprints.", 403)

    sprint = Sprint.objects.filter(project=project, id=sprint_id).first()
    if sprint is None:
        return json_error("Sprint not found.", 404)

    try:
        payload = parse_json_body(request)
    except ValueError as exc:
        return json_error(str(exc))

    name = (payload.get("name") or "").strip()
    if not name:
        return json_error("Sprint name is required.")

    if name != sprint.name:
        previous_name = sprint.name
        sprint.name = name
        sprint.save(update_fields=["name", "updated_at"])
        record_activity(
            project,
            request.user,
            "sprint.renamed",
            f'Renamed sprint "{previous_name}" to "{name}".',
            metadata={"sprintId": sprint.id},
        )

    return _project_response(project, request.user, membership)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_repo_add_view(request, project_id: int):
    project, membership, error = load_project(project_id, request.user)
    if error:
        return error
    if membership.role != ProjectMembership.ROLE_OWNER:
        return json_error("Only the project owner can connect a repository.", 403)

    access_token = get_github_access_token(request.user)
    if not access_token:
        return json_error("Connect GitHub before connecting a repository.")

    try:
        payload = parse_json_body(request)
        repository_id = parse_selected_repository_id(payload)
    except ValueError as exc:
        return json_error(str(exc))

    if not repository_id:
        return json_error("Choose a repository to connect.")

    existing_repository = project.repositories.order_by("id").first()
    if existing_repository is not None:
        if existing_repository.github_repo_id == repository_id:
            return json_error("That repository is already connected to this project.")
        return json_error("This project already has a connected repository. Remove it first to connect a different one.")

    try:
        available_repos = get_github_repositories(access_token)
    except GitHubAPIError as exc:
        return json_error(str(exc), exc.status_code)

    available_repo_map = {str(repo.get("id")): repo for repo in available_repos}
    repo = available_repo_map.get(repository_id)
    if repo is None:
        return json_error("The selected repository is no longer available.")

    create_project_repository(project, repo)
    record_activity(
        project,
        request.user,
        "project.repo_added",
        f"Connected GitHub repository \"{repo.get('full_name') or repo.get('name') or repository_id}\" to the project.",
    )
    return _project_response(project, request.user, membership)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_repo_remove_view(request, project_id: int, repository_id: int):
    project, membership, error = load_project(project_id, request.user)
    if error:
        return error
    if membership.role != ProjectMembership.ROLE_OWNER:
        return json_error("Only the project owner can disconnect the repository.", 403)

    repository = ProjectRepository.objects.filter(project=project, id=repository_id).first()
    if repository is None:
        return json_error("Repository not found.", 404)

    full_name = repository.full_name
    repository.delete()
    record_activity(
        project,
        request.user,
        "project.repo_removed",
        f"Disconnected GitHub repository \"{full_name}\" from the project.",
    )
    return _project_response(project, request.user, membership)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_members_view(request, project_id: int):
    project, membership, error = load_project(project_id, request.user)
    if error:
        return error
    if not role_at_least(membership, ProjectMembership.ROLE_ADMIN):
        return json_error("Only admins and owners can manage users.", 403)
    if not sharing_allowed(project):
        return json_error("Personal workspaces do not support sharing projects.", 403)

    try:
        payload = parse_json_body(request)
    except ValueError as exc:
        return json_error(str(exc))

    identifier = (payload.get("identifier") or "").strip()
    role = (payload.get("role") or ProjectMembership.ROLE_MEMBER).strip()
    if not identifier:
        return json_error("Provide a username or email address.")
    if role not in {
        ProjectMembership.ROLE_ADMIN,
        ProjectMembership.ROLE_MEMBER,
        ProjectMembership.ROLE_VIEWER,
    }:
        return json_error("Choose a valid project role.")

    if "@" in identifier:
        user = User.objects.filter(email__iexact=identifier).first()
    else:
        user = User.objects.filter(username__iexact=identifier).first()
    if user is None:
        return json_error("That user does not exist yet.", 404)

    existing_membership = OrganizationMembership.objects.filter(
        organization=project.organization,
        user=user,
    ).first()
    if existing_membership is not None:
        if existing_membership.status == OrganizationMembership.STATUS_INVITED:
            return json_error("That user already has a pending invite.", 409)
        return json_error("That user is already part of this organization.", 409)

    invite_user_to_organization(project.organization, request.user, user, role)
    record_activity(
        project,
        request.user,
        "project.member_invited",
        f"Invited {user.username} to the organization as {role.title()}.",
    )
    return _project_response(project, request.user, membership)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_member_role_view(request, project_id: int, membership_id: int):
    project, membership, error = load_project(project_id, request.user)
    if error:
        return error
    if not role_at_least(membership, ProjectMembership.ROLE_ADMIN):
        return json_error("Only admins and owners can change roles.", 403)

    target_membership = ProjectMembership.objects.filter(project=project, id=membership_id).select_related("user").first()
    if target_membership is None:
        return json_error("Project member not found.", 404)
    if target_membership.role == ProjectMembership.ROLE_OWNER:
        return json_error("The project owner role cannot be reassigned here.")

    try:
        payload = parse_json_body(request)
    except ValueError as exc:
        return json_error(str(exc))

    next_role = (payload.get("role") or "").strip()
    if next_role not in {
        ProjectMembership.ROLE_ADMIN,
        ProjectMembership.ROLE_MEMBER,
        ProjectMembership.ROLE_VIEWER,
    }:
        return json_error("Choose a valid project role.")

    if project.organization_id:
        actor_org_membership = active_organization_membership(project.organization, request.user)
        target_org_membership = OrganizationMembership.objects.filter(
            organization=project.organization,
            user=target_membership.user,
        ).first()
        if actor_org_membership is None or target_org_membership is None:
            return json_error("Organization member not found.", 404)
        if not can_manage_target_organization_membership(actor_org_membership, target_org_membership):
            return json_error("You do not have permission to change that role.", 403)
        if (
            actor_org_membership.role == OrganizationMembership.ROLE_ADMIN
            and next_role == OrganizationMembership.ROLE_ADMIN
        ):
            return json_error("Only the organization owner can assign the admin role.", 403)
        target_org_membership.role = next_role
        target_org_membership.save(update_fields=["role", "updated_at"])
        sync_organization_membership_to_projects(target_org_membership)
    else:
        target_membership.role = next_role
        target_membership.save(update_fields=["role", "updated_at"])
    record_activity(
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
    return _project_response(project, request.user, membership)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def project_member_remove_view(request, project_id: int, membership_id: int):
    project, membership, error = load_project(project_id, request.user)
    if error:
        return error
    if not role_at_least(membership, ProjectMembership.ROLE_ADMIN):
        return json_error("Only admins and owners can remove users.", 403)

    target_membership = ProjectMembership.objects.filter(project=project, id=membership_id).select_related("user").first()
    if target_membership is None:
        return json_error("Project member not found.", 404)
    if target_membership.role == ProjectMembership.ROLE_OWNER:
        return json_error("The project owner cannot be removed.")
    if target_membership.user_id == request.user.id:
        return json_error("Use leave organization instead of removing yourself.", 400)

    username = target_membership.user.username
    if project.organization_id:
        actor_org_membership = active_organization_membership(project.organization, request.user)
        target_org_membership = OrganizationMembership.objects.filter(
            organization=project.organization,
            user=target_membership.user,
        ).first()
        if actor_org_membership is None or target_org_membership is None:
            return json_error("Organization member not found.", 404)
        if not can_manage_target_organization_membership(actor_org_membership, target_org_membership):
            return json_error("You do not have permission to remove that user.", 403)
        remove_organization_membership_from_projects(project.organization, target_membership.user_id)
        target_org_membership.delete()
    else:
        target_membership.delete()
    record_activity(
        project,
        request.user,
        "project.member_removed",
        f"Removed {username} from the project.",
    )
    return _project_response(project, request.user, membership)
