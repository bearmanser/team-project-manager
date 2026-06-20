using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Dapper;
using Microsoft.Data.Sqlite;

public static partial class ApiEndpoints
{
    public static async Task<IResult> Signup(HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        var (payload, error) = await ApiHelpers.ReadJsonBodyAsync(context);
        if (error is not null || payload is null)
        {
            return error!;
        }

        var username = (payload.Value<string>("username") ?? "").Trim();
        var email = (payload.Value<string>("email") ?? "").Trim();
        var password = payload.Value<string>("password") ?? "";
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            return ApiHelpers.JsonError("Username, email, and password are required.");
        }

        var passwordError = ValidatePassword(password);
        if (passwordError is not null)
        {
            return ApiHelpers.JsonError(passwordError);
        }

        await using var connection = db.Open();
        if (await connection.ExecuteScalarAsync<int>("select count(*) from auth_user where lower(username) = lower(@Username)", new { Username = username }) > 0)
        {
            return ApiHelpers.JsonError("That username is already in use.", StatusCodes.Status409Conflict);
        }

        if (await connection.ExecuteScalarAsync<int>("select count(*) from auth_user where lower(email) = lower(@Email)", new { Email = email }) > 0)
        {
            return ApiHelpers.JsonError("That email is already in use.", StatusCodes.Status409Conflict);
        }

        var now = ApiHelpers.NowSql();
        await connection.ExecuteAsync(
            """
            insert into auth_user
            (password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined)
            values (@Password, null, 0, @Username, '', '', @Email, 0, 1, @Now)
            """,
            new { Password = PasswordHasher.Hash(password), Username = username, Email = email, Now = now });
        var user = await connection.QueryFirstAsync<User>("select * from auth_user where id = last_insert_rowid()");
        await projects.GetProfileAsync(connection, user);
        await projects.EnsurePersonalOrganizationAsync(connection, user);

