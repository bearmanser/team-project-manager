from django.http import JsonResponse
from django.views.decorators.http import require_GET

from accounts.auth import jwt_required
from accounts.github import GitHubAPIError, get_github_repositories

from ..models import Notification, ProjectMembership
from ..serializers import (
    serialize_available_repo,
    serialize_notification,
    serialize_organization_summary,
    serialize_project_summary,
    serialize_user,
)
from ..services import accessible_organizations, get_github_access_token


@require_GET
@jwt_required
def workspace_view(request):
    memberships = list(
        ProjectMembership.objects.filter(user=request.user, status=ProjectMembership.STATUS_ACTIVE)
        .select_related("project", "project__owner", "project__organization")
        .order_by("-project__updated_at")
    )
    projects = [serialize_project_summary(item.project, item) for item in memberships]
    organizations = [
        serialize_organization_summary(organization, request.user)
        for organization in accessible_organizations(request.user)
    ]
    notifications = [
        serialize_notification(notification)
        for notification in Notification.objects.filter(
            recipient=request.user,
            is_closed=False,
        )
        .select_related("actor", "organization")[:20]
    ]

    available_repos: list[dict] = []
    github_repo_error = None
    access_token = get_github_access_token(request.user)
    if access_token:
        try:
            available_repos = [
                serialize_available_repo(repo)
                for repo in get_github_repositories(access_token)
            ]
        except GitHubAPIError as exc:
            github_repo_error = str(exc)

    return JsonResponse(
        {
            "user": serialize_user(request.user),
            "organizations": organizations,
            "projects": projects,
            "notifications": notifications,
            "availableRepos": available_repos,
            "githubRepoError": github_repo_error,
        }
    )
