from django.conf import settings
from django.db import models


LEGACY_PERSONAL_ORGANIZATION_DESCRIPTION = "Default workspace created for existing projects."
PERSONAL_ORGANIZATION_DESCRIPTION = "Your personal workspace."


def build_personal_organization_name(user) -> str:
    return f"{user.username} workspace"


class Organization(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_personal = models.BooleanField(default=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_organizations",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["owner"],
                condition=models.Q(is_personal=True),
                name="projects_single_personal_organization_per_owner",
            )
        ]

    def __str__(self) -> str:
        return f"Organization<{self.name}>"


class OrganizationMembership(models.Model):
    ROLE_OWNER = "owner"
    ROLE_ADMIN = "admin"
    ROLE_MEMBER = "member"
    ROLE_VIEWER = "viewer"
    STATUS_INVITED = "invited"
    STATUS_ACTIVE = "active"

    ROLE_CHOICES = [
        (ROLE_OWNER, "Owner"),
        (ROLE_ADMIN, "Admin"),
        (ROLE_MEMBER, "Member"),
        (ROLE_VIEWER, "Viewer"),
    ]
    STATUS_CHOICES = [
        (STATUS_INVITED, "Invited"),
        (STATUS_ACTIVE, "Active"),
    ]

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="organization_memberships",
    )
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default=ROLE_MEMBER)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="created_organization_memberships",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("organization", "user")]
        ordering = ["user__username", "id"]

    def __str__(self) -> str:
        return (
            f"OrganizationMembership<{self.organization_id}:{self.user_id}:{self.role}:{self.status}>"
        )


def _ensure_owner_organization_membership(organization: Organization) -> Organization:
    OrganizationMembership.objects.update_or_create(
        organization=organization,
        user=organization.owner,
        defaults={
            "role": OrganizationMembership.ROLE_OWNER,
            "status": OrganizationMembership.STATUS_ACTIVE,
            "invited_by": organization.owner,
        },
    )
    return organization


def ensure_personal_organization(user) -> Organization:
    organization = Organization.objects.filter(owner=user, is_personal=True).order_by("id").first()
    if organization is not None:
        return _ensure_owner_organization_membership(organization)

    legacy_organization = (
        Organization.objects.filter(
            owner=user,
            name=f"{user.username} organization",
            description=LEGACY_PERSONAL_ORGANIZATION_DESCRIPTION,
        )
        .order_by("id")
        .first()
    )
    if legacy_organization is not None:
        legacy_organization.name = build_personal_organization_name(user)
        legacy_organization.description = PERSONAL_ORGANIZATION_DESCRIPTION
        legacy_organization.is_personal = True
        legacy_organization.save(update_fields=["name", "description", "is_personal", "updated_at"])
        return _ensure_owner_organization_membership(legacy_organization)

    return _ensure_owner_organization_membership(
        Organization.objects.create(
        name=build_personal_organization_name(user),
        description=PERSONAL_ORGANIZATION_DESCRIPTION,
        is_personal=True,
        owner=user,
        )
    )


class Project(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    use_sprints = models.BooleanField(default=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="projects",
        null=True,
        blank=True,
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_projects",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "id"]

    def __str__(self) -> str:
        return f"Project<{self.name}>"


class Sprint(models.Model):
    STATUS_ACTIVE = "active"
    STATUS_COMPLETED = "completed"

    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_COMPLETED, "Completed"),
    ]

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="sprints",
    )
    number = models.PositiveIntegerField(default=1)
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    review_text = models.TextField(blank=True)
    summary = models.JSONField(default=dict, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-number", "-id"]
        unique_together = [("project", "number")]

    def __str__(self) -> str:
        return f"Sprint<{self.project_id}:{self.name}:{self.status}>"


class ProjectMembership(models.Model):
    ROLE_OWNER = "owner"
    ROLE_ADMIN = "admin"
    ROLE_MEMBER = "member"
    ROLE_VIEWER = "viewer"

    ROLE_CHOICES = [
        (ROLE_OWNER, "Owner"),
        (ROLE_ADMIN, "Admin"),
        (ROLE_MEMBER, "Member"),
        (ROLE_VIEWER, "Viewer"),
    ]
    STATUS_INVITED = "invited"
    STATUS_ACTIVE = "active"

    STATUS_CHOICES = [
        (STATUS_INVITED, "Invited"),
        (STATUS_ACTIVE, "Active"),
    ]

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_memberships",
    )
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default=ROLE_MEMBER)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="created_project_memberships",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("project", "user")]
        ordering = ["user__username", "id"]

    def __str__(self) -> str:
        return f"Membership<{self.project_id}:{self.user_id}:{self.role}:{self.status}>"


class ProjectRepository(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="repositories",
    )
    github_repo_id = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    full_name = models.CharField(max_length=255)
    html_url = models.URLField()
    default_branch = models.CharField(max_length=255, default="main")
    visibility = models.CharField(max_length=32, default="private")
    owner_login = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["full_name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["project"],
                name="projects_single_repository_per_project",
            )
        ]

    def __str__(self) -> str:
        return f"Repository<{self.project_id}:{self.full_name}>"


