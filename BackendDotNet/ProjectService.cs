using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Dapper;
using Microsoft.Data.Sqlite;

public sealed class ProjectService
{
    public const string RoleOwner = "owner";
    public const string RoleAdmin = "admin";
    public const string RoleMember = "member";
    public const string RoleViewer = "viewer";
    public const string StatusInvited = "invited";
    public const string StatusActive = "active";
    public const string TaskTodo = "todo";
    public const string TaskInProgress = "in_progress";
    public const string TaskInReview = "in_review";
    public const string TaskDone = "done";
    public const string BugOpen = "open";
    public const string BugInvestigating = "investigating";
    public const string BugMonitoring = "monitoring";
    public const string BugClosed = "closed";
    public const string PriorityLow = "low";
    public const string PriorityMedium = "medium";
    public const string PriorityHigh = "high";
    public const string PriorityCritical = "critical";
    public const string KindMention = "mention";
    public const string KindAssignment = "assignment";
    public const string KindSystem = "system";
    public const string KindInvite = "invite";

    private const string LegacyPersonalOrganizationDescription = "Default workspace created for existing projects.";
    private const string PersonalOrganizationDescription = "Your personal workspace.";

    private static readonly Dictionary<string, int> RoleOrder = new()
    {
        [RoleViewer] = 0,
        [RoleMember] = 1,
        [RoleAdmin] = 2,
        [RoleOwner] = 3,
    };

    private static readonly Dictionary<string, string> TaskStatusLabels = new()
    {
        [TaskTodo] = "To Do",
        [TaskInProgress] = "In Progress",
        [TaskInReview] = "In Review",
        [TaskDone] = "Done",
    };

    private static readonly Dictionary<string, string> BugStatusLabels = new()
    {
        [BugOpen] = "Open",
        [BugInvestigating] = "Investigating",
        [BugMonitoring] = "Monitoring",
        [BugClosed] = "Closed",
    };

    private static readonly Dictionary<string, string> PriorityLabels = new()
    {
        [PriorityLow] = "Low",
        [PriorityMedium] = "Medium",
        [PriorityHigh] = "High",
        [PriorityCritical] = "Critical",
    };

