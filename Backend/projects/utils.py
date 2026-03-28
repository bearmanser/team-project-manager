import json

from django.conf import settings
from django.http import JsonResponse

from .constants import (
    COMMENT_REACTION_EMOJIS,
    DEFAULT_PROJECT_EVENTS_POLL_INTERVAL_SECONDS,
    DEFAULT_PROJECT_EVENTS_RETRY_MS,
    INLINE_COMMENT_ANCHORS,
)


def get_project_events_retry_ms() -> int:
    value = getattr(settings, "PROJECT_EVENTS_RETRY_MS", DEFAULT_PROJECT_EVENTS_RETRY_MS)
    try:
        return max(500, int(value))
    except (TypeError, ValueError):
        return DEFAULT_PROJECT_EVENTS_RETRY_MS


def get_project_events_poll_interval_seconds() -> float:
    value = getattr(
        settings,
        "PROJECT_EVENTS_POLL_INTERVAL_SECONDS",
        DEFAULT_PROJECT_EVENTS_POLL_INTERVAL_SECONDS,
    )
    try:
        return max(0.1, float(value))
    except (TypeError, ValueError):
        return DEFAULT_PROJECT_EVENTS_POLL_INTERVAL_SECONDS


def parse_comment_anchor(payload: dict) -> tuple[str, str, str]:
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


def parse_comment_reaction(payload: dict) -> str:
    emoji = str(payload.get("emoji") or "").strip()
    if emoji not in COMMENT_REACTION_EMOJIS:
        raise ValueError("Choose a valid reaction emoji.")
    return emoji


def json_error(message: str, status: int = 400) -> JsonResponse:
    return JsonResponse({"error": message}, status=status)


def parse_json_body(request) -> dict:
    if not request.body:
        return {}

    try:
        return json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("Invalid JSON payload.") from exc