class BugReport(models.Model):
    STATUS_OPEN = "open"
    STATUS_INVESTIGATING = "investigating"
    STATUS_MONITORING = "monitoring"
    STATUS_CLOSED = "closed"
    PRIORITY_LOW = "low"
    PRIORITY_MEDIUM = "medium"
    PRIORITY_HIGH = "high"
    PRIORITY_CRITICAL = "critical"

    STATUS_CHOICES = [
        (STATUS_OPEN, "Open"),
        (STATUS_INVESTIGATING, "Investigating"),
        (STATUS_MONITORING, "Monitoring"),
        (STATUS_CLOSED, "Closed"),
    ]
    PRIORITY_CHOICES = [
        (PRIORITY_LOW, "Low"),
        (PRIORITY_MEDIUM, "Medium"),
        (PRIORITY_HIGH, "High"),
        (PRIORITY_CRITICAL, "Critical"),
    ]

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="bug_reports",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reported_bugs",
    )
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default=STATUS_OPEN)
    priority = models.CharField(
        max_length=16,
        choices=PRIORITY_CHOICES,
        default=PRIORITY_MEDIUM,
    )
    resolution_task = models.ForeignKey(
        "Task",
        on_delete=models.SET_NULL,
        related_name="resolved_bugs",
        null=True,
        blank=True,
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]

    def __str__(self) -> str:
        return f"BugReport<{self.project_id}:{self.title}>"


class Task(models.Model):
    STATUS_TODO = "todo"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_IN_REVIEW = "in_review"
    STATUS_DONE = "done"
    PRIORITY_LOW = "low"
    PRIORITY_MEDIUM = "medium"
    PRIORITY_HIGH = "high"
    PRIORITY_CRITICAL = "critical"

    STATUS_CHOICES = [
        (STATUS_TODO, "Todo"),
        (STATUS_IN_PROGRESS, "In Progress"),
        (STATUS_IN_REVIEW, "In Review"),
        (STATUS_DONE, "Done"),
    ]
    PRIORITY_CHOICES = [
        (PRIORITY_LOW, "Low"),
        (PRIORITY_MEDIUM, "Medium"),
        (PRIORITY_HIGH, "High"),
        (PRIORITY_CRITICAL, "Critical"),
    ]

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="tasks",
    )
    bug_report = models.ForeignKey(
        BugReport,
        on_delete=models.SET_NULL,
        related_name="tasks",
        null=True,
        blank=True,
    )
    sprint = models.ForeignKey(
        Sprint,
        on_delete=models.SET_NULL,
        related_name="tasks",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default=STATUS_TODO)
    priority = models.CharField(
        max_length=16,
        choices=PRIORITY_CHOICES,
        default=PRIORITY_MEDIUM,
    )
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_tasks",
    )
    assignees = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="assigned_tasks",
        blank=True,
    )
    branch_name = models.CharField(max_length=255, blank=True)
    branch_url = models.URLField(blank=True)
    branch_repository = models.ForeignKey(
        ProjectRepository,
        on_delete=models.SET_NULL,
        related_name="task_branches",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["status", "-updated_at", "-id"]

    def __str__(self) -> str:
        return f"Task<{self.project_id}:{self.title}>"


class GitHubIssueLink(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="github_issue_links",
    )
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="github_issue_links",
        null=True,
        blank=True,
    )
    bug_report = models.ForeignKey(
        BugReport,
        on_delete=models.CASCADE,
        related_name="github_issue_links",
        null=True,
        blank=True,
    )
    repository_full_name = models.CharField(max_length=255)
    issue_number = models.PositiveIntegerField()
    title = models.CharField(max_length=255, blank=True)
    html_url = models.URLField()
    state = models.CharField(max_length=32, default="open")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="created_issue_links",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["repository_full_name", "issue_number", "id"]

    def __str__(self) -> str:
        return f"IssueLink<{self.repository_full_name}#{self.issue_number}>"


class TaskComment(models.Model):
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="task_comments",
    )
    body = models.TextField()
    anchor_type = models.CharField(max_length=32, blank=True, default="")
    anchor_id = models.CharField(max_length=64, blank=True, default="")
    anchor_label = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at", "id"]


class BugComment(models.Model):
    bug_report = models.ForeignKey(
        BugReport,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bug_comments",
    )
    body = models.TextField()
    anchor_type = models.CharField(max_length=32, blank=True, default="")
    anchor_id = models.CharField(max_length=64, blank=True, default="")
    anchor_label = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at", "id"]


class TaskCommentReaction(models.Model):
    comment = models.ForeignKey(
        TaskComment,
        on_delete=models.CASCADE,
        related_name="reactions",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="task_comment_reactions",
    )
    emoji = models.CharField(max_length=8)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["emoji", "id"]
        unique_together = [("comment", "user")]


class BugCommentReaction(models.Model):
    comment = models.ForeignKey(
        BugComment,
        on_delete=models.CASCADE,
        related_name="reactions",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bug_comment_reactions",
    )
    emoji = models.CharField(max_length=8)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["emoji", "id"]
        unique_together = [("comment", "user")]


class Activity(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="activities",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="project_activities",
        null=True,
        blank=True,
    )
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="activities",
        null=True,
        blank=True,
    )
    bug_report = models.ForeignKey(
        BugReport,
        on_delete=models.CASCADE,
        related_name="activities",
        null=True,
        blank=True,
    )
    action = models.CharField(max_length=64)
    description = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]


class Notification(models.Model):
    KIND_MENTION = "mention"
    KIND_ASSIGNMENT = "assignment"
    KIND_SYSTEM = "system"
    KIND_INVITE = "invite"

    KIND_CHOICES = [
        (KIND_MENTION, "Mention"),
        (KIND_ASSIGNMENT, "Assignment"),
        (KIND_SYSTEM, "System"),
        (KIND_INVITE, "Invite"),
    ]

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="sent_notifications",
        null=True,
        blank=True,
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    bug_report = models.ForeignKey(
        BugReport,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    kind = models.CharField(max_length=24, choices=KIND_CHOICES, default=KIND_SYSTEM)
    message = models.CharField(max_length=255)
    metadata = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