    private static readonly string[] ReactionEmojis = ["👍", "❤️", "🎉", "👀", "🔥"];
    private static readonly Regex MentionPattern = new(@"(?<![\w-])@([A-Za-z0-9_][A-Za-z0-9_-]{0,63})", RegexOptions.Compiled);
    private static readonly Regex IssueUrlPattern = new(@"^https?://github\.com/([^/]+/[^/]+)/issues/(\d+)", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public async Task<UserProfile> GetProfileAsync(SqliteConnection connection, User user)
    {
        var profile = await connection.QueryFirstOrDefaultAsync<UserProfile>("select * from accounts_userprofile where user_id = @UserId", new { UserId = user.Id });
        if (profile is not null)
        {
            return profile;
        }

        var now = ApiHelpers.NowSql();
        await connection.ExecuteAsync(
            """
            insert into accounts_userprofile
            (github_user_id, github_username, github_avatar_url, github_access_token, github_connected_at, created_at, updated_at, user_id)
            values (null, '', '', '', null, @Now, @Now, @UserId)
            """,
            new { Now = now, UserId = user.Id });
        return (await connection.QueryFirstAsync<UserProfile>("select * from accounts_userprofile where user_id = @UserId", new { UserId = user.Id }));
    }

    public async Task<object> SerializeUserAsync(SqliteConnection connection, long userId)
    {
        var user = await connection.QueryFirstAsync<User>("select * from auth_user where id = @Id", new { Id = userId });
        return await SerializeUserAsync(connection, user);
    }

    public async Task<object> SerializeUserAsync(SqliteConnection connection, User user)
    {
        var profile = await GetProfileAsync(connection, user);
        return new
        {
            id = user.Id,
            username = user.Username,
            email = user.Email,
            githubConnected = !string.IsNullOrWhiteSpace(profile.GithubAccessToken),
            githubUsername = profile.GithubUsername,
            githubAvatarUrl = profile.GithubAvatarUrl,
        };
    }

    public object SerializeAvailableRepo(JsonObject repo)
    {
        var owner = repo["owner"]?.AsObject();
        return new
        {
            id = repo.Value<long?>("id"),
            name = repo.Value<string>("name") ?? "",
            fullName = repo.Value<string>("full_name") ?? "",
            description = repo.Value<string>("description") ?? "",
            htmlUrl = repo.Value<string>("html_url") ?? "",
            language = repo.Value<string>("language") ?? "Unknown",
            stargazersCount = repo.Value<long?>("stargazers_count") ?? 0,
            visibility = repo.Value<bool?>("private") == true ? "private" : "public",
            updatedAt = repo.Value<string>("updated_at") ?? "",
            owner = owner?.Value<string>("login") ?? "",
            defaultBranch = repo.Value<string>("default_branch") ?? "main",
        };
    }

    public async Task<Organization> EnsurePersonalOrganizationAsync(SqliteConnection connection, User user)
    {
        var organization = await connection.QueryFirstOrDefaultAsync<Organization>(
            "select * from projects_organization where owner_id = @UserId and is_personal = 1 order by id limit 1",
            new { UserId = user.Id });
        if (organization is not null)
        {
            await EnsureOwnerOrganizationMembershipAsync(connection, organization, user);
            return organization;
        }

        var legacyName = $"{user.Username} organization";
        organization = await connection.QueryFirstOrDefaultAsync<Organization>(
            "select * from projects_organization where owner_id = @UserId and name = @Name and description = @Description order by id limit 1",
            new { UserId = user.Id, Name = legacyName, Description = LegacyPersonalOrganizationDescription });
        if (organization is not null)
        {
            organization.Name = BuildPersonalOrganizationName(user);
            organization.Description = PersonalOrganizationDescription;
            organization.IsPersonal = true;
            await connection.ExecuteAsync(
                "update projects_organization set name = @Name, description = @Description, is_personal = 1, updated_at = @Now where id = @Id",
                new { organization.Name, organization.Description, Now = ApiHelpers.NowSql(), organization.Id });
            await EnsureOwnerOrganizationMembershipAsync(connection, organization, user);
            return organization;
        }

        var now = ApiHelpers.NowSql();
        await connection.ExecuteAsync(
            "insert into projects_organization (name, description, is_personal, owner_id, created_at, updated_at) values (@Name, @Description, 1, @OwnerId, @Now, @Now)",
            new { Name = BuildPersonalOrganizationName(user), Description = PersonalOrganizationDescription, OwnerId = user.Id, Now = now });
        organization = await connection.QueryFirstAsync<Organization>("select * from projects_organization where id = last_insert_rowid()");
        await EnsureOwnerOrganizationMembershipAsync(connection, organization, user);
        return organization;
    }

    public async Task<OrganizationMembership> EnsureOwnerOrganizationMembershipAsync(SqliteConnection connection, Organization organization, User owner)
    {
        var membership = await connection.QueryFirstOrDefaultAsync<OrganizationMembership>(
            "select * from projects_organizationmembership where organization_id = @OrganizationId and user_id = @UserId",
            new { OrganizationId = organization.Id, UserId = owner.Id });
        var now = ApiHelpers.NowSql();
        if (membership is null)
        {
            await connection.ExecuteAsync(
                """
                insert into projects_organizationmembership
                (organization_id, user_id, role, status, invited_by_id, created_at, updated_at)
                values (@OrganizationId, @UserId, @Role, @Status, @InvitedById, @Now, @Now)
                """,
                new { OrganizationId = organization.Id, UserId = owner.Id, Role = RoleOwner, Status = StatusActive, InvitedById = owner.Id, Now = now });
        }
        else if (membership.Role != RoleOwner || membership.Status != StatusActive || membership.InvitedById is null)
        {
            await connection.ExecuteAsync(
                "update projects_organizationmembership set role = @Role, status = @Status, invited_by_id = @InvitedById, updated_at = @Now where id = @Id",
                new { Role = RoleOwner, Status = StatusActive, InvitedById = owner.Id, Now = now, membership.Id });
        }

        return await connection.QueryFirstAsync<OrganizationMembership>(
            "select * from projects_organizationmembership where organization_id = @OrganizationId and user_id = @UserId",
            new { OrganizationId = organization.Id, UserId = owner.Id });
    }

    public async Task<OrganizationMembership?> ActiveOrganizationMembershipAsync(SqliteConnection connection, Organization organization, User user)
    {
        if (organization.OwnerId == user.Id)
        {
            await EnsureOwnerOrganizationMembershipAsync(connection, organization, user);
        }

        return await connection.QueryFirstOrDefaultAsync<OrganizationMembership>(
            "select * from projects_organizationmembership where organization_id = @OrganizationId and user_id = @UserId and status = @Status",
            new { OrganizationId = organization.Id, UserId = user.Id, Status = StatusActive });
    }

    public async Task<List<Organization>> AccessibleOrganizationsAsync(SqliteConnection connection, User user)
    {
        await EnsurePersonalOrganizationAsync(connection, user);
        var organizations = await connection.QueryAsync<Organization>(
            """
            select distinct o.*
            from projects_organization o
            left join projects_organizationmembership m on m.organization_id = o.id
            where o.owner_id = @UserId or (m.user_id = @UserId and m.status = @Status)
            order by o.updated_at desc, o.id desc
            """,
            new { UserId = user.Id, Status = StatusActive });
        return organizations.ToList();
    }

    public async Task<string?> OrganizationRoleForUserAsync(SqliteConnection connection, Organization organization, User user)
    {
        var membership = await ActiveOrganizationMembershipAsync(connection, organization, user);
        return membership?.Role;
    }

    public async Task<(Organization? Organization, OrganizationMembership? Membership, IResult? Error)> LoadOrganizationAsync(SqliteConnection connection, long organizationId, User user)
    {
        await EnsurePersonalOrganizationAsync(connection, user);
        var organization = await connection.QueryFirstOrDefaultAsync<Organization>("select * from projects_organization where id = @Id", new { Id = organizationId });
        if (organization is null)
        {
            return (null, null, ApiHelpers.JsonError("Organization not found.", StatusCodes.Status404NotFound));
        }

        var membership = await ActiveOrganizationMembershipAsync(connection, organization, user);
        if (membership is null)
        {
            return (null, null, ApiHelpers.JsonError("Organization not found.", StatusCodes.Status404NotFound));
        }

        return (organization, membership, null);
    }

    public async Task<(Organization? Organization, OrganizationMembership? Membership, IResult? Error)> LoadManageableOrganizationAsync(SqliteConnection connection, long organizationId, User user)
    {
        var (organization, membership, error) = await LoadOrganizationAsync(connection, organizationId, user);
        if (error is not null || organization is null || membership is null)
        {
            return (null, null, error);
        }

        if (!CanManageOrganizationMembers(membership.Role))
        {
            return (null, null, ApiHelpers.JsonError("Only admins and owners can manage this organization.", StatusCodes.Status403Forbidden));
        }

        if (organization.IsPersonal)
        {
            return (null, null, ApiHelpers.JsonError("Personal workspaces do not support sharing projects.", StatusCodes.Status403Forbidden));
        }

        return (organization, membership, null);
    }

    public async Task<(Organization? Organization, IResult? Error)> LoadOwnedOrganizationAsync(SqliteConnection connection, long organizationId, User user)
    {
        await EnsurePersonalOrganizationAsync(connection, user);
        var organization = await connection.QueryFirstOrDefaultAsync<Organization>(
            "select * from projects_organization where id = @Id and owner_id = @UserId",
            new { Id = organizationId, UserId = user.Id });
        return organization is null
            ? (null, ApiHelpers.JsonError("Organization not found.", StatusCodes.Status404NotFound))
            : (organization, null);
    }

    public async Task<(Project? Project, ProjectMembership? Membership, IResult? Error)> LoadProjectAsync(SqliteConnection connection, long projectId, User user)
    {
        var project = await connection.QueryFirstOrDefaultAsync<Project>("select * from projects_project where id = @Id", new { Id = projectId });
        if (project is null)
        {
            return (null, null, ApiHelpers.JsonError("Project not found.", StatusCodes.Status404NotFound));
        }

        var membership = await connection.QueryFirstOrDefaultAsync<ProjectMembership>(
            "select * from projects_projectmembership where project_id = @ProjectId and user_id = @UserId and status = @Status",
            new { ProjectId = project.Id, UserId = user.Id, Status = StatusActive });
        if (membership is null)
        {
            return (null, null, ApiHelpers.JsonError("Project not found.", StatusCodes.Status404NotFound));
        }

        return (project, membership, null);
    }

    public bool RoleAtLeast(ProjectMembership membership, string requiredRole) => RoleOrder.GetValueOrDefault(membership.Role, -1) >= RoleOrder[requiredRole];

    public bool CanManageOrganizationMembers(string? role) => role is RoleOwner or RoleAdmin;

    public bool CanManageTargetOrganizationMembership(OrganizationMembership actor, OrganizationMembership target)
    {
        if (actor.Role == RoleOwner)
        {
            return true;
        }

        if (actor.Role != RoleAdmin)
        {
            return false;
        }

        return target.UserId == actor.UserId || target.Role is not (RoleOwner or RoleAdmin);
    }

    public bool CanEditBug(ProjectMembership membership, BugReport bugReport, User user)
    {
        return RoleAtLeast(membership, RoleAdmin) || bugReport.ReporterId == user.Id;
    }

    public async Task<Sprint?> GetActiveSprintAsync(SqliteConnection connection, Project project)
    {
        return await connection.QueryFirstOrDefaultAsync<Sprint>(
            "select * from projects_sprint where project_id = @ProjectId and status = 'active' order by number desc, id desc limit 1",
            new { ProjectId = project.Id });
    }

    public async Task<Sprint> CreateSprintAsync(SqliteConnection connection, Project project)
    {
        var latestNumber = await connection.ExecuteScalarAsync<long?>("select max(number) from projects_sprint where project_id = @ProjectId", new { ProjectId = project.Id }) ?? 0;
        var nextNumber = latestNumber + 1;
        var now = ApiHelpers.NowSql();
        await connection.ExecuteAsync(
            """
            insert into projects_sprint
            (project_id, number, name, status, review_text, summary, started_at, ended_at, created_at, updated_at)
            values (@ProjectId, @Number, @Name, 'active', '', '{}', @Now, null, @Now, @Now)
            """,
            new { ProjectId = project.Id, Number = nextNumber, Name = $"Sprint {nextNumber}", Now = now });
        return await connection.QueryFirstAsync<Sprint>("select * from projects_sprint where id = last_insert_rowid()");
    }

    public async Task<Sprint> EnsureActiveSprintAsync(SqliteConnection connection, Project project)
    {
        return await GetActiveSprintAsync(connection, project) ?? await CreateSprintAsync(connection, project);
    }

    public async Task TouchOrganizationAsync(SqliteConnection connection, long? organizationId)
    {
        if (organizationId is null)
        {
            return;
        }

        await connection.ExecuteAsync("update projects_organization set updated_at = @Now where id = @Id", new { Now = ApiHelpers.NowSql(), Id = organizationId.Value });
    }

    public async Task TouchProjectAsync(SqliteConnection connection, Project project)
    {
        await connection.ExecuteAsync("update projects_project set updated_at = @Now where id = @Id", new { Now = ApiHelpers.NowSql(), project.Id });
        await TouchOrganizationAsync(connection, project.OrganizationId);
        project.UpdatedAt = DateTime.UtcNow;
    }

    public async Task RecordActivityAsync(SqliteConnection connection, Project project, User actor, string action, string description, TaskItem? task = null, BugReport? bugReport = null, object? metadata = null)
    {
        await connection.ExecuteAsync(
            """
            insert into projects_activity
            (project_id, actor_id, task_id, bug_report_id, action, description, metadata, created_at)
            values (@ProjectId, @ActorId, @TaskId, @BugReportId, @Action, @Description, @Metadata, @Now)
            """,
            new
            {
                ProjectId = project.Id,
                ActorId = actor.Id,
                TaskId = task?.Id,
                BugReportId = bugReport?.Id,
                Action = action,
                Description = description,
                Metadata = ApiHelpers.ToJsonText(metadata ?? new { }),
                Now = ApiHelpers.NowSql(),
            });
        await TouchProjectAsync(connection, project);
    }

    public async Task<List<User>> ProjectMembersByIdsAsync(SqliteConnection connection, Project project, IEnumerable<long> userIds)
    {
        var ids = userIds.Distinct().ToArray();
        if (ids.Length == 0)
        {
            return [];
        }

        var users = await connection.QueryAsync<User>(
            """
            select distinct u.*
            from auth_user u
            join projects_projectmembership m on m.user_id = u.id
            where m.project_id = @ProjectId and m.status = @Status and u.id in @Ids
            order by u.username
            """,
            new { ProjectId = project.Id, Status = StatusActive, Ids = ids });
        return users.ToList();
    }

    public async Task NotifyNewAssigneesAsync(SqliteConnection connection, TaskItem task, User actor, IEnumerable<User> assignees)
    {
        foreach (var user in assignees.Where(user => user.Id != actor.Id))
        {
            await CreateNotificationAsync(connection, user.Id, actor.Id, projectId: task.ProjectId, taskId: task.Id, kind: KindAssignment, message: $"{actor.Username} assigned you to task \"{task.Title}\".");
        }
    }

    public async Task<SetLong> NotifyMentionsAsync(SqliteConnection connection, Project project, User actor, string text, string contextLabel, TaskItem? task = null, BugReport? bugReport = null)
    {
        var mentionedUsernames = MentionPattern.Matches(text ?? "")
            .Select(match => match.Groups[1].Value.ToLowerInvariant())
            .Distinct()
            .OrderBy(x => x)
            .ToArray();
        var notified = new SetLong();
        if (mentionedUsernames.Length == 0)
        {
            return notified;
        }

        var users = await connection.QueryAsync<User>(
            """
            select distinct u.*
            from auth_user u
            join projects_projectmembership m on m.user_id = u.id
            where m.project_id = @ProjectId and m.status = @Status and lower(u.username) in @Usernames
            """,
            new { ProjectId = project.Id, Status = StatusActive, Usernames = mentionedUsernames });

        foreach (var user in users)
        {
            if (user.Id == actor.Id)
            {
                continue;
            }

            await CreateNotificationAsync(connection, user.Id, actor.Id, projectId: project.Id, taskId: task?.Id, bugReportId: bugReport?.Id, kind: KindMention, message: $"{actor.Username} mentioned you in {contextLabel}.");
            notified.Add(user.Id);
        }

        return notified;
    }

    public async Task NotifyTaskCommentAssigneesAsync(SqliteConnection connection, TaskItem task, User actor, IEnumerable<long> excludedUserIds)
    {
        var skipped = excludedUserIds.ToHashSet();
        skipped.Add(actor.Id);
        var users = await connection.QueryAsync<User>(
            """
            select u.*
            from auth_user u
            join projects_task_assignees a on a.user_id = u.id
            where a.task_id = @TaskId
            order by u.username
            """,
            new { TaskId = task.Id });
        foreach (var user in users.Where(user => !skipped.Contains(user.Id)))
        {
            await CreateNotificationAsync(connection, user.Id, actor.Id, projectId: task.ProjectId, taskId: task.Id, bugReportId: task.BugReportId, kind: KindSystem, message: $"{actor.Username} commented on task \"{task.Title}\" that you are assigned to.");
        }
    }

    public async Task CreateNotificationAsync(SqliteConnection connection, long recipientId, long? actorId, long? organizationId = null, long? projectId = null, long? taskId = null, long? bugReportId = null, string kind = KindSystem, string message = "", object? metadata = null)
    {
        await connection.ExecuteAsync(
            """
            insert into projects_notification
            (recipient_id, actor_id, organization_id, project_id, task_id, bug_report_id, kind, message, metadata, is_read, is_closed, created_at)
            values (@RecipientId, @ActorId, @OrganizationId, @ProjectId, @TaskId, @BugReportId, @Kind, @Message, @Metadata, 0, 0, @Now)
            """,
            new
            {
                RecipientId = recipientId,
                ActorId = actorId,
                OrganizationId = organizationId,
                ProjectId = projectId,
                TaskId = taskId,
                BugReportId = bugReportId,
                Kind = kind,
                Message = message,
                Metadata = ApiHelpers.ToJsonText(metadata ?? new { }),
                Now = ApiHelpers.NowSql(),
            });
    }

    public async Task CloseBugsFromResolutionTaskAsync(SqliteConnection connection, TaskItem task, User actor)
    {
        if (task.Status != TaskDone)
        {
            return;
        }

        var project = await connection.QueryFirstAsync<Project>("select * from projects_project where id = @Id", new { Id = task.ProjectId });
        var bugReports = (await connection.QueryAsync<BugReport>(
            "select * from projects_bugreport where project_id = @ProjectId and resolution_task_id = @TaskId",
            new { ProjectId = task.ProjectId, TaskId = task.Id })).ToList();
        foreach (var bugReport in bugReports.Where(bug => bug.Status != BugClosed))
        {
            await connection.ExecuteAsync(
                "update projects_bugreport set status = @Status, closed_at = @ClosedAt, updated_at = @Now where id = @Id",
                new { Status = BugClosed, ClosedAt = ApiHelpers.NowSql(), Now = ApiHelpers.NowSql(), bugReport.Id });
            bugReport.Status = BugClosed;
            await RecordActivityAsync(connection, project, actor, "bug.auto_closed", $"Closed bug \"{bugReport.Title}\" because its resolution task reached Done.", task, bugReport);
            if (bugReport.ReporterId != actor.Id)
            {
                await CreateNotificationAsync(connection, bugReport.ReporterId, actor.Id, projectId: project.Id, taskId: task.Id, bugReportId: bugReport.Id, kind: KindSystem, message: $"Bug \"{bugReport.Title}\" was closed when its resolution task was completed.");
            }
        }
    }

    public async Task<ProjectMembership> SyncProjectMembershipForOrgMemberAsync(SqliteConnection connection, Project project, OrganizationMembership organizationMembership)
    {
        var desiredRole = organizationMembership.UserId == project.OwnerId ? RoleOwner : organizationMembership.Role;
        var membership = await connection.QueryFirstOrDefaultAsync<ProjectMembership>(
            "select * from projects_projectmembership where project_id = @ProjectId and user_id = @UserId",
            new { ProjectId = project.Id, UserId = organizationMembership.UserId });
        var now = ApiHelpers.NowSql();
        if (membership is null)
        {
            await connection.ExecuteAsync(
                """
                insert into projects_projectmembership
                (project_id, user_id, role, status, added_by_id, created_at, updated_at)
                values (@ProjectId, @UserId, @Role, @Status, @AddedById, @Now, @Now)
                """,
                new { ProjectId = project.Id, UserId = organizationMembership.UserId, Role = desiredRole, organizationMembership.Status, AddedById = organizationMembership.InvitedById, Now = now });
        }
        else
        {
            await connection.ExecuteAsync(
                "update projects_projectmembership set role = @Role, status = @Status, added_by_id = coalesce(added_by_id, @AddedById), updated_at = @Now where id = @Id",
                new { Role = desiredRole, organizationMembership.Status, AddedById = organizationMembership.InvitedById, Now = now, membership.Id });
        }

        return await connection.QueryFirstAsync<ProjectMembership>(
            "select * from projects_projectmembership where project_id = @ProjectId and user_id = @UserId",
            new { ProjectId = project.Id, UserId = organizationMembership.UserId });
    }

    public async Task SyncOrganizationMembershipsToProjectAsync(SqliteConnection connection, Project project)
    {
        if (project.OrganizationId is null)
        {
            return;
        }

        var memberships = await connection.QueryAsync<OrganizationMembership>("select * from projects_organizationmembership where organization_id = @OrganizationId", new { OrganizationId = project.OrganizationId });
        foreach (var membership in memberships)
        {
            await SyncProjectMembershipForOrgMemberAsync(connection, project, membership);
        }
    }

    public async Task SyncOrganizationMembershipToProjectsAsync(SqliteConnection connection, OrganizationMembership organizationMembership)
    {
        var projects = await connection.QueryAsync<Project>("select * from projects_project where organization_id = @OrganizationId", new { organizationMembership.OrganizationId });
        foreach (var project in projects)
        {
            await SyncProjectMembershipForOrgMemberAsync(connection, project, organizationMembership);
        }
    }

    public async Task RemoveOrganizationMembershipFromProjectsAsync(SqliteConnection connection, Organization organization, long userId)
    {
        await connection.ExecuteAsync(
            """
            delete from projects_projectmembership
            where user_id = @UserId and project_id in (select id from projects_project where organization_id = @OrganizationId)
            """,
            new { UserId = userId, OrganizationId = organization.Id });
    }

    public async Task<OrganizationMembership> InviteUserToOrganizationAsync(SqliteConnection connection, Organization organization, User actor, User invitedUser, string role)
    {
        var now = ApiHelpers.NowSql();
        await connection.ExecuteAsync(
            """
            insert into projects_organizationmembership
            (organization_id, user_id, role, status, invited_by_id, created_at, updated_at)
            values (@OrganizationId, @UserId, @Role, @Status, @InvitedById, @Now, @Now)
            """,
            new { OrganizationId = organization.Id, UserId = invitedUser.Id, Role = role, Status = StatusInvited, InvitedById = actor.Id, Now = now });
        var membership = await connection.QueryFirstAsync<OrganizationMembership>("select * from projects_organizationmembership where id = last_insert_rowid()");
        await SyncOrganizationMembershipToProjectsAsync(connection, membership);
        await CreateNotificationAsync(
            connection,
            invitedUser.Id,
            actor.Id,
            organizationId: organization.Id,
            kind: KindInvite,
            message: $"{actor.Username} invited you to \"{organization.Name}\" as {TitleCase(role)}.",
            metadata: new { organizationMembershipId = membership.Id });
        return membership;
    }

    public async Task ActivateOrganizationInviteAsync(SqliteConnection connection, OrganizationMembership membership, Notification? notification = null)
    {
        await connection.ExecuteAsync("update projects_organizationmembership set status = @Status, updated_at = @Now where id = @Id", new { Status = StatusActive, Now = ApiHelpers.NowSql(), membership.Id });
        membership.Status = StatusActive;
        await SyncOrganizationMembershipToProjectsAsync(connection, membership);
        if (notification is not null)
        {
            await CloseNotificationAsync(connection, notification);
        }
    }

    public async Task CloseNotificationAsync(SqliteConnection connection, Notification notification)
    {
        await connection.ExecuteAsync("update projects_notification set is_read = 1, is_closed = 1 where id = @Id", new { notification.Id });
        notification.IsRead = true;
        notification.IsClosed = true;
    }

    public async Task<List<long>> CloseRelatedNotificationsForUserAsync(SqliteConnection connection, User user, long? taskId, long? bugReportId)
    {
        if (taskId is null && bugReportId is null)
        {
            return [];
        }

        var where = "recipient_id = @UserId and is_closed = 0 and kind <> @Invite";
        if (taskId is not null && bugReportId is not null)
        {
            where += " and task_id = @TaskId and bug_report_id = @BugReportId";
        }
        else if (taskId is not null)
        {
            where += " and task_id = @TaskId";
        }
        else
        {
            where += " and bug_report_id = @BugReportId";
        }

        var ids = (await connection.QueryAsync<long>($"select id from projects_notification where {where}", new { UserId = user.Id, TaskId = taskId, BugReportId = bugReportId, Invite = KindInvite })).ToList();
        if (ids.Count > 0)
        {
            await connection.ExecuteAsync("update projects_notification set is_read = 1, is_closed = 1 where id in @Ids", new { Ids = ids });
        }

        return ids;
    }

    public async Task<ProjectRepository> CreateProjectRepositoryAsync(SqliteConnection connection, Project project, JsonObject repo)
    {
        var owner = repo["owner"]?.AsObject();
        await connection.ExecuteAsync(
            """
            insert into projects_projectrepository
            (project_id, github_repo_id, name, full_name, html_url, default_branch, visibility, owner_login, created_at)
            values (@ProjectId, @GithubRepoId, @Name, @FullName, @HtmlUrl, @DefaultBranch, @Visibility, @OwnerLogin, @Now)
            """,
            new
            {
                ProjectId = project.Id,
                GithubRepoId = (repo.Value<long?>("id") ?? 0).ToString(),
                Name = repo.Value<string>("name") ?? "",
                FullName = repo.Value<string>("full_name") ?? "",
                HtmlUrl = repo.Value<string>("html_url") ?? "",
                DefaultBranch = repo.Value<string>("default_branch") ?? "main",
                Visibility = repo.Value<bool?>("private") == true ? "private" : "public",
                OwnerLogin = owner?.Value<string>("login") ?? "",
                Now = ApiHelpers.NowSql(),
            });
        return await connection.QueryFirstAsync<ProjectRepository>("select * from projects_projectrepository where id = last_insert_rowid()");
    }

    public string? ParseSelectedRepositoryId(JsonObject payload)
    {
        var ids = new List<string>();
        var repositoryId = (payload.Value<string>("repositoryId") ?? "").Trim();
        if (!string.IsNullOrWhiteSpace(repositoryId))
        {
            ids.Add(repositoryId);
        }

        if (payload.TryGetPropertyValue("repositoryIds", out var repositoryIdsNode) && repositoryIdsNode is JsonArray repositoryIds)
        {
            ids.AddRange(repositoryIds.Select(item => item?.ToString().Trim()).Where(item => !string.IsNullOrWhiteSpace(item))!);
        }

        var selected = ids.Distinct().ToArray();
        if (selected.Length > 1)
        {
            throw new ArgumentException("Choose at most one repository per project.");
        }

        return selected.FirstOrDefault();
    }

    public (string RepositoryFullName, long IssueNumber, string IssueUrl, string Title, string State) ParseIssueReference(JsonObject payload)
    {
        var issueUrl = (payload.Value<string>("issueUrl") ?? "").Trim();
        var repositoryFullName = (payload.Value<string>("repositoryFullName") ?? "").Trim();
        var issueNumberNode = payload["issueNumber"];
        var title = (payload.Value<string>("title") ?? "").Trim();
        var state = (payload.Value<string>("state") ?? "open").Trim();
        if (string.IsNullOrWhiteSpace(state))
        {
            state = "open";
        }

        long issueNumber;
        if (!string.IsNullOrWhiteSpace(issueUrl))
        {
            var match = IssueUrlPattern.Match(issueUrl);
            if (!match.Success)
            {
                throw new ArgumentException("Enter a valid GitHub issue URL.");
            }

            repositoryFullName = match.Groups[1].Value;
            issueNumber = long.Parse(match.Groups[2].Value);
        }
        else
        {
            if (string.IsNullOrWhiteSpace(repositoryFullName))
            {
                throw new ArgumentException("Choose a connected repository for the issue link.");
            }

            if (issueNumberNode is null || !long.TryParse(issueNumberNode.ToString(), out issueNumber))
            {
                throw new ArgumentException("Provide a valid GitHub issue number.");
            }

            issueUrl = $"https://github.com/{repositoryFullName}/issues/{issueNumber}";
        }

        return (repositoryFullName, issueNumber, issueUrl, string.IsNullOrWhiteSpace(title) ? $"Issue #{issueNumber}" : title, state);
    }

    public async Task EnsureIssueRepoAllowedAsync(SqliteConnection connection, Project project, string repositoryFullName)
    {
        var allowed = await connection.ExecuteScalarAsync<int>(
            "select count(*) from projects_projectrepository where project_id = @ProjectId and full_name = @RepositoryFullName",
            new { ProjectId = project.Id, RepositoryFullName = repositoryFullName });
        if (allowed == 0)
        {
            throw new ArgumentException("Issue links must belong to one of the project's connected repositories.");
        }
    }

    public async Task<(string Title, string Url, string State)> RefreshIssueDetailsAsync(GitHubClient github, string accessToken, string repositoryFullName, long issueNumber, string fallbackTitle, string fallbackUrl, string fallbackState)
    {
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return (fallbackTitle, fallbackUrl, fallbackState);
        }

        try
        {
            var issue = await github.GetIssueAsync(accessToken, repositoryFullName, issueNumber);
            return (
                issue.Value<string>("title") ?? fallbackTitle,
                issue.Value<string>("html_url") ?? fallbackUrl,
                issue.Value<string>("state") ?? fallbackState);
        }
        catch (GitHubApiException)
        {
            return (fallbackTitle, fallbackUrl, fallbackState);
        }
    }

