import json
import secrets

from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core import signing
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from .auth import create_access_token, jwt_required
from .github import (
    GitHubAPIError,
    build_github_authorization_url,
    exchange_code_for_access_token,
    get_github_repositories,
    get_github_user,
)
from .models import UserProfile
from projects.models import ensure_personal_organization


User = get_user_model()


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


def _serialize_repo(repo: dict) -> dict:
    owner = repo.get("owner") or {}
    return {
        "id": repo.get("id"),
        "name": repo.get("name"),
        "fullName": repo.get("full_name"),
        "description": repo.get("description") or "",
        "htmlUrl": repo.get("html_url"),
        "language": repo.get("language") or "Unknown",
        "stargazersCount": repo.get("stargazers_count", 0),
        "visibility": "private" if repo.get("private") else "public",
        "updatedAt": repo.get("updated_at"),
        "owner": owner.get("login", ""),
    }


def _auth_response(user, status: int = 200) -> JsonResponse:
    return JsonResponse(
        {
            "accessToken": create_access_token(user.id),
            "user": _serialize_user(user),
        },
        status=status,
    )


def _get_login_user(identifier: str):
    if "@" in identifier:
        return User.objects.filter(email__iexact=identifier).first()
    return User.objects.filter(username__iexact=identifier).first()


@csrf_exempt
@require_http_methods(["POST"])
def signup_view(request):
    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    username = (payload.get("username") or "").strip()
    email = (payload.get("email") or "").strip()
    password = payload.get("password") or ""

    if not username or not email or not password:
        return _json_error("Username, email, and password are required.")

    if User.objects.filter(username__iexact=username).exists():
        return _json_error("That username is already in use.", 409)

    if User.objects.filter(email__iexact=email).exists():
        return _json_error("That email is already in use.", 409)

    candidate_user = User(username=username, email=email)
    try:
        validate_password(password, user=candidate_user)
    except ValidationError as exc:
        return _json_error(" ".join(exc.messages))

    user = User.objects.create_user(username=username, email=email, password=password)
    _get_profile(user)
    ensure_personal_organization(user)
    return _auth_response(user, status=201)


@csrf_exempt
@require_http_methods(["POST"])
def login_view(request):
    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    identifier = (payload.get("identifier") or "").strip()
    password = payload.get("password") or ""

    if not identifier or not password:
        return _json_error("Identifier and password are required.")

    user_record = _get_login_user(identifier)
    if user_record is None:
        return _json_error("Invalid credentials.", 401)

    user = authenticate(request, username=user_record.username, password=password)
    if user is None:
        return _json_error("Invalid credentials.", 401)

    _get_profile(user)
    return _auth_response(user)


@require_GET
@jwt_required
def me_view(request):
    return JsonResponse({"user": _serialize_user(request.user)})


@require_GET
@jwt_required
def github_oauth_start_view(request):
    try:
        state = signing.dumps(
            {
                "user_id": request.user.id,
                "nonce": secrets.token_urlsafe(16),
            },
            salt="github-oauth-state",
        )
        authorization_url = build_github_authorization_url(state)
    except GitHubAPIError as exc:
        return _json_error(str(exc), exc.status_code)

    return JsonResponse({"authorizationUrl": authorization_url})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def github_oauth_complete_view(request):
    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    code = (payload.get("code") or "").strip()
    state = (payload.get("state") or "").strip()
    if not code or not state:
        return _json_error("GitHub code and state are required.")

    try:
        state_payload = signing.loads(
            state,
            salt="github-oauth-state",
            max_age=600,
        )
    except signing.BadSignature:
        return _json_error("The GitHub OAuth state is invalid or expired.", 400)

    if state_payload.get("user_id") != request.user.id:
        return _json_error("That GitHub OAuth session does not belong to this user.", 403)

    try:
        access_token = exchange_code_for_access_token(code)
        github_user = get_github_user(access_token)
        github_user_id = str(github_user.get("id"))

        existing_profile = UserProfile.objects.filter(github_user_id=github_user_id).exclude(
            user=request.user
        )
        if existing_profile.exists():
            return _json_error("That GitHub account is already linked to another user.", 409)

        profile = _get_profile(request.user)
        profile.github_user_id = github_user_id
        profile.github_username = github_user.get("login", "")
        profile.github_avatar_url = github_user.get("avatar_url", "")
        profile.github_access_token = access_token
        profile.github_connected_at = timezone.now()
        profile.save()

        repos = get_github_repositories(access_token)
    except GitHubAPIError as exc:
        return _json_error(str(exc), exc.status_code)

    return JsonResponse(
        {
            "user": _serialize_user(request.user),
            "repos": [_serialize_repo(repo) for repo in repos],
        }
    )


@require_GET
@jwt_required
def github_repos_view(request):
    profile = _get_profile(request.user)
    if not profile.github_access_token:
        return _json_error("Connect a GitHub account first.", 400)

    try:
        repos = get_github_repositories(profile.github_access_token)
    except GitHubAPIError as exc:
        return _json_error(str(exc), exc.status_code)

    return JsonResponse({"repos": [_serialize_repo(repo) for repo in repos]})

