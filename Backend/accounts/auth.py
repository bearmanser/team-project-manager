import base64
import hmac
import json
from datetime import datetime, timedelta, timezone
from functools import wraps
from hashlib import sha256
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import JsonResponse


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=settings.JWT_EXPIRATION_SECONDS)).timestamp()),
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


def decode_access_token(token: str) -> dict[str, Any]:
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
    exp = payload.get("exp")
    if not isinstance(exp, int) or exp <= int(datetime.now(timezone.utc).timestamp()):
        raise ValueError("Token expired.")

    return payload


def _extract_token(request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1].strip()

    return (request.GET.get("token") or "").strip()


def jwt_required(view_func):
    @wraps(view_func)
    def wrapped(request, *args, **kwargs):
        token = _extract_token(request)
        if not token:
            return JsonResponse({"error": "Authentication required."}, status=401)

        try:
            payload = decode_access_token(token)
            user_id = int(payload["sub"])
        except (KeyError, TypeError, ValueError):
            return JsonResponse({"error": "Invalid or expired token."}, status=401)

        user = get_user_model().objects.filter(id=user_id).first()
        if user is None:
            return JsonResponse({"error": "User not found."}, status=401)

        request.user = user
        request.auth_payload = payload
        return view_func(request, *args, **kwargs)

    return wrapped