    public async Task<string> GetGitHubAccessTokenAsync(SqliteConnection connection, User user)
    {
        var profile = await GetProfileAsync(connection, user);
        return profile.GithubAccessToken ?? "";
    }

    public async Task<string> GetProjectGitHubAccessTokenAsync(SqliteConnection connection, Project project, User? user = null)
    {
        if (user is not null)
        {
            var accessToken = await GetGitHubAccessTokenAsync(connection, user);
            if (!string.IsNullOrWhiteSpace(accessToken))
            {
                return accessToken;
            }
        }

        var owner = await connection.QueryFirstAsync<User>("select * from auth_user where id = @Id", new { Id = project.OwnerId });
        return await GetGitHubAccessTokenAsync(connection, owner);
    }

    public async Task<object> SerializeOrganizationSummaryAsync(SqliteConnection connection, Organization organization, User user)
    {
        var role = await OrganizationRoleForUserAsync(connection, organization, user) ?? RoleViewer;
        var memberCount = await connection.ExecuteScalarAsync<int>("select count(distinct user_id) from projects_organizationmembership where organization_id = @Id and status = @Status", new { organization.Id, Status = StatusActive });
        var projectCount = await connection.ExecuteScalarAsync<int>("select count(*) from projects_project where organization_id = @Id", new { organization.Id });
        var repoCount = await connection.ExecuteScalarAsync<int>(
            "select count(*) from projects_projectrepository r join projects_project p on p.id = r.project_id where p.organization_id = @Id",
            new { organization.Id });
        var openBugCount = await connection.ExecuteScalarAsync<int>(
            """
            select count(*)
            from projects_bugreport b
            join projects_project p on p.id = b.project_id
            where p.organization_id = @Id and b.status <> @Closed
            """,
            new { organization.Id, Closed = BugClosed });
        var displayName = organization.IsPersonal && organization.OwnerId == user.Id ? user.Username : organization.Name;
        return new
        {
            id = organization.Id,
            name = organization.Name,
            displayName,
            description = organization.Description,
            isPersonal = organization.IsPersonal,
            role,
            memberCount,
            projectCount,
            repoCount,
            openBugCount,
            updatedAt = ApiHelpers.Iso(organization.UpdatedAt),
        };
    }

