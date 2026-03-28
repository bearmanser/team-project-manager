import re

from .models import BugReport, ProjectMembership, Task


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