        auth.SetAuthCookies(context.Response, user.Id);
        return Results.Json(new { user = await projects.SerializeUserAsync(connection, user) }, statusCode: StatusCodes.Status201Created);
    }

    public static async Task<IResult> Login(HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        var (payload, error) = await ApiHelpers.ReadJsonBodyAsync(context);
        if (error is not null || payload is null)
        {
            return error!;
        }

        var identifier = (payload.Value<string>("identifier") ?? "").Trim();
        var password = payload.Value<string>("password") ?? "";
        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrWhiteSpace(password))
        {
            return ApiHelpers.JsonError("Identifier and password are required.");
        }

        await using var connection = db.Open();
        var user = identifier.Contains('@')
            ? await connection.QueryFirstOrDefaultAsync<User>("select * from auth_user where lower(email) = lower(@Identifier)", new { Identifier = identifier })
            : await connection.QueryFirstOrDefaultAsync<User>("select * from auth_user where lower(username) = lower(@Identifier)", new { Identifier = identifier });
        if (user is null || !PasswordHasher.Verify(password, user.Password))
        {
            return ApiHelpers.JsonError("Invalid credentials.", StatusCodes.Status401Unauthorized);
        }

        await projects.GetProfileAsync(connection, user);
        auth.SetAuthCookies(context.Response, user.Id);
        return Results.Json(new { user = await projects.SerializeUserAsync(connection, user) });
    }

    public static Task<IResult> Logout(HttpContext context, AuthService auth)
    {
        auth.ClearAuthCookies(context.Response);
        context.Response.Headers.CacheControl = "no-store";
        return Task.FromResult(Results.Json(new { success = true }));
    }

    public static Task<IResult> Me(HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            return Results.Json(new { user = await projects.SerializeUserAsync(connection, user) });
        });
    }

    public static Task<IResult> GitHubOAuthStart(HttpContext context, AppDb db, AuthService auth, AppConfig config, GitHubClient github)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, user =>
        {
            try
            {
                var state = CreateOAuthState(config, user.Id);
                return Task.FromResult<IResult>(Results.Json(new { authorizationUrl = github.BuildAuthorizationUrl(state) }));
            }
            catch (GitHubApiException ex)
            {
                return Task.FromResult(ApiHelpers.JsonError(ex.Message, ex.StatusCode));
            }
        });
    }

    public static Task<IResult> GitHubDisconnect(HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            await projects.GetProfileAsync(connection, user);
            await connection.ExecuteAsync(
                """
                update accounts_userprofile
                set github_user_id = null, github_username = '', github_avatar_url = '', github_access_token = '', github_connected_at = null, updated_at = @Now
                where user_id = @UserId
                """,
                new { Now = ApiHelpers.NowSql(), UserId = user.Id });
            return Results.Json(new { user = await projects.SerializeUserAsync(connection, user) });
        });
    }

    public static Task<IResult> GitHubOAuthComplete(HttpContext context, AppDb db, AuthService auth, ProjectService projects, AppConfig config, GitHubClient github)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            var (payload, error) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (error is not null || payload is null)
            {
                return error!;
            }

            var code = (payload.Value<string>("code") ?? "").Trim();
            var state = (payload.Value<string>("state") ?? "").Trim();
            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(state))
            {
                return ApiHelpers.JsonError("GitHub code and state are required.");
            }

            if (!ValidateOAuthState(config, state, user.Id))
            {
                return ApiHelpers.JsonError("The GitHub OAuth state is invalid or expired.", StatusCodes.Status400BadRequest);
            }

            await using var connection = db.Open();
            try
            {
                var accessToken = await github.ExchangeCodeForAccessTokenAsync(code);
                var githubUser = await github.GetUserAsync(accessToken);
                var githubUserId = (githubUser.Value<long?>("id") ?? 0).ToString();
                if (await connection.ExecuteScalarAsync<int>("select count(*) from accounts_userprofile where github_user_id = @GithubUserId and user_id <> @UserId", new { GithubUserId = githubUserId, UserId = user.Id }) > 0)
                {
                    return ApiHelpers.JsonError("That GitHub account is already linked to another user.", StatusCodes.Status409Conflict);
                }

                await projects.GetProfileAsync(connection, user);
                await connection.ExecuteAsync(
                    """
                    update accounts_userprofile
                    set github_user_id = @GithubUserId,
                        github_username = @GithubUsername,
                        github_avatar_url = @GithubAvatarUrl,
                        github_access_token = @AccessToken,
                        github_connected_at = @Now,
                        updated_at = @Now
                    where user_id = @UserId
                    """,
                    new
                    {
                        GithubUserId = githubUserId,
                        GithubUsername = githubUser.Value<string>("login") ?? "",
                        GithubAvatarUrl = githubUser.Value<string>("avatar_url") ?? "",
                        AccessToken = accessToken,
                        Now = ApiHelpers.NowSql(),
                        UserId = user.Id,
                    });

                List<object> repos = [];
                string? githubRepoError = null;
                try
                {
                    repos = (await github.GetRepositoriesAsync(accessToken)).Select(projects.SerializeAvailableRepo).ToList();
                }
                catch (GitHubApiException ex)
                {
                    githubRepoError = ex.Message;
                }

                return Results.Json(new
                {
                    user = await projects.SerializeUserAsync(connection, user),
                    repos,
                    githubRepoError,
                });
            }
            catch (GitHubApiException ex)
            {
                return ApiHelpers.JsonError(ex.Message, ex.StatusCode);
            }
        });
    }

    public static Task<IResult> GitHubRepos(HttpContext context, AppDb db, AuthService auth, ProjectService projects, GitHubClient github)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var accessToken = await projects.GetGitHubAccessTokenAsync(connection, user);
            if (string.IsNullOrWhiteSpace(accessToken))
            {
                return ApiHelpers.JsonError("Connect a GitHub account first.");
            }

            try
            {
                var repos = (await github.GetRepositoriesAsync(accessToken)).Select(projects.SerializeAvailableRepo);
                return Results.Json(new { repos });
            }
            catch (GitHubApiException ex)
            {
                return ApiHelpers.JsonError(ex.Message, ex.StatusCode);
            }
        });
    }

    public static Task<IResult> Workspace(HttpContext context, AppDb db, AuthService auth, ProjectService projects, GitHubClient github)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var memberships = (await connection.QueryAsync<ProjectMembership>(
                """
                select m.*
                from projects_projectmembership m
                join projects_project p on p.id = m.project_id
                where m.user_id = @UserId and m.status = @Status
                order by p.updated_at desc
                """,
                new { UserId = user.Id, Status = ProjectService.StatusActive })).ToList();
            var projectSummaries = new List<object>();
            foreach (var membership in memberships)
            {
                var project = await connection.QueryFirstAsync<Project>("select * from projects_project where id = @Id", new { Id = membership.ProjectId });
                projectSummaries.Add(await projects.SerializeProjectSummaryAsync(connection, project, membership));
            }

            var organizationSummaries = new List<object>();
            foreach (var organization in await projects.AccessibleOrganizationsAsync(connection, user))
            {
                organizationSummaries.Add(await projects.SerializeOrganizationSummaryAsync(connection, organization, user));
            }

            var notifications = new List<object>();
            var notificationRows = await connection.QueryAsync<Notification>(
                "select * from projects_notification where recipient_id = @UserId and is_closed = 0 order by created_at desc, id desc limit 20",
                new { UserId = user.Id });
            foreach (var notification in notificationRows)
            {
                notifications.Add(await projects.SerializeNotificationAsync(connection, notification));
            }

            List<object> availableRepos = [];
            string? githubRepoError = null;
            var accessToken = await projects.GetGitHubAccessTokenAsync(connection, user);
            if (!string.IsNullOrWhiteSpace(accessToken))
            {
                try
                {
                    availableRepos = (await github.GetRepositoriesAsync(accessToken)).Select(projects.SerializeAvailableRepo).ToList();
                }
                catch (GitHubApiException ex)
                {
                    githubRepoError = ex.Message;
                }
            }

            return Results.Json(new
            {
                user = await projects.SerializeUserAsync(connection, user),
                organizations = organizationSummaries,
                projects = projectSummaries,
                notifications,
                availableRepos,
                githubRepoError,
            });
        });
    }

    public static Task<IResult> Organizations(HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            if (HttpMethods.IsGet(context.Request.Method))
            {
                var organizations = new List<object>();
                foreach (var accessibleOrganization in await projects.AccessibleOrganizationsAsync(connection, user))
                {
                    organizations.Add(await projects.SerializeOrganizationSummaryAsync(connection, accessibleOrganization, user));
                }

                return Results.Json(new { organizations });
            }

            var (payload, error) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (error is not null || payload is null)
            {
                return error!;
            }

            var name = (payload.Value<string>("name") ?? "").Trim();
            var description = (payload.Value<string>("description") ?? "").Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                return ApiHelpers.JsonError("Organization name is required.");
            }

            var now = ApiHelpers.NowSql();
            await connection.ExecuteAsync(
                "insert into projects_organization (name, description, owner_id, is_personal, created_at, updated_at) values (@Name, @Description, @OwnerId, 0, @Now, @Now)",
                new { Name = name, Description = description, OwnerId = user.Id, Now = now });
            var organization = await connection.QueryFirstAsync<Organization>("select * from projects_organization where id = last_insert_rowid()");
            await projects.EnsureOwnerOrganizationMembershipAsync(connection, organization, user);
            return Results.Json(new { organization = await projects.SerializeOrganizationSummaryAsync(connection, organization, user) }, statusCode: StatusCodes.Status201Created);
        });
    }

    public static Task<IResult> OrganizationSettings(long organizationId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var (organization, membership, loadError) = await projects.LoadOrganizationAsync(connection, organizationId, user);
            if (loadError is not null || organization is null || membership is null)
            {
                return loadError!;
            }

            if (organization.IsPersonal)
            {
                return ApiHelpers.JsonError("Personal workspaces cannot be edited here.", StatusCodes.Status403Forbidden);
            }

            if (membership.Role is not (ProjectService.RoleOwner or ProjectService.RoleAdmin))
            {
                return ApiHelpers.JsonError("Only admins and owners can edit organization details.", StatusCodes.Status403Forbidden);
            }

            var (payload, error) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (error is not null || payload is null)
            {
                return error!;
            }

            var name = (payload.Value<string>("name") ?? "").Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                return ApiHelpers.JsonError("Organization name is required.");
            }

            if (name != organization.Name)
            {
                await connection.ExecuteAsync("update projects_organization set name = @Name, updated_at = @Now where id = @Id", new { Name = name, Now = ApiHelpers.NowSql(), organization.Id });
                organization.Name = name;
            }

            return Results.Json(new { organization = await projects.SerializeOrganizationSummaryAsync(connection, organization, user) });
        });
    }

    public static Task<IResult> OrganizationDelete(long organizationId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var (organization, error) = await projects.LoadOwnedOrganizationAsync(connection, organizationId, user);
            if (error is not null || organization is null)
            {
                return error!;
            }

            if (organization.IsPersonal)
            {
                return ApiHelpers.JsonError("Personal workspaces cannot be deleted.", StatusCodes.Status403Forbidden);
            }

            await connection.ExecuteAsync("delete from projects_organization where id = @Id", new { organization.Id });
            return Results.Json(new { success = true, organizationId = organization.Id });
        });
    }

    public static Task<IResult> OrganizationMembers(long organizationId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            if (HttpMethods.IsGet(context.Request.Method))
            {
                var (organization, _, error) = await projects.LoadOrganizationAsync(connection, organizationId, user);
                if (error is not null || organization is null)
                {
                    return error!;
                }

                return await OrganizationMembersResponse(connection, projects, organization);
            }

            var (manageableOrganization, actorMembership, loadError) = await projects.LoadManageableOrganizationAsync(connection, organizationId, user);
            if (loadError is not null || manageableOrganization is null || actorMembership is null)
            {
                return loadError!;
            }

            var (payload, parseError) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (parseError is not null || payload is null)
            {
                return parseError!;
            }

            var identifier = (payload.Value<string>("identifier") ?? "").Trim();
            var role = (payload.Value<string>("role") ?? ProjectService.RoleMember).Trim();
            if (string.IsNullOrWhiteSpace(identifier))
            {
                return ApiHelpers.JsonError("Provide a username or email address.");
            }

            if (role is not (ProjectService.RoleAdmin or ProjectService.RoleMember or ProjectService.RoleViewer))
            {
                return ApiHelpers.JsonError("Choose a valid organization role.");
            }

            if (actorMembership.Role == ProjectService.RoleAdmin && role == ProjectService.RoleAdmin)
            {
                return ApiHelpers.JsonError("Only the organization owner can invite another admin.", StatusCodes.Status403Forbidden);
            }

            var invitedUser = await FindUserByIdentifierAsync(connection, identifier);
            if (invitedUser is null)
            {
                return ApiHelpers.JsonError("That user does not exist yet.", StatusCodes.Status404NotFound);
            }

            var existing = await connection.QueryFirstOrDefaultAsync<OrganizationMembership>(
                "select * from projects_organizationmembership where organization_id = @OrganizationId and user_id = @UserId",
                new { OrganizationId = manageableOrganization.Id, UserId = invitedUser.Id });
            if (existing is not null)
            {
                return ApiHelpers.JsonError(existing.Status == ProjectService.StatusInvited ? "That user already has a pending invite." : "That user is already part of this organization.", StatusCodes.Status409Conflict);
            }

            await projects.InviteUserToOrganizationAsync(connection, manageableOrganization, user, invitedUser, role);
            return await OrganizationMembersResponse(connection, projects, manageableOrganization, StatusCodes.Status201Created);
        });
    }

    public static Task<IResult> OrganizationMemberRole(long organizationId, long membershipId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var (organization, actorMembership, loadError) = await projects.LoadManageableOrganizationAsync(connection, organizationId, user);
            if (loadError is not null || organization is null || actorMembership is null)
            {
                return loadError!;
            }

            var target = await connection.QueryFirstOrDefaultAsync<OrganizationMembership>("select * from projects_organizationmembership where organization_id = @OrganizationId and id = @Id", new { OrganizationId = organization.Id, Id = membershipId });
            if (target is null)
            {
                return ApiHelpers.JsonError("Organization member not found.", StatusCodes.Status404NotFound);
            }

            if (target.Role == ProjectService.RoleOwner)
            {
                return ApiHelpers.JsonError("The organization owner role cannot be reassigned here.", StatusCodes.Status403Forbidden);
            }

            if (!projects.CanManageTargetOrganizationMembership(actorMembership, target))
            {
                return ApiHelpers.JsonError("You do not have permission to change that role.", StatusCodes.Status403Forbidden);
            }

            var (payload, error) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (error is not null || payload is null)
            {
                return error!;
            }

            var nextRole = (payload.Value<string>("role") ?? "").Trim();
            if (nextRole is not (ProjectService.RoleAdmin or ProjectService.RoleMember or ProjectService.RoleViewer))
            {
                return ApiHelpers.JsonError("Choose a valid organization role.");
            }

            if (actorMembership.Role == ProjectService.RoleAdmin && nextRole == ProjectService.RoleAdmin)
            {
                return ApiHelpers.JsonError("Only the organization owner can assign the admin role.", StatusCodes.Status403Forbidden);
            }

            await connection.ExecuteAsync("update projects_organizationmembership set role = @Role, updated_at = @Now where id = @Id", new { Role = nextRole, Now = ApiHelpers.NowSql(), target.Id });
            target.Role = nextRole;
            await projects.SyncOrganizationMembershipToProjectsAsync(connection, target);
            return await OrganizationMembersResponse(connection, projects, organization);
        });
    }

    public static Task<IResult> OrganizationMemberRemove(long organizationId, long membershipId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return OrganizationMembershipDeleteCore(organizationId, membershipId, false, context, db, auth, projects);
    }

    public static Task<IResult> OrganizationMemberCancel(long organizationId, long membershipId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return OrganizationMembershipDeleteCore(organizationId, membershipId, true, context, db, auth, projects);
    }

    public static Task<IResult> OrganizationLeave(long organizationId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var (organization, membership, error) = await projects.LoadOrganizationAsync(connection, organizationId, user);
            if (error is not null || organization is null || membership is null)
            {
                return error!;
            }

            if (membership.Role == ProjectService.RoleOwner)
            {
                return ApiHelpers.JsonError("The organization owner cannot leave the organization.", StatusCodes.Status403Forbidden);
            }

            await projects.RemoveOrganizationMembershipFromProjectsAsync(connection, organization, user.Id);
            await connection.ExecuteAsync("delete from projects_organizationmembership where id = @Id", new { membership.Id });
            return Results.Json(new { success = true, organizationId = organization.Id });
        });
    }

    public static Task<IResult> Projects(HttpContext context, AppDb db, AuthService auth, ProjectService projects, GitHubClient github)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            if (HttpMethods.IsGet(context.Request.Method))
            {
                var memberships = await connection.QueryAsync<ProjectMembership>(
                    """
                    select m.*
                    from projects_projectmembership m
                    join projects_project p on p.id = m.project_id
                    where m.user_id = @UserId and m.status = @Status
                    order by p.updated_at desc
                    """,
                    new { UserId = user.Id, Status = ProjectService.StatusActive });
                var summaries = new List<object>();
                foreach (var projectMembership in memberships)
                {
                    var listedProject = await connection.QueryFirstAsync<Project>("select * from projects_project where id = @Id", new { Id = projectMembership.ProjectId });
                    summaries.Add(await projects.SerializeProjectSummaryAsync(connection, listedProject, projectMembership));
                }

                return Results.Json(new { projects = summaries });
            }

            var (payload, error) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (error is not null || payload is null)
            {
                return error!;
            }

            var name = (payload.Value<string>("name") ?? "").Trim();
            var description = (payload.Value<string>("description") ?? "").Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                return ApiHelpers.JsonError("Project name is required.");
            }

            long organizationId;
            if (!long.TryParse(payload["organizationId"]?.ToString(), out organizationId))
            {
                return ApiHelpers.JsonError("Choose an organization for the new project.");
            }

            string? repositoryId;
            try
            {
                repositoryId = projects.ParseSelectedRepositoryId(payload);
            }
            catch (ArgumentException ex)
            {
                return ApiHelpers.JsonError(ex.Message);
            }

            var (organization, organizationMembership, loadError) = await projects.LoadOrganizationAsync(connection, organizationId, user);
            if (loadError is not null || organization is null || organizationMembership is null)
            {
                return loadError!;
            }

            if (organizationMembership.Role is not (ProjectService.RoleOwner or ProjectService.RoleAdmin))
            {
                return ApiHelpers.JsonError("Only admins and owners can create projects in this organization.", StatusCodes.Status403Forbidden);
            }

            JsonObject? selectedRepo = null;
            if (!string.IsNullOrWhiteSpace(repositoryId))
            {
                var accessToken = await projects.GetGitHubAccessTokenAsync(connection, user);
                if (string.IsNullOrWhiteSpace(accessToken))
                {
                    return ApiHelpers.JsonError("Connect your GitHub account before selecting a GitHub repository.");
                }

                try
                {
                    selectedRepo = (await github.GetRepositoriesAsync(accessToken)).FirstOrDefault(repo => (repo.Value<long?>("id") ?? 0).ToString() == repositoryId);
                }
                catch (GitHubApiException ex)
                {
                    return ApiHelpers.JsonError(ex.Message, ex.StatusCode);
                }

                if (selectedRepo is null)
                {
                    return ApiHelpers.JsonError("The selected repository is no longer available.");
                }
            }

            var now = ApiHelpers.NowSql();
            await connection.ExecuteAsync(
                "insert into projects_project (name, description, organization_id, owner_id, use_sprints, created_at, updated_at) values (@Name, @Description, @OrganizationId, @OwnerId, 0, @Now, @Now)",
                new { Name = name, Description = description, OrganizationId = organization.Id, OwnerId = organization.OwnerId, Now = now });
            var project = await connection.QueryFirstAsync<Project>("select * from projects_project where id = last_insert_rowid()");
            await projects.SyncOrganizationMembershipsToProjectAsync(connection, project);
            var membership = await connection.QueryFirstOrDefaultAsync<ProjectMembership>(
                "select * from projects_projectmembership where project_id = @ProjectId and user_id = @UserId and status = @Status",
                new { ProjectId = project.Id, UserId = user.Id, Status = ProjectService.StatusActive });
            if (membership is null)
            {
                await connection.ExecuteAsync(
                    "insert into projects_projectmembership (project_id, user_id, role, status, added_by_id, created_at, updated_at) values (@ProjectId, @UserId, @Role, @Status, @AddedById, @Now, @Now)",
                    new { ProjectId = project.Id, UserId = user.Id, Role = user.Id == project.OwnerId ? ProjectService.RoleOwner : organizationMembership.Role, Status = ProjectService.StatusActive, AddedById = user.Id, Now = now });
                membership = await connection.QueryFirstAsync<ProjectMembership>("select * from projects_projectmembership where id = last_insert_rowid()");
            }

            if (selectedRepo is not null)
            {
                await projects.CreateProjectRepositoryAsync(connection, project, selectedRepo);
            }

            var repoDescription = selectedRepo is not null ? " and connected a GitHub repository." : " without a connected GitHub repository.";
            await projects.RecordActivityAsync(connection, project, user, "project.created", $"Created project \"{project.Name}\" inside \"{organization.Name}\"{repoDescription}");
            return await ProjectResponse(connection, projects, project, user, membership, StatusCodes.Status201Created);
        });
    }

    public static Task<IResult> ProjectDetail(long projectId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var (project, membership, error) = await projects.LoadProjectAsync(connection, projectId, user);
            return error is not null || project is null || membership is null
                ? error!
                : await ProjectResponse(connection, projects, project, user, membership);
        });
    }

    public static Task<IResult> ProjectSettings(long projectId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var (project, membership, error) = await projects.LoadProjectAsync(connection, projectId, user);
            if (error is not null || project is null || membership is null)
            {
                return error!;
            }

            if (!projects.RoleAtLeast(membership, ProjectService.RoleAdmin))
            {
                return ApiHelpers.JsonError("Only project admins can update project settings.", StatusCodes.Status403Forbidden);
            }

            var (payload, parseError) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (parseError is not null || payload is null)
            {
                return parseError!;
            }

            var name = (payload.Value<string>("name") ?? "").Trim();
            var description = (payload.Value<string>("description") ?? "").Trim();
            var useSprints = payload.Value<bool?>("useSprints") == true;
            if (string.IsNullOrWhiteSpace(name))
            {
                return ApiHelpers.JsonError("Project name is required.");
            }

            var changed = new List<string>();
            if (name != project.Name) changed.Add("name");
            if (description != project.Description) changed.Add("description");
            if (useSprints != project.UseSprints) changed.Add("sprint mode");
            await connection.ExecuteAsync(
                "update projects_project set name = @Name, description = @Description, use_sprints = @UseSprints, updated_at = @Now where id = @Id",
                new { Name = name, Description = description, UseSprints = useSprints ? 1 : 0, Now = ApiHelpers.NowSql(), project.Id });
            project.Name = name;
            project.Description = description;
            project.UseSprints = useSprints;
            if (useSprints)
            {
                await projects.EnsureActiveSprintAsync(connection, project);
            }

            if (changed.Count > 0)
            {
                await projects.RecordActivityAsync(connection, project, user, "project.updated", $"Updated project settings ({string.Join(", ", changed)}).");
            }

            return await ProjectResponse(connection, projects, project, user, membership);
        });
    }

    public static Task<IResult> ProjectDelete(long projectId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var (project, membership, error) = await projects.LoadProjectAsync(connection, projectId, user);
            if (error is not null || project is null || membership is null)
            {
                return error!;
            }

            if (membership.Role != ProjectService.RoleOwner)
            {
                return ApiHelpers.JsonError("Only the project owner can delete the project.", StatusCodes.Status403Forbidden);
            }

            await connection.ExecuteAsync("delete from projects_project where id = @Id", new { project.Id });
            await projects.TouchOrganizationAsync(connection, project.OrganizationId);
            return Results.Json(new { success = true, projectId = project.Id });
        });
    }

    public static Task<IResult> ProjectSprintEnd(long projectId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var (project, membership, error) = await projects.LoadProjectAsync(connection, projectId, user);
            if (error is not null || project is null || membership is null)
            {
                return error!;
            }

            if (!projects.RoleAtLeast(membership, ProjectService.RoleAdmin))
            {
                return ApiHelpers.JsonError("Only admins and owners can end a sprint.", StatusCodes.Status403Forbidden);
            }

            if (!project.UseSprints)
            {
                return ApiHelpers.JsonError("Enable sprint mode before ending a sprint.");
            }

            var activeSprint = await projects.GetActiveSprintAsync(connection, project);
            if (activeSprint is null)
            {
                return ApiHelpers.JsonError("There is no active sprint to end.", StatusCodes.Status404NotFound);
            }

            var (payload, parseError) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (parseError is not null || payload is null)
            {
                return parseError!;
            }

            var reviewText = (payload.Value<string>("reviewText") ?? "").Trim();
            var unfinishedAction = (payload.Value<string>("unfinishedAction") ?? "carryover").Trim();
            if (string.IsNullOrWhiteSpace(unfinishedAction)) unfinishedAction = "carryover";
            if (unfinishedAction is not ("done" or "carryover" or "product"))
            {
                return ApiHelpers.JsonError("Choose a valid action for unfinished sprint tasks.");
            }

            var sprintTasks = (await connection.QueryAsync<TaskItem>(
                "select * from projects_task where project_id = @ProjectId and sprint_id = @SprintId order by status, updated_at desc, id desc",
                new { ProjectId = project.Id, SprintId = activeSprint.Id })).ToList();
            var completed = sprintTasks.Where(task => task.Status == ProjectService.TaskDone).ToList();
            var unfinished = sprintTasks.Where(task => task.Status != ProjectService.TaskDone).ToList();
            var nextSprint = await projects.CreateSprintAsync(connection, project);
            var carryover = new List<TaskItem>();
            var returnedToProduct = new List<TaskItem>();
            var autoCompleted = new List<TaskItem>();
            if (unfinishedAction == "done")
            {
                foreach (var task in unfinished)
                {
                    await connection.ExecuteAsync("update projects_task set status = @Status, updated_at = @Now where id = @Id", new { Status = ProjectService.TaskDone, Now = ApiHelpers.NowSql(), task.Id });
                    task.Status = ProjectService.TaskDone;
                    await projects.CloseBugsFromResolutionTaskAsync(connection, task, user);
                }

                autoCompleted = unfinished;
            }
            else if (unfinishedAction == "product")
            {
                foreach (var task in unfinished)
                {
                    await connection.ExecuteAsync("update projects_task set sprint_id = null, updated_at = @Now where id = @Id", new { Now = ApiHelpers.NowSql(), task.Id });
                }

                returnedToProduct = unfinished;
            }
            else
            {
                foreach (var task in unfinished)
                {
                    await connection.ExecuteAsync("update projects_task set sprint_id = @SprintId, updated_at = @Now where id = @Id", new { SprintId = nextSprint.Id, Now = ApiHelpers.NowSql(), task.Id });
                }

                carryover = unfinished;
            }

            var completedSnapshots = completed.Concat(autoCompleted).ToList();
            var summary = new
            {
                totalCount = sprintTasks.Count,
                completedCount = completedSnapshots.Count,
                carryoverCount = carryover.Count,
                returnedToProductCount = returnedToProduct.Count,
                completedTasks = completedSnapshots.Select(SerializeSprintTaskSnapshot),
                carryoverTasks = carryover.Select(SerializeSprintTaskSnapshot),
                returnedToProductTasks = returnedToProduct.Select(SerializeSprintTaskSnapshot),
                unfinishedAction,
            };
            await connection.ExecuteAsync(
                "update projects_sprint set status = 'completed', review_text = @ReviewText, ended_at = @Now, summary = @Summary, updated_at = @Now where id = @Id",
                new { ReviewText = reviewText, Now = ApiHelpers.NowSql(), Summary = ApiHelpers.ToJsonText(summary), activeSprint.Id });
            var unfinishedSummary = unfinishedAction switch
            {
                "done" => $"{autoCompleted.Count} auto-completed tasks",
                "product" => $"{returnedToProduct.Count} tasks returned to the product backlog",
                _ => $"{carryover.Count} carryover tasks",
            };
            await projects.RecordActivityAsync(connection, project, user, "sprint.ended", $"Ended {activeSprint.Name} with {completedSnapshots.Count} completed tasks and {unfinishedSummary}.", metadata: new { endedSprintId = activeSprint.Id, nextSprintId = nextSprint.Id, unfinishedAction });
            return await ProjectResponse(connection, projects, project, user, membership);
        });
    }

    public static Task<IResult> ProjectSprintUpdate(long projectId, long sprintId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var (project, membership, error) = await projects.LoadProjectAsync(connection, projectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (!projects.RoleAtLeast(membership, ProjectService.RoleAdmin)) return ApiHelpers.JsonError("Only admins and owners can rename sprints.", StatusCodes.Status403Forbidden);
            var sprint = await connection.QueryFirstOrDefaultAsync<Sprint>("select * from projects_sprint where project_id = @ProjectId and id = @Id", new { ProjectId = project.Id, Id = sprintId });
            if (sprint is null) return ApiHelpers.JsonError("Sprint not found.", StatusCodes.Status404NotFound);
            var (payload, parseError) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (parseError is not null || payload is null) return parseError!;
            var name = (payload.Value<string>("name") ?? "").Trim();
            if (string.IsNullOrWhiteSpace(name)) return ApiHelpers.JsonError("Sprint name is required.");
            if (name != sprint.Name)
            {
                var previous = sprint.Name;
                await connection.ExecuteAsync("update projects_sprint set name = @Name, updated_at = @Now where id = @Id", new { Name = name, Now = ApiHelpers.NowSql(), sprint.Id });
                await projects.RecordActivityAsync(connection, project, user, "sprint.renamed", $"Renamed sprint \"{previous}\" to \"{name}\".", metadata: new { sprintId = sprint.Id });
            }
            return await ProjectResponse(connection, projects, project, user, membership);
        });
    }

    public static Task<IResult> ProjectRepoAdd(long projectId, HttpContext context, AppDb db, AuthService auth, ProjectService projects, GitHubClient github)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var (project, membership, error) = await projects.LoadProjectAsync(connection, projectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (membership.Role != ProjectService.RoleOwner) return ApiHelpers.JsonError("Only the project owner can connect a repository.", StatusCodes.Status403Forbidden);
            var accessToken = await projects.GetGitHubAccessTokenAsync(connection, user);
            if (string.IsNullOrWhiteSpace(accessToken)) return ApiHelpers.JsonError("Connect GitHub before connecting a repository.");
            var (payload, parseError) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (parseError is not null || payload is null) return parseError!;
            string? repositoryId;
            try { repositoryId = projects.ParseSelectedRepositoryId(payload); } catch (ArgumentException ex) { return ApiHelpers.JsonError(ex.Message); }
            if (string.IsNullOrWhiteSpace(repositoryId)) return ApiHelpers.JsonError("Choose a repository to connect.");
            var existing = await connection.QueryFirstOrDefaultAsync<ProjectRepository>("select * from projects_projectrepository where project_id = @ProjectId order by id limit 1", new { ProjectId = project.Id });
            if (existing is not null) return ApiHelpers.JsonError(existing.GithubRepoId == repositoryId ? "That repository is already connected to this project." : "This project already has a connected repository. Remove it first to connect a different one.");
            try
            {
                var repo = (await github.GetRepositoriesAsync(accessToken)).FirstOrDefault(item => (item.Value<long?>("id") ?? 0).ToString() == repositoryId);
                if (repo is null) return ApiHelpers.JsonError("The selected repository is no longer available.");
                await projects.CreateProjectRepositoryAsync(connection, project, repo);
                await projects.RecordActivityAsync(connection, project, user, "project.repo_added", $"Connected GitHub repository \"{repo.Value<string>("full_name") ?? repo.Value<string>("name") ?? repositoryId}\" to the project.");
                return await ProjectResponse(connection, projects, project, user, membership);
            }
            catch (GitHubApiException ex)
            {
                return ApiHelpers.JsonError(ex.Message, ex.StatusCode);
            }
        });
    }

    public static Task<IResult> ProjectRepoRemove(long projectId, long repositoryId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var (project, membership, error) = await projects.LoadProjectAsync(connection, projectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (membership.Role != ProjectService.RoleOwner) return ApiHelpers.JsonError("Only the project owner can disconnect the repository.", StatusCodes.Status403Forbidden);
            var repo = await connection.QueryFirstOrDefaultAsync<ProjectRepository>("select * from projects_projectrepository where project_id = @ProjectId and id = @Id", new { ProjectId = project.Id, Id = repositoryId });
            if (repo is null) return ApiHelpers.JsonError("Repository not found.", StatusCodes.Status404NotFound);
            await connection.ExecuteAsync("delete from projects_projectrepository where id = @Id", new { repo.Id });
            await projects.RecordActivityAsync(connection, project, user, "project.repo_removed", $"Disconnected GitHub repository \"{repo.FullName}\" from the project.");
            return await ProjectResponse(connection, projects, project, user, membership);
        });
    }

    public static Task<IResult> ProjectMembers(long projectId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ProjectMemberInviteCore(projectId, context, db, auth, projects);
    }

    public static Task<IResult> ProjectMemberRole(long projectId, long membershipId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ProjectMemberRoleCore(projectId, membershipId, context, db, auth, projects);
    }

    public static Task<IResult> ProjectMemberRemove(long projectId, long membershipId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ProjectMemberRemoveCore(projectId, membershipId, context, db, auth, projects);
    }

    public static Task<IResult> ProjectTasks(long projectId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return CreateTaskCore(projectId, context, db, auth, projects);
    }

    public static Task<IResult> TaskUpdate(long taskId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return UpdateTaskCore(taskId, context, db, auth, projects);
    }

    public static Task<IResult> TaskDelete(long taskId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return DeleteTaskCore(taskId, context, db, auth, projects);
    }

    public static Task<IResult> TaskComment(long taskId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return AddTaskCommentCore(taskId, context, db, auth, projects);
    }

    public static Task<IResult> TaskCommentReaction(long commentId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ToggleTaskCommentReactionCore(commentId, context, db, auth, projects);
    }

    public static Task<IResult> TaskIssueLink(long taskId, HttpContext context, AppDb db, AuthService auth, ProjectService projects, GitHubClient github)
    {
        return TaskIssueLinkCore(taskId, context, db, auth, projects, github);
    }

    public static Task<IResult> TaskBranch(long taskId, HttpContext context, AppDb db, AuthService auth, ProjectService projects, GitHubClient github)
    {
        return TaskBranchCore(taskId, context, db, auth, projects, github);
    }

    public static Task<IResult> ProjectGitHubIssues(long projectId, HttpContext context, AppDb db, AuthService auth, ProjectService projects, GitHubClient github)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var (project, membership, error) = await projects.LoadProjectAsync(connection, projectId, user);
            if (error is not null || project is null || membership is null) return error!;
            if (!projects.RoleAtLeast(membership, ProjectService.RoleMember)) return ApiHelpers.JsonError("Only project members can import GitHub issues as bugs.", StatusCodes.Status403Forbidden);
            var repositories = (await connection.QueryAsync<ProjectRepository>("select * from projects_projectrepository where project_id = @ProjectId order by full_name, id", new { ProjectId = project.Id })).ToList();
            if (repositories.Count == 0) return Results.Json(new { issues = Array.Empty<object>() });
            var accessToken = await projects.GetProjectGitHubAccessTokenAsync(connection, project, user);
            if (string.IsNullOrWhiteSpace(accessToken)) return ApiHelpers.JsonError("Connect GitHub before importing issues.");
            var importedKeys = (await connection.QueryAsync<(string RepositoryFullName, long IssueNumber)>("select repository_full_name as RepositoryFullName, issue_number as IssueNumber from projects_githubissuelink where project_id = @ProjectId and bug_report_id is not null", new { ProjectId = project.Id })).ToHashSet();
            var seen = new HashSet<(string RepositoryFullName, long IssueNumber)>();
            var issues = new List<object>();
            try
            {
                foreach (var repo in repositories)
                {
                    foreach (var issue in await github.GetRepositoryIssuesAsync(accessToken, repo.FullName))
                    {
                        if (issue.ContainsKey("pull_request")) continue;
                        var issueNumber = issue.Value<long?>("number");
                        if (issueNumber is null) continue;
                        var key = (repo.FullName, issueNumber.Value);
                        if (importedKeys.Contains(key) || !seen.Add(key)) continue;
                        issues.Add(projects.SerializeGitHubIssueCandidate(repo, issue));
                    }
                }

                return Results.Json(new { issues = issues.OrderByDescending(item => item.GetType().GetProperty("updatedAt")?.GetValue(item)?.ToString()).ToList() });
            }
            catch (GitHubApiException ex)
            {
                return ApiHelpers.JsonError(ex.Message, ex.StatusCode);
            }
        });
    }

    public static Task<IResult> ProjectBugImport(long projectId, HttpContext context, AppDb db, AuthService auth, ProjectService projects, GitHubClient github)
    {
        return ImportBugCore(projectId, context, db, auth, projects, github);
    }

    public static Task<IResult> ProjectBugs(long projectId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return CreateBugCore(projectId, context, db, auth, projects);
    }

    public static Task<IResult> BugUpdate(long bugId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return UpdateBugCore(bugId, context, db, auth, projects);
    }

    public static Task<IResult> BugDelete(long bugId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return DeleteBugCore(bugId, context, db, auth, projects);
    }

    public static Task<IResult> BugComment(long bugId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return AddBugCommentCore(bugId, context, db, auth, projects);
    }

    public static Task<IResult> BugCommentReaction(long commentId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ToggleBugCommentReactionCore(commentId, context, db, auth, projects);
    }

    public static Task<IResult> BugIssueLink(long bugId, HttpContext context, AppDb db, AuthService auth, ProjectService projects, GitHubClient github)
    {
        return BugIssueLinkCore(bugId, context, db, auth, projects, github);
    }

    public static Task<IResult> BugResolution(long bugId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return BugResolutionCore(bugId, context, db, auth, projects);
    }

    public static Task<IResult> NotificationAccept(long notificationId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var notification = await connection.QueryFirstOrDefaultAsync<Notification>("select * from projects_notification where id = @Id and recipient_id = @UserId", new { Id = notificationId, UserId = user.Id });
            if (notification is null) return ApiHelpers.JsonError("Notification not found.", StatusCodes.Status404NotFound);
            if (notification.Kind != ProjectService.KindInvite || notification.OrganizationId is null) return ApiHelpers.JsonError("This notification cannot be accepted.", StatusCodes.Status409Conflict);
            var metadata = JsonNode.Parse(notification.Metadata)?.AsObject();
            var membershipId = metadata?.Value<long?>("organizationMembershipId");
            var invite = await connection.QueryFirstOrDefaultAsync<OrganizationMembership>("select * from projects_organizationmembership where id = @Id and organization_id = @OrganizationId and user_id = @UserId and status = @Status", new { Id = membershipId, OrganizationId = notification.OrganizationId, UserId = user.Id, Status = ProjectService.StatusInvited });
            if (invite is null) return ApiHelpers.JsonError("This invite is no longer available.", StatusCodes.Status404NotFound);
            await projects.ActivateOrganizationInviteAsync(connection, invite, notification);
            return Results.Json(new { notification = await projects.SerializeNotificationAsync(connection, notification) });
        });
    }

    public static Task<IResult> NotificationRead(long notificationId, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var notification = await connection.QueryFirstOrDefaultAsync<Notification>("select * from projects_notification where id = @Id and recipient_id = @UserId", new { Id = notificationId, UserId = user.Id });
            if (notification is null) return ApiHelpers.JsonError("Notification not found.", StatusCodes.Status404NotFound);
            await connection.ExecuteAsync("update projects_notification set is_read = 1 where id = @Id", new { notification.Id });
            notification.IsRead = true;
            return Results.Json(new { notification = await projects.SerializeNotificationAsync(connection, notification) });
        });
    }

    public static Task<IResult> NotificationCloseRelated(HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            var (payload, error) = await ApiHelpers.ReadJsonBodyAsync(context);
            if (error is not null || payload is null) return error!;
            var hasTask = payload.ContainsKey("taskId") && payload["taskId"] is not null;
            var hasBug = payload.ContainsKey("bugReportId") && payload["bugReportId"] is not null;
            if (!hasTask && !hasBug) return ApiHelpers.JsonError("Choose a related task or bug notification target.");
            if ((hasTask && !long.TryParse(payload["taskId"]!.ToString(), out _)) || (hasBug && !long.TryParse(payload["bugReportId"]!.ToString(), out _))) return ApiHelpers.JsonError("Choose a valid related task or bug notification target.");
            long? taskId = hasTask ? long.Parse(payload["taskId"]!.ToString()) : null;
            long? bugReportId = hasBug ? long.Parse(payload["bugReportId"]!.ToString()) : null;
            await using var connection = db.Open();
            var ids = await projects.CloseRelatedNotificationsForUserAsync(connection, user, taskId, bugReportId);
            return Results.Json(new { closedNotificationIds = ids });
        });
    }

    public static Task<IResult> ProjectEvents(long projectId, HttpContext context, AppDb db, AuthService auth, ProjectService projects, AppConfig config)
    {
        return ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using (var connection = db.Open())
            {
                var (project, _, error) = await projects.LoadProjectAsync(connection, projectId, user);
                if (error is not null || project is null) return error!;
            }

            context.Response.Headers.CacheControl = "no-cache";
            context.Response.Headers["X-Accel-Buffering"] = "no";
            context.Response.ContentType = "text/event-stream";
            var lastSeen = "";
            await context.Response.WriteAsync($"retry: {config.ProjectEventsRetryMs}\n\n");
            while (!context.RequestAborted.IsCancellationRequested)
            {
                await using var loopConnection = db.Open();
                var current = await loopConnection.QueryFirstOrDefaultAsync<Project>("select * from projects_project where id = @Id", new { Id = projectId });
                if (current is null)
                {
                    await context.Response.WriteAsync("event: project.deleted\ndata: {}\n\n");
                    break;
                }

                var stamp = ApiHelpers.Iso(current.UpdatedAt);
                if (string.IsNullOrEmpty(lastSeen))
                {
                    lastSeen = stamp;
                    await context.Response.WriteAsync($"event: stream.open\ndata: {ApiHelpers.ToJsonText(new { updatedAt = stamp })}\n\n");
                }
                else if (stamp != lastSeen)
                {
                    lastSeen = stamp;
                    await context.Response.WriteAsync($"event: project.updated\ndata: {ApiHelpers.ToJsonText(new { updatedAt = stamp })}\n\n");
                }
                else
                {
                    await context.Response.WriteAsync(": keepalive\n\n");
                }

                await context.Response.Body.FlushAsync(context.RequestAborted);
                await Task.Delay(TimeSpan.FromSeconds(config.ProjectEventsPollIntervalSeconds), context.RequestAborted);
            }

            return Results.Empty;
        });
    }

    private static async Task<IResult> OrganizationMembershipDeleteCore(long organizationId, long membershipId, bool cancelInvite, HttpContext context, AppDb db, AuthService auth, ProjectService projects)
    {
        return await ApiHelpers.WithUserAsync(context, db, auth, async user =>
        {
            await using var connection = db.Open();
            var (organization, actorMembership, error) = await projects.LoadManageableOrganizationAsync(connection, organizationId, user);
            if (error is not null || organization is null || actorMembership is null) return error!;
            var target = await connection.QueryFirstOrDefaultAsync<OrganizationMembership>("select * from projects_organizationmembership where organization_id = @OrganizationId and id = @Id", new { OrganizationId = organization.Id, Id = membershipId });
            if (target is null) return ApiHelpers.JsonError("Organization member not found.", StatusCodes.Status404NotFound);
            if (cancelInvite && target.Status != ProjectService.StatusInvited) return ApiHelpers.JsonError("That invite has already been accepted.", StatusCodes.Status409Conflict);
            if (!cancelInvite && target.Role == ProjectService.RoleOwner) return ApiHelpers.JsonError("The organization owner cannot be removed.", StatusCodes.Status403Forbidden);
            if (!cancelInvite && target.UserId == user.Id) return ApiHelpers.JsonError("Use leave organization instead of removing yourself.", StatusCodes.Status400BadRequest);
            if (!projects.CanManageTargetOrganizationMembership(actorMembership, target)) return ApiHelpers.JsonError(cancelInvite ? "You do not have permission to cancel that invite." : "You do not have permission to remove that user.", StatusCodes.Status403Forbidden);
            if (cancelInvite)
            {
                await connection.ExecuteAsync("update projects_notification set is_read = 1 where recipient_id = @UserId and organization_id = @OrganizationId and kind = @Kind", new { target.UserId, OrganizationId = organization.Id, Kind = ProjectService.KindInvite });
            }

            await projects.RemoveOrganizationMembershipFromProjectsAsync(connection, organization, target.UserId);
            await connection.ExecuteAsync("delete from projects_organizationmembership where id = @Id", new { target.Id });
            return Results.Json(new { success = true });
        });
    }

    private static async Task<IResult> OrganizationMembersResponse(SqliteConnection connection, ProjectService projects, Organization organization, int status = StatusCodes.Status200OK)
    {
        var rows = await connection.QueryAsync<OrganizationMembership>("select * from projects_organizationmembership where organization_id = @OrganizationId order by id", new { OrganizationId = organization.Id });
        var members = new List<object>();
        foreach (var row in rows)
        {
            members.Add(await projects.SerializeOrganizationMemberAsync(connection, row));
        }

        return Results.Json(new { members }, statusCode: status);
    }

    private static async Task<IResult> ProjectResponse(SqliteConnection connection, ProjectService projects, Project project, User user, ProjectMembership membership, int status = StatusCodes.Status200OK)
    {
        var reloaded = await connection.QueryFirstOrDefaultAsync<Project>("select * from projects_project where id = @Id", new { project.Id }) ?? project;
        return Results.Json(new { project = await projects.BuildProjectSnapshotAsync(connection, reloaded, user, membership) }, statusCode: status);
    }

    private static async Task<User?> FindUserByIdentifierAsync(SqliteConnection connection, string identifier)
    {
        return identifier.Contains('@')
            ? await connection.QueryFirstOrDefaultAsync<User>("select * from auth_user where lower(email) = lower(@Identifier)", new { Identifier = identifier })
            : await connection.QueryFirstOrDefaultAsync<User>("select * from auth_user where lower(username) = lower(@Identifier)", new { Identifier = identifier });
    }

    private static string? ValidatePassword(string password)
    {
        if (password.Length < 8) return "This password is too short. It must contain at least 8 characters.";
        if (password.All(char.IsDigit)) return "This password is entirely numeric.";
        return null;
    }

    private static object SerializeSprintTaskSnapshot(TaskItem task) => new
    {
        id = task.Id,
        title = task.Title,
        status = task.Status,
        priority = task.Priority,
    };

    private static string CreateOAuthState(AppConfig config, long userId)
    {
        var payload = ApiHelpers.ToJsonText(new { user_id = userId, nonce = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16)), iat = DateTimeOffset.UtcNow.ToUnixTimeSeconds() });
        var data = AuthService.Base64UrlEncode(Encoding.UTF8.GetBytes(payload));
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes($"{config.SecretKey}:github-oauth-state"));
        var signature = AuthService.Base64UrlEncode(hmac.ComputeHash(Encoding.ASCII.GetBytes(data)));
        return $"{data}.{signature}";
    }

    private static bool ValidateOAuthState(AppConfig config, string state, long userId)
    {
        var parts = state.Split('.');
        if (parts.Length != 2) return false;
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes($"{config.SecretKey}:github-oauth-state"));
        var expected = AuthService.Base64UrlEncode(hmac.ComputeHash(Encoding.ASCII.GetBytes(parts[0])));
        if (!CryptographicOperations.FixedTimeEquals(AuthService.Base64UrlDecode(expected), AuthService.Base64UrlDecode(parts[1]))) return false;
        var payload = JsonSerializer.Deserialize<JsonObject>(AuthService.Base64UrlDecode(parts[0]), ApiHelpers.JsonOptions);
        if (payload is null) return false;
        var stateUserId = payload.Value<long?>("user_id");
        var iat = payload.Value<long?>("iat");
        return stateUserId == userId && iat is not null && DateTimeOffset.UtcNow.ToUnixTimeSeconds() - iat.Value <= 600;
    }

}