    public async Task<object> SerializeOrganizationMemberAsync(SqliteConnection connection, OrganizationMembership membership)
    {
        var user = await connection.QueryFirstAsync<User>("select * from auth_user where id = @Id", new { Id = membership.UserId });
        var projectNames = (await connection.QueryAsync<string>(
            """
            select distinct p.name
            from projects_project p
            join projects_projectmembership m on m.project_id = p.id
            where p.organization_id = @OrganizationId and m.user_id = @UserId
            order by p.name, p.id
            """,
            new { membership.OrganizationId, membership.UserId })).ToList();
        return new
        {
            id = membership.Id,
            role = membership.Role,
            status = membership.Status,
            user = await SerializeUserAsync(connection, user),
            projectNames,
            addedAt = ApiHelpers.Iso(membership.CreatedAt),
        };
    }

    public async Task<object> SerializeProjectSummaryAsync(SqliteConnection connection, Project project, ProjectMembership membership)
    {
        var memberCount = await connection.ExecuteScalarAsync<int>("select count(*) from projects_projectmembership where project_id = @Id and status = @Status", new { project.Id, Status = StatusActive });
        var repoCount = await connection.ExecuteScalarAsync<int>("select count(*) from projects_projectrepository where project_id = @Id", new { project.Id });
        var openBugCount = await connection.ExecuteScalarAsync<int>("select count(*) from projects_bugreport where project_id = @Id and status <> @Closed", new { project.Id, Closed = BugClosed });
        var taskCounts = (await connection.QueryAsync<(string Status, int Count)>("select status, count(*) as Count from projects_task where project_id = @Id group by status", new { project.Id })).ToDictionary(x => x.Status, x => x.Count);
        return new
        {
            id = project.Id,
            organizationId = project.OrganizationId,
            name = project.Name,
            description = project.Description,
            role = membership.Role,
            memberCount,
            repoCount,
            openBugCount,
            taskCounts = new Dictionary<string, int>
            {
                [TaskTodo] = taskCounts.GetValueOrDefault(TaskTodo),
                [TaskInProgress] = taskCounts.GetValueOrDefault(TaskInProgress),
                [TaskInReview] = taskCounts.GetValueOrDefault(TaskInReview),
                [TaskDone] = taskCounts.GetValueOrDefault(TaskDone),
            },
            updatedAt = ApiHelpers.Iso(project.UpdatedAt),
        };
    }

