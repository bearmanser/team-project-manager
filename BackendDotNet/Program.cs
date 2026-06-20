using System.Text.Json;
using Dapper;

DefaultTypeMap.MatchNamesWithUnderscores = true;

EnvLoader.Load(Path.Combine(Directory.GetCurrentDirectory(), ".env"));

var builder = WebApplication.CreateBuilder(args);
var config = AppConfig.Load(builder.Environment.ContentRootPath);

builder.Services.AddSingleton(config);
builder.Services.AddSingleton<AppDb>();
builder.Services.AddSingleton<AuthService>();
builder.Services.AddSingleton<ProjectService>();
builder.Services.AddHttpClient<GitHubClient>();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
});

var app = builder.Build();

await app.Services.GetRequiredService<AppDb>().EnsureCreatedAsync();

app.Use(async (context, next) =>
{
    var origin = context.Request.Headers.Origin.ToString();
    if (!string.IsNullOrWhiteSpace(origin) && config.CorsAllowedOrigins.Contains(origin))
    {
        context.Response.Headers.AccessControlAllowOrigin = origin;
        context.Response.Headers.Vary = "Origin";
        context.Response.Headers.AccessControlAllowCredentials = "true";
    }

    context.Response.Headers.AccessControlAllowHeaders = "Authorization, Content-Type";
    context.Response.Headers.AccessControlAllowMethods = "GET, POST, OPTIONS";

    if (HttpMethods.IsOptions(context.Request.Method))
    {
        context.Response.StatusCode = StatusCodes.Status204NoContent;
        return;
    }

    await next();
});

app.MapGet("/", () => Results.Json(new
{
    name = "Team Project Manager .NET API",
    status = "ok",
}));

app.MapPost("/api/auth/signup/", ApiEndpoints.Signup);
app.MapPost("/api/auth/login/", ApiEndpoints.Login);
app.MapPost("/api/auth/logout/", ApiEndpoints.Logout);
app.MapGet("/api/auth/me/", ApiEndpoints.Me);

app.MapGet("/api/github/oauth/start/", ApiEndpoints.GitHubOAuthStart);
app.MapPost("/api/github/oauth/complete/", ApiEndpoints.GitHubOAuthComplete);
app.MapPost("/api/github/disconnect/", ApiEndpoints.GitHubDisconnect);
app.MapGet("/api/github/repos/", ApiEndpoints.GitHubRepos);

app.MapGet("/api/workspace/", ApiEndpoints.Workspace);
app.MapGet("/api/organizations/", ApiEndpoints.Organizations);
app.MapPost("/api/organizations/", ApiEndpoints.Organizations);
app.MapPost("/api/organizations/{organizationId:long}/settings/", ApiEndpoints.OrganizationSettings);
app.MapPost("/api/organizations/{organizationId:long}/delete/", ApiEndpoints.OrganizationDelete);
app.MapGet("/api/organizations/{organizationId:long}/members/", ApiEndpoints.OrganizationMembers);
app.MapPost("/api/organizations/{organizationId:long}/members/", ApiEndpoints.OrganizationMembers);
app.MapPost("/api/organizations/{organizationId:long}/members/{membershipId:long}/role/", ApiEndpoints.OrganizationMemberRole);
app.MapPost("/api/organizations/{organizationId:long}/members/{membershipId:long}/remove/", ApiEndpoints.OrganizationMemberRemove);
app.MapPost("/api/organizations/{organizationId:long}/members/{membershipId:long}/cancel/", ApiEndpoints.OrganizationMemberCancel);
app.MapPost("/api/organizations/{organizationId:long}/leave/", ApiEndpoints.OrganizationLeave);

app.MapGet("/api/projects/", ApiEndpoints.Projects);
app.MapPost("/api/projects/", ApiEndpoints.Projects);
app.MapGet("/api/projects/{projectId:long}/", ApiEndpoints.ProjectDetail);
app.MapGet("/api/projects/{projectId:long}/events/", ApiEndpoints.ProjectEvents);
app.MapGet("/api/projects/{projectId:long}/github-issues/", ApiEndpoints.ProjectGitHubIssues);
app.MapPost("/api/projects/{projectId:long}/settings/", ApiEndpoints.ProjectSettings);
app.MapPost("/api/projects/{projectId:long}/delete/", ApiEndpoints.ProjectDelete);
app.MapPost("/api/projects/{projectId:long}/sprints/end/", ApiEndpoints.ProjectSprintEnd);
app.MapPost("/api/projects/{projectId:long}/sprints/{sprintId:long}/update/", ApiEndpoints.ProjectSprintUpdate);
app.MapPost("/api/projects/{projectId:long}/repos/add/", ApiEndpoints.ProjectRepoAdd);
app.MapPost("/api/projects/{projectId:long}/repos/{repositoryId:long}/remove/", ApiEndpoints.ProjectRepoRemove);
app.MapPost("/api/projects/{projectId:long}/members/", ApiEndpoints.ProjectMembers);
app.MapPost("/api/projects/{projectId:long}/members/{membershipId:long}/role/", ApiEndpoints.ProjectMemberRole);
app.MapPost("/api/projects/{projectId:long}/members/{membershipId:long}/remove/", ApiEndpoints.ProjectMemberRemove);
app.MapPost("/api/projects/{projectId:long}/tasks/", ApiEndpoints.ProjectTasks);
app.MapPost("/api/projects/{projectId:long}/bugs/import/", ApiEndpoints.ProjectBugImport);
app.MapPost("/api/projects/{projectId:long}/bugs/", ApiEndpoints.ProjectBugs);

app.MapPost("/api/tasks/{taskId:long}/update/", ApiEndpoints.TaskUpdate);
app.MapPost("/api/tasks/{taskId:long}/delete/", ApiEndpoints.TaskDelete);
app.MapPost("/api/tasks/{taskId:long}/comments/", ApiEndpoints.TaskComment);
app.MapPost("/api/task-comments/{commentId:long}/reactions/", ApiEndpoints.TaskCommentReaction);
app.MapPost("/api/tasks/{taskId:long}/issues/", ApiEndpoints.TaskIssueLink);
app.MapPost("/api/tasks/{taskId:long}/branch/", ApiEndpoints.TaskBranch);

app.MapPost("/api/bugs/{bugId:long}/update/", ApiEndpoints.BugUpdate);
app.MapPost("/api/bugs/{bugId:long}/delete/", ApiEndpoints.BugDelete);
app.MapPost("/api/bugs/{bugId:long}/comments/", ApiEndpoints.BugComment);
app.MapPost("/api/bug-comments/{commentId:long}/reactions/", ApiEndpoints.BugCommentReaction);
app.MapPost("/api/bugs/{bugId:long}/issues/", ApiEndpoints.BugIssueLink);
app.MapPost("/api/bugs/{bugId:long}/resolution/", ApiEndpoints.BugResolution);

app.MapPost("/api/notifications/{notificationId:long}/accept/", ApiEndpoints.NotificationAccept);
app.MapPost("/api/notifications/{notificationId:long}/read/", ApiEndpoints.NotificationRead);
app.MapPost("/api/notifications/close-related/", ApiEndpoints.NotificationCloseRelated);

app.Run();
