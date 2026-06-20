using System.Text.Json.Nodes;
using Dapper;

public static partial class ApiEndpoints
{
    private static Task<IResult> ProjectMemberInviteCore(long projectId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var (project, membership, error) = await projects.LoadProjectAsync(connection, projectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (!projects.RoleAtLeast(membership, ProjectService.RoleAdmin)) return ApiHelpers.JsonError("Only admins and owners can manage users.", StatusCodes.Status403Forbidden);
            var organization = project.OrganizationId is null ? null : await connection.QueryFirstOrDefaultAsync<Organization>("select * from projects_organization where id = @Id", new { Id = project.OrganizationId });
            if (organization is null || organization.IsPersonal) return ApiHelpers.JsonError("Personal workspaces do not support sharing projects.", StatusCodes.Status403Forbidden);
            var (payload, parseError) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (parseError is not null || payload is null) return parseError!;
            var identifier = (payload.Value<string>("identifier") ?? "").Trim();
            var role = (payload.Value<string>("role") ?? ProjectService.RoleMember).Trim();
            if (string.IsNullOrWhiteSpace(identifier)) return ApiHelpers.JsonError("Provide a username or email address.");
            if (role is not (ProjectService.RoleAdmin or ProjectService.RoleMember or ProjectService.RoleViewer)) return ApiHelpers.JsonError("Choose a valid project role.");
            var invitedUser = await FindUserByIdentifierAsync(connection, identifier);
            if (invitedUser is null) return ApiHelpers.JsonError("That user does not exist yet.", StatusCodes.Status404NotFound);
            var existing = await connection.QueryFirstOrDefaultAsync<OrganizationMembership>("select * from projects_organizationmembership where organization_id = @OrganizationId and user_id = @UserId", new { OrganizationId = organization.Id, UserId = invitedUser.Id });
            if (existing is not null) return ApiHelpers.JsonError(existing.Status == ProjectService.StatusInvited ? "That user already has a pending invite." : "That user is already part of this organization.", StatusCodes.Status409Conflict);
            await projects.InviteUserToOrganizationAsync(connection, organization, user, invitedUser, role);
            await projects.RecordActivityAsync(connection, project, user, "project.member_invited", $"Invited {invitedUser.Username} to the organization as {ProjectService.TitleCase(role)}.");
            return await ProjectResponse(connection, projects, project, user, membership);
        });
    }

    private static Task<IResult> ProjectMemberRoleCore(long projectId, long membershipId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var (project, membership, error) = await projects.LoadProjectAsync(connection, projectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (!projects.RoleAtLeast(membership, ProjectService.RoleAdmin)) return ApiHelpers.JsonError("Only admins and owners can change roles.", StatusCodes.Status403Forbidden);
            var target = await connection.QueryFirstOrDefaultAsync<ProjectMembership>("select * from projects_projectmembership where project_id = @ProjectId and id = @Id", new { ProjectId = project.Id, Id = membershipId });
            if (target is null) return ApiHelpers.JsonError("Project member not found.", StatusCodes.Status404NotFound);
            if (target.Role == ProjectService.RoleOwner) return ApiHelpers.JsonError("The project owner role cannot be reassigned here.");
            var (payload, parseError) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (parseError is not null || payload is null) return parseError!;
            var nextRole = (payload.Value<string>("role") ?? "").Trim();
            if (nextRole is not (ProjectService.RoleAdmin or ProjectService.RoleMember or ProjectService.RoleViewer)) return ApiHelpers.JsonError("Choose a valid project role.");
            if (project.OrganizationId is not null)
            {
                var organization = await connection.QueryFirstAsync<Organization>("select * from projects_organization where id = @Id", new { Id = project.OrganizationId });
                var actorOrg = await projects.ActiveOrganizationMembershipAsync(connection, organization, user);
                var targetOrg = await connection.QueryFirstOrDefaultAsync<OrganizationMembership>("select * from projects_organizationmembership where organization_id = @OrganizationId and user_id = @UserId", new { OrganizationId = project.OrganizationId, UserId = target.UserId });
                if (actorOrg is null || targetOrg is null) return ApiHelpers.JsonError("Organization member not found.", StatusCodes.Status404NotFound);
                if (!projects.CanManageTargetOrganizationMembership(actorOrg, targetOrg)) return ApiHelpers.JsonError("You do not have permission to change that role.", StatusCodes.Status403Forbidden);
                if (actorOrg.Role == ProjectService.RoleAdmin && nextRole == ProjectService.RoleAdmin) return ApiHelpers.JsonError("Only the organization owner can assign the admin role.", StatusCodes.Status403Forbidden);
                await connection.ExecuteAsync("update projects_organizationmembership set role = @Role, updated_at = @Now where id = @Id", new { Role = nextRole, Now = ApiHelpers.NowSql(), targetOrg.Id });
                targetOrg.Role = nextRole;
                await projects.SyncOrganizationMembershipToProjectsAsync(connection, targetOrg);
            }
            else
            {
                await connection.ExecuteAsync("update projects_projectmembership set role = @Role, updated_at = @Now where id = @Id", new { Role = nextRole, Now = ApiHelpers.NowSql(), target.Id });
            }

            var targetUser = await connection.QueryFirstAsync<User>("select * from auth_user where id = @Id", new { Id = target.UserId });
            await projects.RecordActivityAsync(connection, project, user, "project.role_changed", $"Changed {targetUser.Username}'s role to {ProjectService.TitleCase(nextRole)}.");
            if (target.UserId != user.Id)
            {
                await projects.CreateNotificationAsync(connection, target.UserId, user.Id, projectId: project.Id, kind: ProjectService.KindSystem, message: $"{user.Username} changed your role in \"{project.Name}\" to {ProjectService.TitleCase(nextRole)}.");
            }

            return await ProjectResponse(connection, projects, project, user, membership);
        });
    }

    private static Task<IResult> ProjectMemberRemoveCore(long projectId, long membershipId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var (project, membership, error) = await projects.LoadProjectAsync(connection, projectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (!projects.RoleAtLeast(membership, ProjectService.RoleAdmin)) return ApiHelpers.JsonError("Only admins and owners can remove users.", StatusCodes.Status403Forbidden);
            var target = await connection.QueryFirstOrDefaultAsync<ProjectMembership>("select * from projects_projectmembership where project_id = @ProjectId and id = @Id", new { ProjectId = project.Id, Id = membershipId });
            if (target is null) return ApiHelpers.JsonError("Project member not found.", StatusCodes.Status404NotFound);
            if (target.Role == ProjectService.RoleOwner) return ApiHelpers.JsonError("The project owner cannot be removed.");
            if (target.UserId == user.Id) return ApiHelpers.JsonError("Use leave organization instead of removing yourself.", StatusCodes.Status400BadRequest);
            var targetUser = await connection.QueryFirstAsync<User>("select * from auth_user where id = @Id", new { Id = target.UserId });
            if (project.OrganizationId is not null)
            {
                var organization = await connection.QueryFirstAsync<Organization>("select * from projects_organization where id = @Id", new { Id = project.OrganizationId });
                var actorOrg = await projects.ActiveOrganizationMembershipAsync(connection, organization, user);
                var targetOrg = await connection.QueryFirstOrDefaultAsync<OrganizationMembership>("select * from projects_organizationmembership where organization_id = @OrganizationId and user_id = @UserId", new { OrganizationId = project.OrganizationId, UserId = target.UserId });
                if (actorOrg is null || targetOrg is null) return ApiHelpers.JsonError("Organization member not found.", StatusCodes.Status404NotFound);
                if (!projects.CanManageTargetOrganizationMembership(actorOrg, targetOrg)) return ApiHelpers.JsonError("You do not have permission to remove that user.", StatusCodes.Status403Forbidden);
                await projects.RemoveOrganizationMembershipFromProjectsAsync(connection, organization, target.UserId);
                await connection.ExecuteAsync("delete from projects_organizationmembership where id = @Id", new { targetOrg.Id });
            }
            else
            {
                await connection.ExecuteAsync("delete from projects_projectmembership where id = @Id", new { target.Id });
            }

            await projects.RecordActivityAsync(connection, project, user, "project.member_removed", $"Removed {targetUser.Username} from the project.");
            return await ProjectResponse(connection, projects, project, user, membership);
        });
    }

    private static Task<IResult> CreateTaskCore(long projectId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var (project, membership, error) = await projects.LoadProjectAsync(connection, projectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (!projects.RoleAtLeast(membership, ProjectService.RoleMember)) return ApiHelpers.JsonError("Only project members can create tasks.", StatusCodes.Status403Forbidden);
            var (payload, parseError) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (parseError is not null || payload is null) return parseError!;
            var title = (payload.Value<string>("title") ?? "").Trim();
            var description = (payload.Value<string>("description") ?? "").Trim();
            var status = (payload.Value<string>("status") ?? ProjectService.TaskTodo).Trim();
            if (string.IsNullOrWhiteSpace(status)) status = ProjectService.TaskTodo;
            var priority = (payload.Value<string>("priority") ?? ProjectService.PriorityMedium).Trim();
            if (string.IsNullOrWhiteSpace(priority)) priority = ProjectService.PriorityMedium;
            var placement = (payload.Value<string>("placement") ?? (project.UseSprints ? "sprint" : "product")).Trim();
            if (string.IsNullOrWhiteSpace(title)) return ApiHelpers.JsonError("Task title is required.");
            if (!projects.IsValidTaskStatus(status)) return ApiHelpers.JsonError("Choose a valid task status.");
            if (!projects.IsValidPriority(priority)) return ApiHelpers.JsonError("Choose a valid task priority.");
            if (placement is not ("sprint" or "product")) return ApiHelpers.JsonError("Choose a valid backlog placement.");
            var assigneeIds = LongArray(payload, "assigneeIds");
            if (project.OrganizationId is not null)
            {
                var org = await connection.QueryFirstOrDefaultAsync<Organization>("select * from projects_organization where id = @Id", new { Id = project.OrganizationId });
                if (org?.IsPersonal == true) assigneeIds = [user.Id];
            }

            BugReport? bug = null;
            var bugReportId = NullableLong(payload, "bugReportId");
            if (bugReportId is not null)
            {
                bug = await connection.QueryFirstOrDefaultAsync<BugReport>("select * from projects_bugreport where project_id = @ProjectId and id = @Id", new { ProjectId = project.Id, Id = bugReportId });
                if (bug is null) return ApiHelpers.JsonError("Bug report not found.", StatusCodes.Status404NotFound);
            }

            var sprint = project.UseSprints && placement == "sprint" ? await projects.EnsureActiveSprintAsync(connection, project) : null;
            var now = ApiHelpers.NowSql();
            await connection.ExecuteAsync(
                """
                insert into projects_task
                (project_id, bug_report_id, sprint_id, title, description, status, priority, creator_id, branch_name, branch_url, branch_repository_id, created_at, updated_at)
                values (@ProjectId, @BugReportId, @SprintId, @Title, @Description, @Status, @Priority, @CreatorId, '', '', null, @Now, @Now)
                """,
                new { ProjectId = project.Id, BugReportId = bug?.Id, SprintId = sprint?.Id, Title = title, Description = description, Status = status, Priority = priority, CreatorId = user.Id, Now = now });
            var task = await connection.QueryFirstAsync<TaskItem>("select * from projects_task where id = last_insert_rowid()");
            var assignees = await projects.ProjectMembersByIdsAsync(connection, project, assigneeIds);
            foreach (var assignee in assignees)
            {
                await connection.ExecuteAsync("insert or ignore into projects_task_assignees (task_id, user_id) values (@TaskId, @UserId)", new { TaskId = task.Id, UserId = assignee.Id });
            }

            var locationLabel = sprint?.Name ?? "Product Backlog";
            await projects.RecordActivityAsync(connection, project, user, "task.created", $"Created task \"{task.Title}\" in {locationLabel}.", task, bug);
            if (assignees.Count > 0)
            {
                await projects.RecordActivityAsync(connection, project, user, "task.assigned", $"Assigned {string.Join(", ", assignees.Select(a => a.Username))} to task \"{task.Title}\".", task, bug);
                await projects.NotifyNewAssigneesAsync(connection, task, user, assignees);
            }

            if (payload.Value<bool?>("markAsResolution") == true && bug is not null)
            {
                await connection.ExecuteAsync("update projects_bugreport set resolution_task_id = @TaskId, updated_at = @Now where id = @Id", new { TaskId = task.Id, Now = ApiHelpers.NowSql(), bug.Id });
                await projects.RecordActivityAsync(connection, project, user, "bug.resolution_task_set", $"Set task \"{task.Title}\" as the resolution task for bug \"{bug.Title}\".", task, bug);
            }

            await projects.NotifyMentionsAsync(connection, project, user, description, $"task \"{task.Title}\"", task, bug);
            await projects.CloseBugsFromResolutionTaskAsync(connection, task, user);
            return await ProjectResponse(connection, projects, project, user, membership, StatusCodes.Status201Created);
        });
    }

    private static Task<IResult> UpdateTaskCore(long taskId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var task = await connection.QueryFirstOrDefaultAsync<TaskItem>("select * from projects_task where id = @Id", new { Id = taskId });
            if (task is null) return ApiHelpers.JsonError("Task not found.", StatusCodes.Status404NotFound);
            var (project, membership, error) = await projects.LoadProjectAsync(connection, task.ProjectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (!projects.RoleAtLeast(membership, ProjectService.RoleMember)) return ApiHelpers.JsonError("Only project members can update tasks.", StatusCodes.Status403Forbidden);
            var bug = task.BugReportId is null ? null : await connection.QueryFirstOrDefaultAsync<BugReport>("select * from projects_bugreport where id = @Id", new { Id = task.BugReportId });
            var sprint = task.SprintId is null ? null : await connection.QueryFirstOrDefaultAsync<Sprint>("select * from projects_sprint where id = @Id", new { Id = task.SprintId });
            var (payload, parseError) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (parseError is not null || payload is null) return parseError!;
            var changed = new List<string>();
            if (payload.ContainsKey("title"))
            {
                var title = (payload.Value<string>("title") ?? "").Trim();
                if (string.IsNullOrWhiteSpace(title)) return ApiHelpers.JsonError("Task title is required.");
                if (title != task.Title) { task.Title = title; changed.Add("title"); }
            }
            if (payload.ContainsKey("description"))
            {
                var description = (payload.Value<string>("description") ?? "").Trim();
                if (description != task.Description)
                {
                    task.Description = description;
                    changed.Add("description");
                    await projects.NotifyMentionsAsync(connection, project, user, description, $"task \"{task.Title}\"", task, bug);
                }
            }
            if (payload.ContainsKey("status"))
            {
                var next = (payload.Value<string>("status") ?? "").Trim();
                if (!projects.IsValidTaskStatus(next)) return ApiHelpers.JsonError("Choose a valid task status.");
                if (next != task.Status)
                {
                    var previousLabel = projects.TaskStatusLabel(task.Status);
                    var nextLabel = projects.TaskStatusLabel(next);
                    task.Status = next;
                    changed.Add("status");
                    await projects.RecordActivityAsync(connection, project, user, "task.status_changed", $"Moved task \"{task.Title}\" from {previousLabel} to {nextLabel}.", task, bug);
                }
            }
            if (payload.ContainsKey("priority"))
            {
                var next = (payload.Value<string>("priority") ?? "").Trim();
                if (!projects.IsValidPriority(next)) return ApiHelpers.JsonError("Choose a valid task priority.");
                if (next != task.Priority)
                {
                    var previousLabel = projects.PriorityLabel(task.Priority);
                    var nextLabel = projects.PriorityLabel(next);
                    task.Priority = next;
                    changed.Add("priority");
                    await projects.RecordActivityAsync(connection, project, user, "task.priority_changed", $"Changed task \"{task.Title}\" priority from {previousLabel} to {nextLabel}.", task, bug);
                }
            }
            if (payload.ContainsKey("placement"))
            {
                var placement = (payload.Value<string>("placement") ?? "").Trim();
                if (placement is not ("sprint" or "product")) return ApiHelpers.JsonError("Choose a valid backlog placement.");
                var nextSprint = project.UseSprints && placement == "sprint" ? await projects.EnsureActiveSprintAsync(connection, project) : null;
                if (task.SprintId != nextSprint?.Id)
                {
                    var previousLabel = sprint?.Name ?? "Product Backlog";
                    var nextLabel = nextSprint?.Name ?? "Product Backlog";
                    task.SprintId = nextSprint?.Id;
                    changed.Add("sprint");
                    await projects.RecordActivityAsync(connection, project, user, "task.backlog_changed", $"Moved task \"{task.Title}\" from {previousLabel} to {nextLabel}.", task, bug);
                }
            }

            if (changed.Count > 0)
            {
                await connection.ExecuteAsync(
                    "update projects_task set title = @Title, description = @Description, status = @Status, priority = @Priority, sprint_id = @SprintId, updated_at = @Now where id = @Id",
                    new { task.Title, task.Description, task.Status, task.Priority, task.SprintId, Now = ApiHelpers.NowSql(), task.Id });
                if (changed.Any(field => field is "title" or "description"))
                {
                    await projects.RecordActivityAsync(connection, project, user, "task.updated", $"Updated task \"{task.Title}\" details.", task, bug);
                }
            }

            if (payload.ContainsKey("assigneeIds"))
            {
                var requestedIds = LongArray(payload, "assigneeIds");
                var currentIds = (await connection.QueryAsync<long>("select user_id from projects_task_assignees where task_id = @TaskId", new { TaskId = task.Id })).ToHashSet();
                var nextAssignees = await projects.ProjectMembersByIdsAsync(connection, project, requestedIds);
                var nextIds = nextAssignees.Select(a => a.Id).ToHashSet();
                var added = nextAssignees.Where(a => !currentIds.Contains(a.Id)).ToList();
                var removedIds = currentIds.Except(nextIds).ToList();
                await connection.ExecuteAsync("delete from projects_task_assignees where task_id = @TaskId", new { TaskId = task.Id });
                foreach (var assignee in nextAssignees) await connection.ExecuteAsync("insert or ignore into projects_task_assignees (task_id, user_id) values (@TaskId, @UserId)", new { TaskId = task.Id, UserId = assignee.Id });
                if (added.Count > 0 || removedIds.Count > 0)
                {
                    var changes = new List<string>();
                    if (added.Count > 0) changes.Add($"added {string.Join(", ", added.Select(a => a.Username))}");
                    if (removedIds.Count > 0)
                    {
                        var removedNames = await connection.QueryAsync<string>("select username from auth_user where id in @Ids order by username", new { Ids = removedIds });
                        changes.Add($"removed {string.Join(", ", removedNames)}");
                    }
                    await projects.RecordActivityAsync(connection, project, user, "task.assignees_changed", $"Updated assignees on task \"{task.Title}\": {string.Join("; ", changes)}.", task, bug);
                    await projects.NotifyNewAssigneesAsync(connection, task, user, added);
                }
            }

            if (payload.ContainsKey("resolvedBugIds"))
            {
                var requestedIds = LongArray(payload, "resolvedBugIds").Distinct().ToArray();
                var requestedBugs = (await connection.QueryAsync<BugReport>("select * from projects_bugreport where project_id = @ProjectId and id in @Ids", new { ProjectId = project.Id, Ids = requestedIds.Length == 0 ? [-1L] : requestedIds })).ToList();
                if (requestedBugs.Count != requestedIds.Length) return ApiHelpers.JsonError("Choose valid bugs for this task to resolve.");
                var currentIds = (await connection.QueryAsync<long>("select id from projects_bugreport where project_id = @ProjectId and resolution_task_id = @TaskId", new { ProjectId = project.Id, TaskId = task.Id })).ToHashSet();
                var nextIds = requestedBugs.Select(b => b.Id).ToHashSet();
                foreach (var bugReport in requestedBugs.Where(b => b.ResolutionTaskId != task.Id))
                {
                    var previous = bugReport.ResolutionTaskId is null ? null : await connection.QueryFirstOrDefaultAsync<TaskItem>("select * from projects_task where id = @Id", new { Id = bugReport.ResolutionTaskId });
                    await connection.ExecuteAsync("update projects_bugreport set resolution_task_id = @TaskId, updated_at = @Now where id = @Id", new { TaskId = task.Id, Now = ApiHelpers.NowSql(), bugReport.Id });
                    await projects.RecordActivityAsync(connection, project, user, "bug.resolution_task_set", previous is null ? $"Set task \"{task.Title}\" as the resolution task for bug \"{bugReport.Title}\"." : $"Changed bug \"{bugReport.Title}\" resolution task from \"{previous.Title}\" to \"{task.Title}\".", task, bugReport);
                }
                foreach (var removedId in currentIds.Except(nextIds))
                {
                    var removedBug = await connection.QueryFirstAsync<BugReport>("select * from projects_bugreport where id = @Id", new { Id = removedId });
                    await connection.ExecuteAsync("update projects_bugreport set resolution_task_id = null, updated_at = @Now where id = @Id", new { Now = ApiHelpers.NowSql(), Id = removedId });
                    await projects.RecordActivityAsync(connection, project, user, "bug.resolution_task_cleared", $"Removed task \"{task.Title}\" as the resolution task for bug \"{removedBug.Title}\".", task, removedBug);
                }
            }

            await projects.CloseBugsFromResolutionTaskAsync(connection, task, user);
            return await ProjectResponse(connection, projects, project, user, membership);
        });
    }

    private static Task<IResult> DeleteTaskCore(long taskId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var task = await connection.QueryFirstOrDefaultAsync<TaskItem>("select * from projects_task where id = @Id", new { Id = taskId });
            if (task is null) return ApiHelpers.JsonError("Task not found.", StatusCodes.Status404NotFound);
            var (project, membership, error) = await projects.LoadProjectAsync(connection, task.ProjectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (!projects.RoleAtLeast(membership, ProjectService.RoleMember)) return ApiHelpers.JsonError("Only project members can delete tasks.", StatusCodes.Status403Forbidden);
            var bug = task.BugReportId is null ? null : await connection.QueryFirstOrDefaultAsync<BugReport>("select * from projects_bugreport where id = @Id", new { Id = task.BugReportId });
            await connection.ExecuteAsync("delete from projects_task where id = @Id", new { task.Id });
            await projects.RecordActivityAsync(connection, project, user, "task.deleted", $"Deleted task \"{task.Title}\".", bugReport: bug);
            return await ProjectResponse(connection, projects, project, user, membership);
        });
    }

    private static Task<IResult> AddTaskCommentCore(long taskId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var task = await connection.QueryFirstOrDefaultAsync<TaskItem>("select * from projects_task where id = @Id", new { Id = taskId });
            if (task is null) return ApiHelpers.JsonError("Task not found.", StatusCodes.Status404NotFound);
            var (project, membership, error) = await projects.LoadProjectAsync(connection, task.ProjectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (!projects.RoleAtLeast(membership, ProjectService.RoleMember)) return ApiHelpers.JsonError("Only project members can comment on tasks.", StatusCodes.Status403Forbidden);
            var bug = task.BugReportId is null ? null : await connection.QueryFirstOrDefaultAsync<BugReport>("select * from projects_bugreport where id = @Id", new { Id = task.BugReportId });
            var (payload, parseError) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (parseError is not null || payload is null) return parseError!;
            string anchorType, anchorId, anchorLabel;
            try { (anchorType, anchorId, anchorLabel) = projects.ParseCommentAnchor(payload); } catch (ArgumentException ex) { return ApiHelpers.JsonError(ex.Message); }
            var body = (payload.Value<string>("body") ?? "").Trim();
            if (string.IsNullOrWhiteSpace(body)) return ApiHelpers.JsonError("Comment text is required.");
            var now = ApiHelpers.NowSql();
            await connection.ExecuteAsync("insert into projects_taskcomment (task_id, author_id, body, anchor_type, anchor_id, anchor_label, created_at, updated_at) values (@TaskId, @AuthorId, @Body, @AnchorType, @AnchorId, @AnchorLabel, @Now, @Now)", new { TaskId = task.Id, AuthorId = user.Id, Body = body, AnchorType = anchorType, AnchorId = anchorId, AnchorLabel = anchorLabel, Now = now });
            await projects.RecordActivityAsync(connection, project, user, "task.comment_added", $"Added {(string.IsNullOrWhiteSpace(anchorType) ? "a comment" : "an inline comment")} on task \"{task.Title}\".", task, bug);
            var mentioned = await projects.NotifyMentionsAsync(connection, project, user, body, $"task \"{task.Title}\"", task, bug);
            await projects.NotifyTaskCommentAssigneesAsync(connection, task, user, mentioned);
            return await ProjectResponse(connection, projects, project, user, membership);
        });
    }

    private static Task<IResult> ToggleTaskCommentReactionCore(long commentId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ToggleCommentReactionCore(commentId, true, context, db, auth, projects);
    }

    private static Task<IResult> TaskIssueLinkCore(long taskId, HttpContext context, AppDb db, AuthService auth, ProjectService projects, GitHubClient github)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var task = await connection.QueryFirstOrDefaultAsync<TaskItem>("select * from projects_task where id = @Id", new { Id = taskId });
            if (task is null) return ApiHelpers.JsonError("Task not found.", StatusCodes.Status404NotFound);
            var (project, membership, error) = await projects.LoadProjectAsync(connection, task.ProjectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (!projects.RoleAtLeast(membership, ProjectService.RoleMember)) return ApiHelpers.JsonError("Only project members can link GitHub issues.", StatusCodes.Status403Forbidden);
            var bug = task.BugReportId is null ? null : await connection.QueryFirstOrDefaultAsync<BugReport>("select * from projects_bugreport where id = @Id", new { Id = task.BugReportId });
            var (payload, parseError) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (parseError is not null || payload is null) return parseError!;
            try
            {
                var reference = projects.ParseIssueReference(payload);
                await projects.EnsureIssueRepoAllowedAsync(connection, project, reference.RepositoryFullName);
                var accessToken = await projects.GetGitHubAccessTokenAsync(connection, user);
                if (string.IsNullOrWhiteSpace(accessToken)) accessToken = await projects.GetProjectGitHubAccessTokenAsync(connection, project);
                var refreshed = await projects.RefreshIssueDetailsAsync(github, accessToken, reference.RepositoryFullName, reference.IssueNumber, reference.Title, reference.IssueUrl, reference.State);
                var exists = await connection.ExecuteScalarAsync<int>("select count(*) from projects_githubissuelink where project_id = @ProjectId and task_id = @TaskId and repository_full_name = @Repo and issue_number = @Issue", new { ProjectId = project.Id, TaskId = task.Id, Repo = reference.RepositoryFullName, Issue = reference.IssueNumber });
                if (exists > 0) return ApiHelpers.JsonError("That GitHub issue is already linked to this task.", StatusCodes.Status409Conflict);
                await InsertIssueLink(connection, project.Id, task.Id, null, reference.RepositoryFullName, reference.IssueNumber, refreshed.Title, refreshed.Url, refreshed.State, user.Id);
                await projects.RecordActivityAsync(connection, project, user, "task.issue_linked", $"Linked {reference.RepositoryFullName}#{reference.IssueNumber} to task \"{task.Title}\".", task, bug);
                return await ProjectResponse(connection, projects, project, user, membership);
            }
            catch (ArgumentException ex) { return ApiHelpers.JsonError(ex.Message); }
        });
    }

    private static Task<IResult> TaskBranchCore(long taskId, HttpContext context, AppDb db, AuthService auth, ProjectService projects, GitHubClient github)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var task = await connection.QueryFirstOrDefaultAsync<TaskItem>("select * from projects_task where id = @Id", new { Id = taskId });
            if (task is null) return ApiHelpers.JsonError("Task not found.", StatusCodes.Status404NotFound);
            var (project, membership, error) = await projects.LoadProjectAsync(connection, task.ProjectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (!projects.RoleAtLeast(membership, ProjectService.RoleMember)) return ApiHelpers.JsonError("Only project members can create branches.", StatusCodes.Status403Forbidden);
            var (payload, parseError) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (parseError is not null || payload is null) return parseError!;
            var repositoryId = NullableLong(payload, "repositoryId");
            var repository = repositoryId is null
                ? await connection.QueryFirstOrDefaultAsync<ProjectRepository>("select * from projects_projectrepository where project_id = @ProjectId order by id limit 1", new { ProjectId = project.Id })
                : await connection.QueryFirstOrDefaultAsync<ProjectRepository>("select * from projects_projectrepository where project_id = @ProjectId and id = @Id", new { ProjectId = project.Id, Id = repositoryId });
            if (repository is null) return ApiHelpers.JsonError("This project does not have a connected repository.");
            var suggested = $"task-{task.Id}-{ApiHelpers.Slugify(task.Title)}";
            if (suggested.Length > 47) suggested = suggested[..47].TrimEnd('-');
            if (string.IsNullOrWhiteSpace(suggested)) suggested = $"task-{task.Id}";
            var branchName = (payload.Value<string>("branchName") ?? suggested).Trim();
            var baseBranch = (payload.Value<string>("baseBranch") ?? repository.DefaultBranch).Trim();
            if (string.IsNullOrWhiteSpace(baseBranch)) baseBranch = repository.DefaultBranch;
            var accessToken = await projects.GetGitHubAccessTokenAsync(connection, user);
            if (string.IsNullOrWhiteSpace(accessToken)) accessToken = await projects.GetProjectGitHubAccessTokenAsync(connection, project);
            if (string.IsNullOrWhiteSpace(accessToken)) return ApiHelpers.JsonError("Connect GitHub before creating a branch.");
            try
            {
                var branchUrl = await github.CreateRepositoryBranchAsync(accessToken, repository.FullName, baseBranch, branchName);
                await connection.ExecuteAsync("update projects_task set branch_name = @BranchName, branch_url = @BranchUrl, branch_repository_id = @RepositoryId, updated_at = @Now where id = @Id", new { BranchName = branchName, BranchUrl = branchUrl, RepositoryId = repository.Id, Now = ApiHelpers.NowSql(), task.Id });
                task.BranchName = branchName;
                task.BranchUrl = branchUrl;
                task.BranchRepositoryId = repository.Id;
                var bug = task.BugReportId is null ? null : await connection.QueryFirstOrDefaultAsync<BugReport>("select * from projects_bugreport where id = @Id", new { Id = task.BugReportId });
                await projects.RecordActivityAsync(connection, project, user, "task.branch_created", $"Created branch \"{branchName}\" for task \"{task.Title}\" in {repository.FullName}.", task, bug);
                return await ProjectResponse(connection, projects, project, user, membership);
            }
            catch (GitHubApiException ex)
            {
                return ApiHelpers.JsonError(ex.Message, ex.StatusCode);
            }
        });
    }

    private static Task<IResult> ImportBugCore(long projectId, HttpContext context, AppDb db, AuthService auth, ProjectService projects, GitHubClient github)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var (project, membership, error) = await projects.LoadProjectAsync(connection, projectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (!projects.RoleAtLeast(membership, ProjectService.RoleMember)) return ApiHelpers.JsonError("Only project members can import GitHub issues as bugs.", StatusCodes.Status403Forbidden);
            if (await connection.ExecuteScalarAsync<int>("select count(*) from projects_projectrepository where project_id = @ProjectId", new { ProjectId = project.Id }) == 0) return ApiHelpers.JsonError("Connect a GitHub repository before importing issues.");
            var (payload, parseError) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (parseError is not null || payload is null) return parseError!;
            try
            {
                var reference = projects.ParseIssueReference(payload);
                await projects.EnsureIssueRepoAllowedAsync(connection, project, reference.RepositoryFullName);
                var existing = await connection.QueryFirstOrDefaultAsync<GitHubIssueLink>("select * from projects_githubissuelink where project_id = @ProjectId and bug_report_id is not null and repository_full_name = @Repo and issue_number = @Issue", new { ProjectId = project.Id, Repo = reference.RepositoryFullName, Issue = reference.IssueNumber });
                if (existing is not null)
                {
                    var existingBug = await connection.QueryFirstAsync<BugReport>("select * from projects_bugreport where id = @Id", new { Id = existing.BugReportId });
                    return ApiHelpers.JsonError($"That GitHub issue is already imported as bug \"{existingBug.Title}\".", StatusCodes.Status409Conflict);
                }
                var accessToken = await projects.GetProjectGitHubAccessTokenAsync(connection, project, user);
                if (string.IsNullOrWhiteSpace(accessToken)) return ApiHelpers.JsonError("Connect GitHub before importing issues.");
                var issue = await github.GetIssueAsync(accessToken, reference.RepositoryFullName, reference.IssueNumber);
                if (issue.ContainsKey("pull_request")) return ApiHelpers.JsonError("Pull requests cannot be imported as bug reports.");
                var status = (payload.Value<string>("status") ?? ProjectService.BugOpen).Trim();
                var priority = (payload.Value<string>("priority") ?? ProjectService.PriorityMedium).Trim();
                if (!projects.IsValidBugStatus(status)) return ApiHelpers.JsonError("Choose a valid bug report status.");
                if (!projects.IsValidPriority(priority)) return ApiHelpers.JsonError("Choose a valid bug report priority.");
                var title = (issue.Value<string>("title") ?? reference.Title).Trim();
                var description = (payload.Value<string>("description") ?? "").Trim();
                if (string.IsNullOrWhiteSpace(description)) description = (issue.Value<string>("body") ?? "").Trim();
                var issueUrl = issue.Value<string>("html_url") ?? reference.IssueUrl;
                var issueState = issue.Value<string>("state") ?? reference.State;
                var bug = await InsertBug(connection, project.Id, user.Id, title, description, status, priority);
                await InsertIssueLink(connection, project.Id, null, bug.Id, reference.RepositoryFullName, reference.IssueNumber, title, issueUrl, issueState, user.Id);
                await projects.RecordActivityAsync(connection, project, user, "bug.imported_from_github", $"Imported GitHub issue {reference.RepositoryFullName}#{reference.IssueNumber} as bug \"{bug.Title}\".", bugReport: bug, metadata: new { repositoryFullName = reference.RepositoryFullName, issueNumber = reference.IssueNumber, issueUrl });
                return await ProjectResponse(connection, projects, project, user, membership, StatusCodes.Status201Created);
            }
            catch (ArgumentException ex) { return ApiHelpers.JsonError(ex.Message); }
            catch (GitHubApiException ex) { return ApiHelpers.JsonError(ex.Message, ex.StatusCode); }
        });
    }

    private static Task<IResult> CreateBugCore(long projectId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var (project, membership, error) = await projects.LoadProjectAsync(connection, projectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (!projects.RoleAtLeast(membership, ProjectService.RoleMember)) return ApiHelpers.JsonError("Only project members can create bug reports.", StatusCodes.Status403Forbidden);
            var (payload, parseError) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (parseError is not null || payload is null) return parseError!;
            var title = (payload.Value<string>("title") ?? "").Trim();
            var description = (payload.Value<string>("description") ?? "").Trim();
            var status = (payload.Value<string>("status") ?? ProjectService.BugOpen).Trim();
            var priority = (payload.Value<string>("priority") ?? ProjectService.PriorityMedium).Trim();
            if (string.IsNullOrWhiteSpace(title)) return ApiHelpers.JsonError("Bug report title is required.");
            if (!projects.IsValidBugStatus(status)) return ApiHelpers.JsonError("Choose a valid bug report status.");
            if (!projects.IsValidPriority(priority)) return ApiHelpers.JsonError("Choose a valid bug report priority.");
            var bug = await InsertBug(connection, project.Id, user.Id, title, description, status, priority);
            await projects.RecordActivityAsync(connection, project, user, "bug.created", $"Reported bug \"{bug.Title}\".", bugReport: bug);
            await projects.NotifyMentionsAsync(connection, project, user, description, $"bug report \"{bug.Title}\"", bugReport: bug);
            return await ProjectResponse(connection, projects, project, user, membership, StatusCodes.Status201Created);
        });
    }

    private static Task<IResult> UpdateBugCore(long bugId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var bug = await connection.QueryFirstOrDefaultAsync<BugReport>("select * from projects_bugreport where id = @Id", new { Id = bugId });
            if (bug is null) return ApiHelpers.JsonError("Bug report not found.", StatusCodes.Status404NotFound);
            var (project, membership, error) = await projects.LoadProjectAsync(connection, bug.ProjectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (!projects.CanEditBug(membership, bug, user)) return ApiHelpers.JsonError("You do not have permission to update this bug report.", StatusCodes.Status403Forbidden);
            var (payload, parseError) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (parseError is not null || payload is null) return parseError!;
            var changed = new List<string>();
            if (payload.ContainsKey("title"))
            {
                var title = (payload.Value<string>("title") ?? "").Trim();
                if (string.IsNullOrWhiteSpace(title)) return ApiHelpers.JsonError("Bug report title is required.");
                if (title != bug.Title) { bug.Title = title; changed.Add("title"); }
            }
            if (payload.ContainsKey("description"))
            {
                var description = (payload.Value<string>("description") ?? "").Trim();
                if (description != bug.Description)
                {
                    bug.Description = description;
                    changed.Add("description");
                    await projects.NotifyMentionsAsync(connection, project, user, description, $"bug report \"{bug.Title}\"", bugReport: bug);
                }
            }
            if (payload.ContainsKey("status"))
            {
                var status = (payload.Value<string>("status") ?? "").Trim();
                if (!projects.IsValidBugStatus(status)) return ApiHelpers.JsonError("Choose a valid bug report status.");
                if (status != bug.Status)
                {
                    var previous = projects.BugStatusLabel(bug.Status);
                    var next = projects.BugStatusLabel(status);
                    bug.Status = status;
                    changed.Add("status");
                    bug.ClosedAt = status == ProjectService.BugClosed ? DateTime.UtcNow : null;
                    await projects.RecordActivityAsync(connection, project, user, "bug.status_changed", $"Changed bug \"{bug.Title}\" from {previous} to {next}.", bugReport: bug);
                }
            }
            if (payload.ContainsKey("priority"))
            {
                var priority = (payload.Value<string>("priority") ?? "").Trim();
                if (!projects.IsValidPriority(priority)) return ApiHelpers.JsonError("Choose a valid bug report priority.");
                if (priority != bug.Priority)
                {
                    var previous = projects.PriorityLabel(bug.Priority);
                    var next = projects.PriorityLabel(priority);
                    bug.Priority = priority;
                    changed.Add("priority");
                    await projects.RecordActivityAsync(connection, project, user, "bug.priority_changed", $"Changed bug \"{bug.Title}\" priority from {previous} to {next}.", bugReport: bug);
                }
            }
            if (changed.Count > 0)
            {
                await connection.ExecuteAsync("update projects_bugreport set title = @Title, description = @Description, status = @Status, priority = @Priority, closed_at = @ClosedAt, updated_at = @Now where id = @Id", new { bug.Title, bug.Description, bug.Status, bug.Priority, ClosedAt = bug.ClosedAt is null ? null : ApiHelpers.NowSql(), Now = ApiHelpers.NowSql(), bug.Id });
                if (changed.Any(field => field is "title" or "description")) await projects.RecordActivityAsync(connection, project, user, "bug.updated", $"Updated bug report \"{bug.Title}\" details.", bugReport: bug);
            }
            return await ProjectResponse(connection, projects, project, user, membership);
        });
    }

    private static Task<IResult> DeleteBugCore(long bugId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var bug = await connection.QueryFirstOrDefaultAsync<BugReport>("select * from projects_bugreport where id = @Id", new { Id = bugId });
            if (bug is null) return ApiHelpers.JsonError("Bug report not found.", StatusCodes.Status404NotFound);
            var (project, membership, error) = await projects.LoadProjectAsync(connection, bug.ProjectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (!projects.CanEditBug(membership, bug, user)) return ApiHelpers.JsonError("You do not have permission to delete this bug report.", StatusCodes.Status403Forbidden);
            await connection.ExecuteAsync("delete from projects_bugreport where id = @Id", new { bug.Id });
            await projects.RecordActivityAsync(connection, project, user, "bug.deleted", $"Deleted bug report \"{bug.Title}\".");
            return await ProjectResponse(connection, projects, project, user, membership);
        });
    }

    private static Task<IResult> AddBugCommentCore(long bugId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var bug = await connection.QueryFirstOrDefaultAsync<BugReport>("select * from projects_bugreport where id = @Id", new { Id = bugId });
            if (bug is null) return ApiHelpers.JsonError("Bug report not found.", StatusCodes.Status404NotFound);
            var (project, membership, error) = await projects.LoadProjectAsync(connection, bug.ProjectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (!projects.RoleAtLeast(membership, ProjectService.RoleMember)) return ApiHelpers.JsonError("Only project members can comment on bug reports.", StatusCodes.Status403Forbidden);
            var (payload, parseError) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (parseError is not null || payload is null) return parseError!;
            string anchorType, anchorId, anchorLabel;
            try { (anchorType, anchorId, anchorLabel) = projects.ParseCommentAnchor(payload); } catch (ArgumentException ex) { return ApiHelpers.JsonError(ex.Message); }
            var body = (payload.Value<string>("body") ?? "").Trim();
            if (string.IsNullOrWhiteSpace(body)) return ApiHelpers.JsonError("Comment text is required.");
            var now = ApiHelpers.NowSql();
            await connection.ExecuteAsync("insert into projects_bugcomment (bug_report_id, author_id, body, anchor_type, anchor_id, anchor_label, created_at, updated_at) values (@BugId, @AuthorId, @Body, @AnchorType, @AnchorId, @AnchorLabel, @Now, @Now)", new { BugId = bug.Id, AuthorId = user.Id, Body = body, AnchorType = anchorType, AnchorId = anchorId, AnchorLabel = anchorLabel, Now = now });
            await projects.RecordActivityAsync(connection, project, user, "bug.comment_added", $"Added {(string.IsNullOrWhiteSpace(anchorType) ? "a comment" : "an inline comment")} on bug report \"{bug.Title}\".", bugReport: bug);
            await projects.NotifyMentionsAsync(connection, project, user, body, $"bug report \"{bug.Title}\"", bugReport: bug);
            return await ProjectResponse(connection, projects, project, user, membership);
        });
    }

    private static Task<IResult> ToggleBugCommentReactionCore(long commentId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ToggleCommentReactionCore(commentId, false, context, db, auth, projects);
    }

    private static Task<IResult> BugIssueLinkCore(long bugId, HttpContext context, AppDb db, AuthService auth, ProjectService projects, GitHubClient github)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var bug = await connection.QueryFirstOrDefaultAsync<BugReport>("select * from projects_bugreport where id = @Id", new { Id = bugId });
            if (bug is null) return ApiHelpers.JsonError("Bug report not found.", StatusCodes.Status404NotFound);
            var (project, membership, error) = await projects.LoadProjectAsync(connection, bug.ProjectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (!projects.CanEditBug(membership, bug, user)) return ApiHelpers.JsonError("You do not have permission to link issues to this bug report.", StatusCodes.Status403Forbidden);
            var (payload, parseError) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (parseError is not null || payload is null) return parseError!;
            try
            {
                var reference = projects.ParseIssueReference(payload);
                await projects.EnsureIssueRepoAllowedAsync(connection, project, reference.RepositoryFullName);
                var accessToken = await projects.GetProjectGitHubAccessTokenAsync(connection, project, user);
                var refreshed = await projects.RefreshIssueDetailsAsync(github, accessToken, reference.RepositoryFullName, reference.IssueNumber, reference.Title, reference.IssueUrl, reference.State);
                var exists = await connection.ExecuteScalarAsync<int>("select count(*) from projects_githubissuelink where project_id = @ProjectId and bug_report_id = @BugId and repository_full_name = @Repo and issue_number = @Issue", new { ProjectId = project.Id, BugId = bug.Id, Repo = reference.RepositoryFullName, Issue = reference.IssueNumber });
                if (exists > 0) return ApiHelpers.JsonError("That GitHub issue is already linked to this bug report.", StatusCodes.Status409Conflict);
                await InsertIssueLink(connection, project.Id, null, bug.Id, reference.RepositoryFullName, reference.IssueNumber, refreshed.Title, refreshed.Url, refreshed.State, user.Id);
                await projects.RecordActivityAsync(connection, project, user, "bug.issue_linked", $"Linked {reference.RepositoryFullName}#{reference.IssueNumber} to bug report \"{bug.Title}\".", bugReport: bug);
                return await ProjectResponse(connection, projects, project, user, membership);
            }
            catch (ArgumentException ex) { return ApiHelpers.JsonError(ex.Message); }
        });
    }

    private static Task<IResult> BugResolutionCore(long bugId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var bug = await connection.QueryFirstOrDefaultAsync<BugReport>("select * from projects_bugreport where id = @Id", new { Id = bugId });
            if (bug is null) return ApiHelpers.JsonError("Bug report not found.", StatusCodes.Status404NotFound);
            var (project, membership, error) = await projects.LoadProjectAsync(connection, bug.ProjectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (!projects.CanEditBug(membership, bug, user)) return ApiHelpers.JsonError("You do not have permission to change the resolution task.", StatusCodes.Status403Forbidden);
            var (payload, parseError) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (parseError is not null || payload is null) return parseError!;
            var taskId = NullableLong(payload, "taskId");
            if (taskId is null)
            {
                await connection.ExecuteAsync("update projects_bugreport set resolution_task_id = null, updated_at = @Now where id = @Id", new { Now = ApiHelpers.NowSql(), bug.Id });
                await projects.RecordActivityAsync(connection, project, user, "bug.resolution_task_cleared", $"Cleared the resolution task for bug \"{bug.Title}\".", bugReport: bug);
                return await ProjectResponse(connection, projects, project, user, membership);
            }
            var task = await connection.QueryFirstOrDefaultAsync<TaskItem>("select * from projects_task where project_id = @ProjectId and id = @Id and bug_report_id = @BugId", new { ProjectId = project.Id, Id = taskId.Value, BugId = bug.Id });
            if (task is null) return ApiHelpers.JsonError("Choose a task created from this bug report.");
            await connection.ExecuteAsync("update projects_bugreport set resolution_task_id = @TaskId, updated_at = @Now where id = @Id", new { TaskId = task.Id, Now = ApiHelpers.NowSql(), bug.Id });
            await projects.RecordActivityAsync(connection, project, user, "bug.resolution_task_set", $"Set task \"{task.Title}\" as the resolution task for bug \"{bug.Title}\".", task, bug);
            await projects.CloseBugsFromResolutionTaskAsync(connection, task, user);
            return await ProjectResponse(connection, projects, project, user, membership);
        });
    }

    private static async Task<IResult> ToggleCommentReactionCore(long commentId, bool taskComment, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return await ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var table = taskComment ? "projects_taskcomment" : "projects_bugcomment";
            var comment = taskComment
                ? await connection.QueryFirstOrDefaultAsync<TaskComment>($"select * from {table} where id = @Id", new { Id = commentId })
                : null;
            var bugComment = !taskComment
                ? await connection.QueryFirstOrDefaultAsync<BugComment>($"select * from {table} where id = @Id", new { Id = commentId })
                : null;
            if (taskComment && comment is null) return ApiHelpers.JsonError("Task comment not found.", StatusCodes.Status404NotFound);
            if (!taskComment && bugComment is null) return ApiHelpers.JsonError("Bug comment not found.", StatusCodes.Status404NotFound);
            TaskItem? task = taskComment ? await connection.QueryFirstAsync<TaskItem>("select * from projects_task where id = @Id", new { Id = comment!.TaskId }) : null;
            BugReport? bug = taskComment
                ? task!.BugReportId is null ? null : await connection.QueryFirstOrDefaultAsync<BugReport>("select * from projects_bugreport where id = @Id", new { Id = task.BugReportId })
                : await connection.QueryFirstAsync<BugReport>("select * from projects_bugreport where id = @Id", new { Id = bugComment!.BugReportId });
            var projectId = task?.ProjectId ?? bug!.ProjectId;
            var (project, membership, error) = await projects.LoadProjectAsync(connection, projectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (!projects.RoleAtLeast(membership, ProjectService.RoleMember)) return ApiHelpers.JsonError(taskComment ? "Only project members can react to task comments." : "Only project members can react to bug comments.", StatusCodes.Status403Forbidden);
            var (payload, parseError) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (parseError is not null || payload is null) return parseError!;
            string emoji;
            try { emoji = projects.ParseCommentReaction(payload); } catch (ArgumentException ex) { return ApiHelpers.JsonError(ex.Message); }
            var reactionTable = taskComment ? "projects_taskcommentreaction" : "projects_bugcommentreaction";
            var existing = await connection.QueryFirstOrDefaultAsync<CommentReaction>($"select * from {reactionTable} where comment_id = @CommentId and user_id = @UserId", new { CommentId = commentId, UserId = user.Id });
            if (existing is not null && existing.Emoji == emoji)
            {
                await connection.ExecuteAsync($"delete from {reactionTable} where id = @Id", new { existing.Id });
            }
            else if (existing is not null)
            {
                await connection.ExecuteAsync($"update {reactionTable} set emoji = @Emoji, updated_at = @Now where id = @Id", new { Emoji = emoji, Now = ApiHelpers.NowSql(), existing.Id });
            }
            else
            {
                await connection.ExecuteAsync($"insert into {reactionTable} (comment_id, user_id, emoji, created_at, updated_at) values (@CommentId, @UserId, @Emoji, @Now, @Now)", new { CommentId = commentId, UserId = user.Id, Emoji = emoji, Now = ApiHelpers.NowSql() });
            }
            return await ProjectResponse(connection, projects, project, user, membership);
        });
    }

    private static async Task<BugReport> InsertBug(Microsoft.Data.Sqlite.SqliteConnection connection, long projectId, long reporterId, string title, string description, string status, string priority)
    {
        var now = ApiHelpers.NowSql();
        await connection.ExecuteAsync("insert into projects_bugreport (project_id, title, description, reporter_id, status, priority, resolution_task_id, closed_at, created_at, updated_at) values (@ProjectId, @Title, @Description, @ReporterId, @Status, @Priority, null, null, @Now, @Now)", new { ProjectId = projectId, Title = title, Description = description, ReporterId = reporterId, Status = status, Priority = priority, Now = now });
        return await connection.QueryFirstAsync<BugReport>("select * from projects_bugreport where id = last_insert_rowid()");
    }

    private static async Task InsertIssueLink(Microsoft.Data.Sqlite.SqliteConnection connection, long projectId, long? taskId, long? bugId, string repo, long issue, string title, string url, string state, long createdById)
    {
        await connection.ExecuteAsync("insert into projects_githubissuelink (project_id, task_id, bug_report_id, repository_full_name, issue_number, title, html_url, state, created_by_id, created_at) values (@ProjectId, @TaskId, @BugId, @Repo, @Issue, @Title, @Url, @State, @CreatedById, @Now)", new { ProjectId = projectId, TaskId = taskId, BugId = bugId, Repo = repo, Issue = issue, Title = title, Url = url, State = state, CreatedById = createdById, Now = ApiHelpers.NowSql() });
    }

    private static long[] LongArray(JsonObject payload, string key)
    {
        return payload.TryGetPropertyValue(key, out var node) && node is JsonArray array
            ? array.Select(item => long.TryParse(item?.ToString(), out var value) ? value : (long?)null).Where(value => value is not null).Select(value => value!.Value).ToArray()
            : [];
    }

    private static long? NullableLong(JsonObject payload, string key)
    {
        if (!payload.TryGetPropertyValue(key, out var node) || node is null)
        {
            return null;
        }

        var value = node.ToString();
        return string.IsNullOrWhiteSpace(value) ? null : long.TryParse(value, out var parsed) ? parsed : null;
    }
}