    public async Task<object> SerializeNotificationAsync(SqliteConnection connection, Notification notification)
    {
        object? action = null;
        var metadata = ApiHelpers.JsonObjectFromText(notification.Metadata);
        var metadataObject = JsonNode.Parse(notification.Metadata)?.AsObject();
        var membershipId = metadataObject?.Value<long?>("organizationMembershipId");
        if (notification.Kind == KindInvite && notification.OrganizationId is not null && membershipId is not null && !notification.IsRead)
        {
            var invite = await connection.QueryFirstOrDefaultAsync<OrganizationMembership>(
                """
                select * from projects_organizationmembership
                where id = @Id and organization_id = @OrganizationId and user_id = @UserId and status = @Status
                """,
                new { Id = membershipId, OrganizationId = notification.OrganizationId, UserId = notification.RecipientId, Status = StatusInvited });
            if (invite is not null)
            {
                action = new
                {
                    type = "accept_organization_invite",
                    label = "Accept",
                    organizationMembershipId = invite.Id,
                };
            }
        }

        return new
        {
            id = notification.Id,
            kind = notification.Kind,
            message = notification.Message,
            isRead = notification.IsRead,
            isClosed = notification.IsClosed,
            actor = notification.ActorId is null ? null : await SerializeUserAsync(connection, notification.ActorId.Value),
            organizationId = notification.OrganizationId,
            projectId = notification.ProjectId,
            taskId = notification.TaskId,
            bugReportId = notification.BugReportId,
            action,
            createdAt = ApiHelpers.Iso(notification.CreatedAt),
        };
    }

