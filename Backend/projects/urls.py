from django.urls import path

from . import views


urlpatterns = [
    path("workspace/", views.workspace_view, name="workspace"),
    path("organizations/", views.organizations_view, name="organizations"),
    path("projects/", views.projects_view, name="projects"),
    path("projects/<int:project_id>/", views.project_detail_view, name="project-detail"),
    path("projects/<int:project_id>/events/", views.project_events_view, name="project-events"),
    path("projects/<int:project_id>/settings/", views.project_settings_view, name="project-settings"),
    path("projects/<int:project_id>/delete/", views.project_delete_view, name="project-delete"),
    path("projects/<int:project_id>/sprints/end/", views.project_sprint_end_view, name="project-sprint-end"),
    path("projects/<int:project_id>/repos/add/", views.project_repo_add_view, name="project-repo-add"),
    path(
        "projects/<int:project_id>/repos/<int:repository_id>/remove/",
        views.project_repo_remove_view,
        name="project-repo-remove",
    ),
    path("projects/<int:project_id>/members/", views.project_members_view, name="project-members"),
    path(
        "projects/<int:project_id>/members/<int:membership_id>/role/",
        views.project_member_role_view,
        name="project-member-role",
    ),
    path(
        "projects/<int:project_id>/members/<int:membership_id>/remove/",
        views.project_member_remove_view,
        name="project-member-remove",
    ),
    path("projects/<int:project_id>/tasks/", views.project_tasks_view, name="project-tasks"),
    path("projects/<int:project_id>/bugs/", views.project_bugs_view, name="project-bugs"),
    path("tasks/<int:task_id>/update/", views.task_update_view, name="task-update"),
    path("tasks/<int:task_id>/comments/", views.task_comment_view, name="task-comment"),
    path("tasks/<int:task_id>/issues/", views.task_issue_link_view, name="task-issue-link"),
    path("tasks/<int:task_id>/branch/", views.task_branch_view, name="task-branch"),
    path("bugs/<int:bug_id>/update/", views.bug_update_view, name="bug-update"),
    path("bugs/<int:bug_id>/comments/", views.bug_comment_view, name="bug-comment"),
    path("bugs/<int:bug_id>/issues/", views.bug_issue_link_view, name="bug-issue-link"),
    path("bugs/<int:bug_id>/resolution/", views.bug_resolution_view, name="bug-resolution"),
    path(
        "notifications/<int:notification_id>/read/",
        views.notification_read_view,
        name="notification-read",
    ),
]
