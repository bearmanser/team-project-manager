import base64
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps
from hashlib import sha256
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import HttpResponse, JsonResponse


ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _create_token(user_id: int, token_type: str, lifetime_seconds: int) -> str:
    now = datetime.now(timezone.utc)
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": str(user_id),
        "type": token_type,
        "jti": secrets.token_urlsafe(16),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=lifetime_seconds)).timestamp()),
    }

    encoded_header = _b64url_encode(
        json.dumps(header, separators=(",", ":")).encode("utf-8")
    )
    encoded_payload = _b64url_encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )
    signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")
    signature = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        signing_input,
        sha256,
    ).digest()
    encoded_signature = _b64url_encode(signature)
    return f"{encoded_header}.{encoded_payload}.{encoded_signature}"


def create_access_token(user_id: int) -> str:
    return _create_token(
        user_id,
        ACCESS_TOKEN_TYPE,
        settings.ACCESS_TOKEN_LIFETIME_SECONDS,
    )


def create_refresh_token(user_id: int) -> str:
    return _create_token(
        user_id,
        REFRESH_TOKEN_TYPE,
        settings.REFRESH_TOKEN_LIFETIME_SECONDS,
    )


def _decode_token(token: str, expected_type: str) -> dict[str, Any]:
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Malformed token.")

    encoded_header, encoded_payload, encoded_signature = parts
    signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")
    expected_signature = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        signing_input,
        sha256,
    ).digest()
    actual_signature = _b64url_decode(encoded_signature)

    if not hmac.compare_digest(expected_signature, actual_signature):
        raise ValueError("Invalid token signature.")

    payload = json.loads(_b64url_decode(encoded_payload).decode("utf-8"))
    if payload.get("type") != expected_type:
        raise ValueError("Unexpected token type.")

    exp = payload.get("exp")
    if not isinstance(exp, int) or exp <= int(datetime.now(timezone.utc).timestamp()):
        raise ValueError("Token expired.")

    return payload


def decode_access_token(token: str) -> dict[str, Any]:
    return _decode_token(token, ACCESS_TOKEN_TYPE)


def decode_refresh_token(token: str) -> dict[str, Any]:
    return _decode_token(token, REFRESH_TOKEN_TYPE)


def _cookie_kwargs(max_age: int) -> dict[str, Any]:
    cookie_kwargs: dict[str, Any] = {
        "max_age": max_age,
        "httponly": True,
        "secure": settings.AUTH_COOKIE_SECURE,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
        "path": settings.AUTH_COOKIE_PATH,
    }
    if settings.AUTH_COOKIE_DOMAIN:
        cookie_kwargs["domain"] = settings.AUTH_COOKIE_DOMAIN
    return cookie_kwargs


def _delete_cookie_kwargs() -> dict[str, Any]:
    cookie_kwargs: dict[str, Any] = {
        "path": settings.AUTH_COOKIE_PATH,
    }
    if settings.AUTH_COOKIE_DOMAIN:
        cookie_kwargs["domain"] = settings.AUTH_COOKIE_DOMAIN
    return cookie_kwargs


def set_access_token_cookie(response: HttpResponse, token: str) -> None:
    response.set_cookie(
        settings.AUTH_ACCESS_COOKIE_NAME,
        token,
        **_cookie_kwargs(settings.ACCESS_TOKEN_LIFETIME_SECONDS),
    )


def set_refresh_token_cookie(response: HttpResponse, token: str) -> None:
    response.set_cookie(
        settings.AUTH_REFRESH_COOKIE_NAME,
        token,
        **_cookie_kwargs(settings.REFRESH_TOKEN_LIFETIME_SECONDS),
    )


def set_auth_cookies(response: HttpResponse, user_id: int) -> None:
    set_access_token_cookie(response, create_access_token(user_id))
    set_refresh_token_cookie(response, create_refresh_token(user_id))


def clear_auth_cookies(response: HttpResponse) -> None:
    response.delete_cookie(
        settings.AUTH_ACCESS_COOKIE_NAME,
        **_delete_cookie_kwargs(),
    )
    response.delete_cookie(
        settings.AUTH_REFRESH_COOKIE_NAME,
        **_delete_cookie_kwargs(),
    )


def _auth_error(message: str) -> JsonResponse:
    response = JsonResponse({"error": message}, status=401)
    clear_auth_cookies(response)
    return response


def _extract_access_token(request) -> str:
    cookie_token = (request.COOKIES.get(settings.AUTH_ACCESS_COOKIE_NAME) or "").strip()
    if cookie_token:
        return cookie_token

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1].strip()

    return ""


def _extract_refresh_token(request) -> str:
    return (request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME) or "").strip()


def _using_cookie_auth(request) -> bool:
    return bool(
        request.COOKIES.get(settings.AUTH_ACCESS_COOKIE_NAME)
        or request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME)
    )


def _should_rotate_access_token(payload: dict[str, Any]) -> bool:
    exp = payload.get("exp")
    if not isinstance(exp, int):
        return True

    remaining_seconds = exp - int(datetime.now(timezone.utc).timestamp())
    return remaining_seconds <= settings.ACCESS_TOKEN_ROTATION_LEEWAY_SECONDS


def jwt_required(view_func):
    @wraps(view_func)
    def wrapped(request, *args, **kwargs):
        access_token = _extract_access_token(request)
        payload: dict[str, Any] | None = None
        user_id: int | None = None
        rotate_access_cookie = False
        cookie_auth = _using_cookie_auth(request)

        if access_token:
            try:
                payload = decode_access_token(access_token)
                user_id = int(payload["sub"])
                rotate_access_cookie = cookie_auth and _should_rotate_access_token(payload)
            except (KeyError, TypeError, ValueError):
                payload = None

        if user_id is None:
            refresh_token = _extract_refresh_token(request)
            if not refresh_token:
                return _auth_error(
                    "Invalid or expired token." if access_token else "Authentication required."
                )

            try:
                payload = decode_refresh_token(refresh_token)
                user_id = int(payload["sub"])
            except (KeyError, TypeError, ValueError):
                return _auth_error("Invalid or expired token.")

            rotate_access_cookie = cookie_auth

        user = get_user_model().objects.filter(id=user_id).first()
        if user is None:
            return _auth_error("User not found.")

        request.user = user
        request.auth_payload = payload

        response = view_func(request, *args, **kwargs)
        if rotate_access_cookie and isinstance(response, HttpResponse):
            set_access_token_cookie(response, create_access_token(user.id))

        return response

    return wrapped