    public object SerializeRepository(ProjectRepository repo) => new
    {
        id = repo.Id,
        githubRepoId = repo.GithubRepoId,
        name = repo.Name,
        fullName = repo.FullName,
        htmlUrl = repo.HtmlUrl,
        defaultBranch = repo.DefaultBranch,
        visibility = repo.Visibility,
        owner = repo.OwnerLogin,
    };

    public object SerializeIssueLink(GitHubIssueLink link) => new
    {
        id = link.Id,
        repositoryFullName = link.RepositoryFullName,
        issueNumber = link.IssueNumber,
        title = link.Title,
        htmlUrl = link.HtmlUrl,
        state = link.State,
        createdAt = ApiHelpers.Iso(link.CreatedAt),
    };

    public object SerializeSprint(Sprint? sprint)
    {
        if (sprint is null)
        {
            return null!;
        }

        return new
        {
            id = sprint.Id,
            number = sprint.Number,
            name = sprint.Name,
            status = sprint.Status,
            reviewText = sprint.ReviewText,
            summary = ApiHelpers.JsonObjectFromText(sprint.Summary),
            startedAt = ApiHelpers.Iso(sprint.StartedAt),
            endedAt = ApiHelpers.Iso(sprint.EndedAt),
            createdAt = ApiHelpers.Iso(sprint.CreatedAt),
            updatedAt = ApiHelpers.Iso(sprint.UpdatedAt),
        };
    }

    public async Task<object> BuildProjectSnapshotAsync(SqliteConnection connection, Project project, User user, ProjectMembership? membership = null)
    {
        membership ??= await connection.QueryFirstOrDefaultAsync<ProjectMembership>(
            "select * from projects_projectmembership where project_id = @ProjectId and user_id = @UserId and status = @Status",
            new { ProjectId = project.Id, UserId = user.Id, Status = StatusActive });
        if (membership is null)
        {
            throw new InvalidOperationException("Project membership required.");
        }

        var activeSprint = project.UseSprints ? await EnsureActiveSprintAsync(connection, project) : await GetActiveSprintAsync(connection, project);
        var sprintHistory = (await connection.QueryAsync<Sprint>("select * from projects_sprint where project_id = @ProjectId and status = 'completed' order by number desc, id desc", new { ProjectId = project.Id })).ToList();
        var organization = project.OrganizationId is null ? null : await connection.QueryFirstOrDefaultAsync<Organization>("select * from projects_organization where id = @Id", new { Id = project.OrganizationId });
        var repositories = (await connection.QueryAsync<ProjectRepository>("select * from projects_projectrepository where project_id = @ProjectId order by full_name, id", new { ProjectId = project.Id })).ToList();
        var members = (await connection.QueryAsync<ProjectMembership>("select * from projects_projectmembership where project_id = @ProjectId and status = @Status order by id", new { ProjectId = project.Id, Status = StatusActive })).ToList();
        var tasks = (await connection.QueryAsync<TaskItem>("select * from projects_task where project_id = @ProjectId order by status, updated_at desc, id desc", new { ProjectId = project.Id })).ToList();
        var bugs = (await connection.QueryAsync<BugReport>("select * from projects_bugreport where project_id = @ProjectId order by updated_at desc, id desc", new { ProjectId = project.Id })).ToList();
        var taskComments = (await connection.QueryAsync<TaskComment>(
            "select c.* from projects_taskcomment c join projects_task t on t.id = c.task_id where t.project_id = @ProjectId order by c.created_at, c.id",
            new { ProjectId = project.Id })).ToList();
        var bugComments = (await connection.QueryAsync<BugComment>(
            "select c.* from projects_bugcomment c join projects_bugreport b on b.id = c.bug_report_id where b.project_id = @ProjectId order by c.created_at, c.id",
            new { ProjectId = project.Id })).ToList();
        var taskReactions = (await connection.QueryAsync<CommentReaction>(
            "select r.* from projects_taskcommentreaction r join projects_taskcomment c on c.id = r.comment_id join projects_task t on t.id = c.task_id where t.project_id = @ProjectId order by r.emoji, r.id",
            new { ProjectId = project.Id })).ToList();
        var bugReactions = (await connection.QueryAsync<CommentReaction>(
            "select r.* from projects_bugcommentreaction r join projects_bugcomment c on c.id = r.comment_id join projects_bugreport b on b.id = c.bug_report_id where b.project_id = @ProjectId order by r.emoji, r.id",
            new { ProjectId = project.Id })).ToList();
        var activities = (await connection.QueryAsync<Activity>("select * from projects_activity where project_id = @ProjectId order by created_at, id", new { ProjectId = project.Id })).ToList();
        var issueLinks = (await connection.QueryAsync<GitHubIssueLink>("select * from projects_githubissuelink where project_id = @ProjectId order by repository_full_name, issue_number, id", new { ProjectId = project.Id })).ToList();

        var bugById = bugs.ToDictionary(b => b.Id);
        var taskById = tasks.ToDictionary(t => t.Id);
        var sprintById = (await connection.QueryAsync<Sprint>("select * from projects_sprint where project_id = @ProjectId", new { ProjectId = project.Id })).ToDictionary(s => s.Id);
        var taskCommentsByTask = taskComments.GroupBy(c => c.TaskId).ToDictionary(g => g.Key, g => g.ToList());
        var bugCommentsByBug = bugComments.GroupBy(c => c.BugReportId).ToDictionary(g => g.Key, g => g.ToList());
        var taskReactionsByComment = taskReactions.GroupBy(r => r.CommentId).ToDictionary(g => g.Key, g => g.ToList());
        var bugReactionsByComment = bugReactions.GroupBy(r => r.CommentId).ToDictionary(g => g.Key, g => g.ToList());
        var taskActivities = activities.Where(a => a.TaskId is not null).GroupBy(a => a.TaskId!.Value).ToDictionary(g => g.Key, g => g.ToList());
        var bugActivities = activities.Where(a => a.BugReportId is not null).GroupBy(a => a.BugReportId!.Value).ToDictionary(g => g.Key, g => g.ToList());
        var directLinksByTask = issueLinks.Where(l => l.TaskId is not null).GroupBy(l => l.TaskId!.Value).ToDictionary(g => g.Key, g => g.ToList());
        var linksByBug = issueLinks.Where(l => l.BugReportId is not null).GroupBy(l => l.BugReportId!.Value).ToDictionary(g => g.Key, g => g.ToList());
        var bugTasks = tasks.Where(t => t.BugReportId is not null).GroupBy(t => t.BugReportId!.Value).ToDictionary(g => g.Key, g => g.ToList());
        var resolvedBugsByTask = bugs.Where(b => b.ResolutionTaskId is not null).GroupBy(b => b.ResolutionTaskId!.Value).ToDictionary(g => g.Key, g => g.ToList());

        var serializedTasks = new List<object>();
        foreach (var task in tasks)
        {
            serializedTasks.Add(await SerializeTaskAsync(
                connection,
                task,
                bugById.GetValueOrDefault(task.BugReportId ?? -1),
                sprintById.GetValueOrDefault(task.SprintId ?? -1),
                taskCommentsByTask.GetValueOrDefault(task.Id, []),
                taskReactionsByComment,
                user.Id,
                taskActivities.GetValueOrDefault(task.Id, []),
                directLinksByTask.GetValueOrDefault(task.Id, []),
                task.BugReportId is null ? [] : linksByBug.GetValueOrDefault(task.BugReportId.Value, []),
                resolvedBugsByTask.GetValueOrDefault(task.Id, [])));
        }

        var serializedBugs = new List<object>();
        foreach (var bug in bugs)
        {
            serializedBugs.Add(await SerializeBugReportAsync(
                connection,
                bug,
                taskById.GetValueOrDefault(bug.ResolutionTaskId ?? -1),
                bugCommentsByBug.GetValueOrDefault(bug.Id, []),
                bugReactionsByComment,
                user.Id,
                bugActivities.GetValueOrDefault(bug.Id, []),
                linksByBug.GetValueOrDefault(bug.Id, []),
                bugTasks.GetValueOrDefault(bug.Id, [])));
        }

        var serializedMembers = new List<object>();
        foreach (var item in members)
        {
            serializedMembers.Add(new
            {
                id = item.Id,
                role = item.Role,
                user = await SerializeUserAsync(connection, item.UserId),
                addedAt = ApiHelpers.Iso(item.CreatedAt),
            });
        }

        var recentActivity = new List<object>();
        foreach (var activity in activities.OrderByDescending(a => a.CreatedAt).Take(40))
        {
            recentActivity.Add(await SerializeActivityAsync(connection, activity));
        }

        return new
        {
            id = project.Id,
            organizationId = project.OrganizationId,
            organizationName = organization?.Name ?? "",
            name = project.Name,
            description = project.Description,
            useSprints = project.UseSprints,
            activeSprint = SerializeSprint(activeSprint),
            sprintHistory = sprintHistory.Select(SerializeSprint),
            ownerId = project.OwnerId,
            role = membership.Role,
            permissions = SerializePermissions(membership),
            repositories = repositories.Select(SerializeRepository),
            members = serializedMembers,
            boardColumns = new[] { new { id = TaskTodo, label = "To Do" }, new { id = TaskInProgress, label = "In Progress" }, new { id = TaskInReview, label = "In Review" }, new { id = TaskDone, label = "Done" } },
            taskStatusLabels = TaskStatusLabels,
            bugStatusLabels = BugStatusLabels,
            tasks = serializedTasks,
            bugReports = serializedBugs,
            recentActivity,
            createdAt = ApiHelpers.Iso(project.CreatedAt),
            updatedAt = ApiHelpers.Iso(project.UpdatedAt),
        };
    }

