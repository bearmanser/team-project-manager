from .bugs import (
    bug_comment_reaction_view,
    bug_comment_view,
    bug_issue_link_view,
    bug_resolution_view,
    bug_update_view,
    project_bug_import_view,
    project_bugs_view,
    project_github_issues_view,
)
from .events import project_events_view
from .notifications import (
    notification_accept_view,
    notification_close_related_view,
    notification_read_view,
)
from .organizations import (
    organization_delete_view,
    organization_leave_view,
    organization_member_cancel_view,
    organization_member_remove_view,
    organization_member_role_view,
    organization_members_view,
    organization_settings_view,
    organizations_view,
)
from .projects import (
    project_delete_view,
    project_detail_view,
    project_member_remove_view,
    project_member_role_view,
    project_members_view,
    project_repo_add_view,
    project_repo_remove_view,
    project_settings_view,
    project_sprint_end_view,
    project_sprint_update_view,
    projects_view,
)
from .tasks import (
    project_tasks_view,
    task_branch_view,
    task_comment_reaction_view,
    task_comment_view,
    task_issue_link_view,
    task_update_view,
)
from .workspace import workspace_view
