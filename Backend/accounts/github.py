import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings


GITHUB_API_BASE = "https://api.github.com"
GITHUB_AUTH_BASE = "https://github.com/login/oauth"
GITHUB_API_VERSION = "2022-11-28"
USER_AGENT = "team-project-manager"


class GitHubAPIError(Exception):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


def _parse_error_message(exc: HTTPError) -> str:
    try:
        payload = json.loads(exc.read().decode("utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return exc.reason or "GitHub request failed."

    return payload.get("error_description") or payload.get("message") or exc.reason


def _request_json(
    url: str,
    *,
    method: str = "GET",
    token: str | None = None,
    data: dict[str, Any] | None = None,
    extra_headers: dict[str, str] | None = None,
) -> Any:
    encoded_data = None
    headers = {
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
    }
    if extra_headers:
        headers.update(extra_headers)

    if token:
        headers["Authorization"] = f"Bearer {token}"
        headers["X-GitHub-Api-Version"] = GITHUB_API_VERSION

    if data is not None:
        encoded_data = urlencode(data).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"

    request = Request(url, data=encoded_data, headers=headers, method=method)

    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise GitHubAPIError(_parse_error_message(exc), exc.code) from exc
    except URLError as exc:
        raise GitHubAPIError(
            "Unable to reach GitHub. Check your network connection and OAuth app settings.",
            502,
        ) from exc


def build_github_authorization_url(state: str) -> str:
    if not settings.GITHUB_CLIENT_ID:
        raise GitHubAPIError("GitHub OAuth is not configured on the backend.", 503)

    query = urlencode(
        {
            "client_id": settings.GITHUB_CLIENT_ID,
            "redirect_uri": settings.GITHUB_OAUTH_REDIRECT_URI,
            "scope": "read:user repo",
            "state": state,
            "allow_signup": "true",
        }
    )
    return f"{GITHUB_AUTH_BASE}/authorize?{query}"


def exchange_code_for_access_token(code: str) -> str:
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        raise GitHubAPIError("GitHub OAuth is not configured on the backend.", 503)

    payload = _request_json(
        f"{GITHUB_AUTH_BASE}/access_token",
        method="POST",
        data={
            "client_id": settings.GITHUB_CLIENT_ID,
            "client_secret": settings.GITHUB_CLIENT_SECRET,
            "code": code,
            "redirect_uri": settings.GITHUB_OAUTH_REDIRECT_URI,
        },
    )

    access_token = payload.get("access_token")
    if not access_token:
        raise GitHubAPIError(
            payload.get("error_description") or "GitHub did not return an access token.",
            502,
        )

    return access_token


def get_github_user(access_token: str) -> dict[str, Any]:
    return _request_json(f"{GITHUB_API_BASE}/user", token=access_token)


def get_github_repositories(access_token: str) -> list[dict[str, Any]]:
    payload = _request_json(
        f"{GITHUB_API_BASE}/user/repos?per_page=100&sort=updated",
        token=access_token,
    )
    return payload if isinstance(payload, list) else []