    private object SerializePermissions(ProjectMembership membership) => new
    {
        canCreateTasks = RoleAtLeast(membership, RoleMember),
        canCreateBugReports = RoleAtLeast(membership, RoleMember),
        canMoveTasks = RoleAtLeast(membership, RoleMember),
        canAssignTasks = RoleAtLeast(membership, RoleMember),
        canComment = RoleAtLeast(membership, RoleMember),
        canEditTasks = RoleAtLeast(membership, RoleMember),
        canEditBugs = RoleAtLeast(membership, RoleAdmin),
        canManageUsers = RoleAtLeast(membership, RoleAdmin),
        canManageProject = RoleAtLeast(membership, RoleAdmin),
        canManageRepos = membership.Role == RoleOwner,
        canDeleteProject = membership.Role == RoleOwner,
        isReadOnly = membership.Role == RoleViewer,
    };

    private async Task<object> SerializeTaskAsync(
        SqliteConnection connection,
        TaskItem task,
        BugReport? bugReport,
        Sprint? sprint,
        List<TaskComment> comments,
        Dictionary<long, List<CommentReaction>> reactionsByComment,
        long currentUserId,
        List<Activity> activities,
        List<GitHubIssueLink> directIssueLinks,
        List<GitHubIssueLink> inheritedIssueLinks,
        List<BugReport> resolvedBugs)
    {
        var assignees = (await connection.QueryAsync<User>(
            """
            select u.*
            from auth_user u
            join projects_task_assignees a on a.user_id = u.id
            where a.task_id = @TaskId
            order by u.username
            """,
            new { TaskId = task.Id })).ToList();
        var serializedComments = new List<object>();
        foreach (var comment in comments)
        {
            serializedComments.Add(await SerializeCommentAsync(connection, comment, reactionsByComment.GetValueOrDefault(comment.Id, []), currentUserId));
        }

        var serializedActivities = new List<object>();
        foreach (var activity in activities)
        {
            serializedActivities.Add(await SerializeActivityAsync(connection, activity));
        }

        return new
        {
            id = task.Id,
            title = task.Title,
            description = task.Description,
            status = task.Status,
            priority = task.Priority,
            creator = await SerializeUserAsync(connection, task.CreatorId),
            assignees = await SerializeUsersAsync(connection, assignees),
            sprintId = task.SprintId,
            sprintName = sprint?.Name ?? "",
            bugReportId = task.BugReportId,
            bugReportTitle = bugReport?.Title ?? "",
            isResolutionTask = bugReport is not null && bugReport.ResolutionTaskId == task.Id,
            branchName = task.BranchName,
            branchUrl = task.BranchUrl,
            branchRepositoryId = task.BranchRepositoryId,
            resolvedBugs = resolvedBugs.Select(SerializeResolvedBugSummary),
            directGitHubIssues = directIssueLinks.Select(SerializeIssueLink),
            inheritedGitHubIssues = inheritedIssueLinks.Select(SerializeIssueLink),
            comments = serializedComments,
            activity = serializedActivities,
            createdAt = ApiHelpers.Iso(task.CreatedAt),
            updatedAt = ApiHelpers.Iso(task.UpdatedAt),
        };
    }

    private async Task<object> SerializeBugReportAsync(
        SqliteConnection connection,
        BugReport bug,
        TaskItem? resolutionTask,
        List<BugComment> comments,
        Dictionary<long, List<CommentReaction>> reactionsByComment,
        long currentUserId,
        List<Activity> activities,
        List<GitHubIssueLink> issueLinks,
        List<TaskItem> bugTasks)
    {
        var serializedComments = new List<object>();
        foreach (var comment in comments)
        {
            serializedComments.Add(await SerializeCommentAsync(connection, comment, reactionsByComment.GetValueOrDefault(comment.Id, []), currentUserId));
        }

        var serializedActivities = new List<object>();
        foreach (var activity in activities)
        {
            serializedActivities.Add(await SerializeActivityAsync(connection, activity));
        }

        var taskSummaries = new List<object>();
        foreach (var task in bugTasks)
        {
            var assigneeCount = await connection.ExecuteScalarAsync<int>(
                "select count(*) from projects_task_assignees where task_id = @TaskId",
                new { TaskId = task.Id });
            var sprint = task.SprintId is null
                ? null
                : await connection.QueryFirstOrDefaultAsync<Sprint>("select * from projects_sprint where id = @Id", new { Id = task.SprintId });
            taskSummaries.Add(SerializeTaskSummary(task, bug, sprint, assigneeCount));
        }

        return new
        {
            id = bug.Id,
            title = bug.Title,
            description = bug.Description,
            status = bug.Status,
            priority = bug.Priority,
            reporter = await SerializeUserAsync(connection, bug.ReporterId),
            resolutionTaskId = bug.ResolutionTaskId,
            resolutionTaskTitle = resolutionTask?.Title ?? "",
            linkedGitHubIssues = issueLinks.Select(SerializeIssueLink),
            tasks = taskSummaries,
            comments = serializedComments,
            activity = serializedActivities,
            closedAt = ApiHelpers.Iso(bug.ClosedAt),
            createdAt = ApiHelpers.Iso(bug.CreatedAt),
            updatedAt = ApiHelpers.Iso(bug.UpdatedAt),
        };
    }

    private async Task<List<object>> SerializeUsersAsync(SqliteConnection connection, IEnumerable<User> users)
    {
        var result = new List<object>();
        foreach (var user in users)
        {
            result.Add(await SerializeUserAsync(connection, user));
        }

        return result;
    }

    private async Task<object> SerializeCommentAsync(SqliteConnection connection, dynamic comment, List<CommentReaction> reactions, long currentUserId)
    {
        long authorId = comment.AuthorId;
        return new
        {
            id = comment.Id,
            body = comment.Body,
            author = await SerializeUserAsync(connection, authorId),
            anchorType = comment.AnchorType,
            anchorId = comment.AnchorId,
            anchorLabel = comment.AnchorLabel,
            reactions = SerializeCommentReactions(reactions, currentUserId),
            createdAt = ApiHelpers.Iso(comment.CreatedAt),
            updatedAt = ApiHelpers.Iso(comment.UpdatedAt),
        };
    }

    private IEnumerable<object> SerializeCommentReactions(List<CommentReaction> reactions, long currentUserId)
    {
        var grouped = reactions
            .GroupBy(reaction => reaction.Emoji)
            .ToDictionary(
                group => group.Key,
                group => new
                {
                    emoji = group.Key,
                    count = group.Count(),
                    reactedByUser = group.Any(reaction => reaction.UserId == currentUserId),
                });
        return ReactionEmojis.Where(grouped.ContainsKey).Select(emoji => grouped[emoji]);
    }

    public object SerializeTaskSummary(TaskItem task, BugReport? bugReport = null, Sprint? sprint = null, int assigneeCount = 0) => new
    {
        id = task.Id,
        title = task.Title,
        status = task.Status,
        priority = task.Priority,
        assigneeCount,
        sprintId = task.SprintId,
        sprintName = sprint?.Name ?? "",
        isResolutionTask = bugReport is not null && bugReport.ResolutionTaskId == task.Id,
    };

    public object SerializeResolvedBugSummary(BugReport bug) => new
    {
        id = bug.Id,
        title = bug.Title,
        status = bug.Status,
        priority = bug.Priority,
    };

    public async Task<object> SerializeActivityAsync(SqliteConnection connection, Activity activity) => new
    {
        id = activity.Id,
        action = activity.Action,
        description = activity.Description,
        actor = activity.ActorId is null ? null : await SerializeUserAsync(connection, activity.ActorId.Value),
        taskId = activity.TaskId,
        bugReportId = activity.BugReportId,
        metadata = ApiHelpers.JsonObjectFromText(activity.Metadata),
        createdAt = ApiHelpers.Iso(activity.CreatedAt),
    };

    public object SerializeGitHubIssueCandidate(ProjectRepository repository, JsonObject issue)
    {
        var body = (issue.Value<string>("body") ?? "").Trim();
        var preview = Regex.Replace(body, @"\s+", " ");
        if (preview.Length > 180)
        {
            preview = $"{preview[..177].TrimEnd()}...";
        }

        var author = issue["user"]?.AsObject();
        var labels = issue["labels"] is JsonArray labelArray
            ? labelArray.OfType<JsonObject>().Select(label => label.Value<string>("name") ?? "").Where(x => x.Length > 0).ToArray()
            : [];
        return new
        {
            repositoryId = repository.Id,
            repositoryFullName = repository.FullName,
            issueNumber = issue.Value<long?>("number"),
            title = issue.Value<string>("title") ?? "",
            htmlUrl = issue.Value<string>("html_url") ?? "",
            state = issue.Value<string>("state") ?? "open",
            authorLogin = author?.Value<string>("login") ?? "",
            labels,
            bodyPreview = preview,
            updatedAt = issue.Value<string>("updated_at") ?? issue.Value<string>("created_at") ?? "",
        };
    }

    public (string AnchorType, string AnchorId, string AnchorLabel) ParseCommentAnchor(JsonObject payload)
    {
        var anchorType = (payload.Value<string>("anchorType") ?? "").Trim();
        var anchorId = (payload["anchorId"]?.ToString() ?? "").Trim();
        var anchorLabel = (payload.Value<string>("anchorLabel") ?? "").Trim();
        if (anchorLabel.Length > 255)
        {
            anchorLabel = anchorLabel[..255];
        }

        if (!string.IsNullOrWhiteSpace(anchorType) && anchorType is not ("description" or "comment"))
        {
            throw new ArgumentException("Choose a valid inline comment target.");
        }

        if (!string.IsNullOrWhiteSpace(anchorType) && string.IsNullOrWhiteSpace(anchorId))
        {
            throw new ArgumentException("Inline comments need a target anchor.");
        }

        return string.IsNullOrWhiteSpace(anchorType) ? ("", "", "") : (anchorType, anchorId, anchorLabel);
    }

    public string ParseCommentReaction(JsonObject payload)
    {
        var emoji = (payload.Value<string>("emoji") ?? "").Trim();
        if (!ReactionEmojis.Contains(emoji))
        {
            throw new ArgumentException("Choose a valid reaction emoji.");
        }

        return emoji;
    }

    public bool IsValidTaskStatus(string value) => TaskStatusLabels.ContainsKey(value);

    public bool IsValidBugStatus(string value) => BugStatusLabels.ContainsKey(value);

    public bool IsValidPriority(string value) => PriorityLabels.ContainsKey(value);

    public string TaskStatusLabel(string value) => TaskStatusLabels.GetValueOrDefault(value, value);

    public string BugStatusLabel(string value) => BugStatusLabels.GetValueOrDefault(value, value);

    public string PriorityLabel(string value) => PriorityLabels.GetValueOrDefault(value, value);

    public static string TitleCase(string value) => string.IsNullOrWhiteSpace(value) ? value : char.ToUpperInvariant(value[0]) + value[1..];

    private static string BuildPersonalOrganizationName(User user) => $"{user.Username} workspace";
}

public sealed class SetLong : HashSet<long>;
