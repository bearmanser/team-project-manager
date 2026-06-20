using System.Buffers.Text;
using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Dapper;
using Microsoft.Data.Sqlite;

public static class EnvLoader
{
    public static void Load(string path)
    {
        if (!File.Exists(path))
        {
            return;
        }

        foreach (var rawLine in File.ReadAllLines(path))
        {
            var line = rawLine.Trim();
            if (line.Length == 0 || line.StartsWith('#') || !line.Contains('='))
            {
                continue;
            }

            var separator = line.IndexOf('=');
            var key = line[..separator].Trim();
            var value = line[(separator + 1)..].Trim().Trim('"', '\'');
            if (Environment.GetEnvironmentVariable(key) is null)
            {
                Environment.SetEnvironmentVariable(key, value);
            }
        }
    }
}

public sealed class AppConfig
{
    private const string DefaultFrontendUrl = "http://127.0.0.1:5173";

    public required string ContentRoot { get; init; }
    public required string SecretKey { get; init; }
    public required string SqlitePath { get; init; }
    public required string FrontendUrl { get; init; }
    public required string FrontendOrigin { get; init; }
    public required HashSet<string> CorsAllowedOrigins { get; init; }
    public required string GitHubClientId { get; init; }
    public required string GitHubClientSecret { get; init; }
    public required string GitHubOAuthRedirectUri { get; init; }
    public required string AuthAccessCookieName { get; init; }
    public required string AuthRefreshCookieName { get; init; }
    public required string AuthCookiePath { get; init; }
    public string? AuthCookieDomain { get; init; }
    public required bool AuthCookieSecure { get; init; }
    public required SameSiteMode AuthCookieSameSite { get; init; }
    public required int AccessTokenLifetimeSeconds { get; init; }
    public required int RefreshTokenLifetimeSeconds { get; init; }
    public required int AccessTokenRotationLeewaySeconds { get; init; }
    public required int ProjectEventsRetryMs { get; init; }
    public required double ProjectEventsPollIntervalSeconds { get; init; }

    public static AppConfig Load(string contentRoot)
    {
        var debug = GetBool("DEBUG", true);
        var frontendUrl = Get("FRONTEND_URL", DefaultFrontendUrl).TrimEnd('/');
        var frontendOrigin = NormalizeOrigin(Get("FRONTEND_ORIGIN", ExtractOrigin(frontendUrl) ?? DefaultFrontendUrl));
        var defaultCors = string.Join(',', new[] { frontendOrigin, "http://127.0.0.1:5173", "http://localhost:5173" }.Where(x => !string.IsNullOrWhiteSpace(x)));
        var sqlitePath = ResolveSqlitePath(contentRoot, Get("SQLITE_PATH", ""));

        return new AppConfig
        {
            ContentRoot = contentRoot,
            SecretKey = Get("SECRET_KEY", "django-insecure-$03g27)wtfb#qe*t)j7g#mum*-f*f-xqsqql$bj^kuc$e+!2o&"),
            SqlitePath = sqlitePath,
            FrontendUrl = frontendUrl,
            FrontendOrigin = frontendOrigin,
            CorsAllowedOrigins = ExpandOriginVariants(SplitCsv(Get("CORS_ALLOWED_ORIGINS", defaultCors))),
            GitHubClientId = Get("GITHUB_CLIENT_ID", ""),
            GitHubClientSecret = Get("GITHUB_CLIENT_SECRET", ""),
            GitHubOAuthRedirectUri = Get("GITHUB_OAUTH_REDIRECT_URI", $"{frontendUrl}/oauth/github/callback"),
            AuthAccessCookieName = Get("AUTH_ACCESS_COOKIE_NAME", "team_project_manager_access"),
            AuthRefreshCookieName = Get("AUTH_REFRESH_COOKIE_NAME", "team_project_manager_refresh"),
            AuthCookiePath = Get("AUTH_COOKIE_PATH", "/api/"),
            AuthCookieDomain = NullIfWhiteSpace(Get("AUTH_COOKIE_DOMAIN", "")),
            AuthCookieSecure = GetBool("AUTH_COOKIE_SECURE", !debug),
            AuthCookieSameSite = ParseSameSite(Get("AUTH_COOKIE_SAMESITE", "Strict")),
            AccessTokenLifetimeSeconds = GetInt("ACCESS_TOKEN_LIFETIME_SECONDS", 900),
            RefreshTokenLifetimeSeconds = GetInt("REFRESH_TOKEN_LIFETIME_SECONDS", 7 * 24 * 60 * 60),
            AccessTokenRotationLeewaySeconds = GetInt("ACCESS_TOKEN_ROTATION_LEEWAY_SECONDS", 300),
            ProjectEventsRetryMs = Math.Max(500, GetInt("PROJECT_EVENTS_RETRY_MS", 2000)),
            ProjectEventsPollIntervalSeconds = Math.Max(0.1, GetDouble("PROJECT_EVENTS_POLL_INTERVAL_SECONDS", 1.5)),
        };
    }

    private static string ResolveSqlitePath(string contentRoot, string configured)
    {
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return Path.GetFullPath(Path.IsPathRooted(configured) ? configured : Path.Combine(contentRoot, configured));
        }

        var djangoDb = Path.GetFullPath(Path.Combine(contentRoot, "..", "Backend", "db.sqlite3"));
        return File.Exists(djangoDb)
            ? djangoDb
            : Path.Combine(contentRoot, "db.sqlite3");
    }

    private static string Get(string key, string fallback) => Environment.GetEnvironmentVariable(key) ?? fallback;

    private static bool GetBool(string key, bool fallback)
    {
        var raw = Environment.GetEnvironmentVariable(key);
        return raw is null ? fallback : raw.Equals("true", StringComparison.OrdinalIgnoreCase);
    }

    private static int GetInt(string key, int fallback) => int.TryParse(Environment.GetEnvironmentVariable(key), out var value) ? value : fallback;

    private static double GetDouble(string key, double fallback) => double.TryParse(Environment.GetEnvironmentVariable(key), NumberStyles.Float, CultureInfo.InvariantCulture, out var value) ? value : fallback;

    private static SameSiteMode ParseSameSite(string value) => value.Trim().ToLowerInvariant() switch
    {
        "lax" => SameSiteMode.Lax,
        "none" => SameSiteMode.None,
        _ => SameSiteMode.Strict,
    };

    private static string? NullIfWhiteSpace(string value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string[] SplitCsv(string value) => value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private static string? ExtractOrigin(string url)
    {
        return Uri.TryCreate(url, UriKind.Absolute, out var uri)
            ? $"{uri.Scheme}://{uri.Authority}"
            : null;
    }

    private static string NormalizeOrigin(string value)
    {
        var stripped = value.Trim().TrimEnd('/');
        if (!stripped.Contains("://", StringComparison.Ordinal))
        {
            return stripped;
        }

        return ExtractOrigin(stripped) ?? stripped;
    }

    private static HashSet<string> ExpandOriginVariants(IEnumerable<string> origins)
    {
        var expanded = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var origin in origins.Select(NormalizeOrigin).Where(x => !string.IsNullOrWhiteSpace(x)))
        {
            expanded.Add(origin);
            if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) || string.IsNullOrWhiteSpace(uri.Host))
            {
                continue;
            }

            var alternateHost = uri.Host.StartsWith("www.", StringComparison.OrdinalIgnoreCase)
                ? uri.Host[4..]
                : $"www.{uri.Host}";
            var builder = new UriBuilder(uri) { Host = alternateHost };
            expanded.Add(builder.Uri.GetLeftPart(UriPartial.Authority));
        }

        return expanded;
    }
}

public sealed class AppDb(AppConfig config)
{
    public SqliteConnection Open()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(config.SqlitePath) ?? config.ContentRoot);
        var connection = new SqliteConnection(new SqliteConnectionStringBuilder
        {
            DataSource = config.SqlitePath,
            ForeignKeys = true,
        }.ToString());
        connection.Open();
        return connection;
    }

    public async Task EnsureCreatedAsync()
    {
        await using var connection = Open();
        foreach (var statement in SchemaSql.Split("\n;\n", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            await connection.ExecuteAsync(statement);
        }
    }

    private const string SchemaSql = """
CREATE TABLE IF NOT EXISTS "auth_user" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  "password" varchar(128) NOT NULL,
  "last_login" datetime NULL,
  "is_superuser" bool NOT NULL DEFAULT 0,
  "username" varchar(150) NOT NULL UNIQUE,
  "last_name" varchar(150) NOT NULL DEFAULT '',
  "email" varchar(254) NOT NULL,
  "is_staff" bool NOT NULL DEFAULT 0,
  "is_active" bool NOT NULL DEFAULT 1,
  "date_joined" datetime NOT NULL,
  "first_name" varchar(150) NOT NULL DEFAULT ''
)
;
CREATE TABLE IF NOT EXISTS "accounts_userprofile" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  "github_user_id" varchar(64) NULL UNIQUE,
  "github_username" varchar(255) NOT NULL DEFAULT '',
  "github_avatar_url" varchar(200) NOT NULL DEFAULT '',
  "github_access_token" text NOT NULL DEFAULT '',
  "github_connected_at" datetime NULL,
  "created_at" datetime NOT NULL,
  "updated_at" datetime NOT NULL,
  "user_id" integer NOT NULL UNIQUE REFERENCES "auth_user" ("id") ON DELETE CASCADE
)
;
CREATE TABLE IF NOT EXISTS "projects_organization" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  "name" varchar(255) NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "created_at" datetime NOT NULL,
  "updated_at" datetime NOT NULL,
  "owner_id" integer NOT NULL REFERENCES "auth_user" ("id") ON DELETE CASCADE,
  "is_personal" bool NOT NULL DEFAULT 0
)
;
CREATE TABLE IF NOT EXISTS "projects_organizationmembership" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  "role" varchar(16) NOT NULL DEFAULT 'member',
  "status" varchar(16) NOT NULL DEFAULT 'active',
  "created_at" datetime NOT NULL,
  "updated_at" datetime NOT NULL,
  "organization_id" bigint NOT NULL REFERENCES "projects_organization" ("id") ON DELETE CASCADE,
  "invited_by_id" integer NULL REFERENCES "auth_user" ("id") ON DELETE SET NULL,
  "user_id" integer NOT NULL REFERENCES "auth_user" ("id") ON DELETE CASCADE
)
;
CREATE TABLE IF NOT EXISTS "projects_project" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  "name" varchar(255) NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "created_at" datetime NOT NULL,
  "updated_at" datetime NOT NULL,
  "owner_id" integer NOT NULL REFERENCES "auth_user" ("id") ON DELETE CASCADE,
  "organization_id" bigint NULL REFERENCES "projects_organization" ("id") ON DELETE CASCADE,
  "use_sprints" bool NOT NULL DEFAULT 0
)
;
CREATE TABLE IF NOT EXISTS "projects_projectmembership" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  "role" varchar(16) NOT NULL DEFAULT 'member',
  "created_at" datetime NOT NULL,
  "updated_at" datetime NOT NULL,
  "added_by_id" integer NULL REFERENCES "auth_user" ("id") ON DELETE SET NULL,
  "project_id" bigint NOT NULL REFERENCES "projects_project" ("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "auth_user" ("id") ON DELETE CASCADE,
  "status" varchar(16) NOT NULL DEFAULT 'active'
)
;
CREATE TABLE IF NOT EXISTS "projects_projectrepository" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  "github_repo_id" varchar(64) NOT NULL,
  "name" varchar(255) NOT NULL,
  "full_name" varchar(255) NOT NULL,
  "html_url" varchar(200) NOT NULL,
  "default_branch" varchar(255) NOT NULL DEFAULT 'main',
  "visibility" varchar(32) NOT NULL DEFAULT 'private',
  "owner_login" varchar(255) NOT NULL DEFAULT '',
  "created_at" datetime NOT NULL,
  "project_id" bigint NOT NULL REFERENCES "projects_project" ("id") ON DELETE CASCADE,
  CONSTRAINT "projects_single_repository_per_project" UNIQUE ("project_id")
)
;
CREATE TABLE IF NOT EXISTS "projects_sprint" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  "number" integer unsigned NOT NULL CHECK ("number" >= 0),
  "name" varchar(255) NOT NULL,
  "status" varchar(16) NOT NULL DEFAULT 'active',
  "review_text" text NOT NULL DEFAULT '',
  "summary" text NOT NULL DEFAULT '{}',
  "started_at" datetime NOT NULL,
  "ended_at" datetime NULL,
  "created_at" datetime NOT NULL,
  "updated_at" datetime NOT NULL,
  "project_id" bigint NOT NULL REFERENCES "projects_project" ("id") ON DELETE CASCADE
)
;
CREATE TABLE IF NOT EXISTS "projects_bugreport" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  "title" varchar(255) NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "status" varchar(24) NOT NULL DEFAULT 'open',
  "closed_at" datetime NULL,
  "created_at" datetime NOT NULL,
  "updated_at" datetime NOT NULL,
  "reporter_id" integer NOT NULL REFERENCES "auth_user" ("id") ON DELETE CASCADE,
  "project_id" bigint NOT NULL REFERENCES "projects_project" ("id") ON DELETE CASCADE,
  "resolution_task_id" bigint NULL REFERENCES "projects_task" ("id") ON DELETE SET NULL,
  "priority" varchar(16) NOT NULL DEFAULT 'medium'
)
;
CREATE TABLE IF NOT EXISTS "projects_task" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  "title" varchar(255) NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "status" varchar(24) NOT NULL DEFAULT 'todo',
  "branch_name" varchar(255) NOT NULL DEFAULT '',
  "branch_url" varchar(200) NOT NULL DEFAULT '',
  "created_at" datetime NOT NULL,
  "updated_at" datetime NOT NULL,
  "branch_repository_id" bigint NULL REFERENCES "projects_projectrepository" ("id") ON DELETE SET NULL,
  "bug_report_id" bigint NULL REFERENCES "projects_bugreport" ("id") ON DELETE SET NULL,
  "creator_id" integer NOT NULL REFERENCES "auth_user" ("id") ON DELETE CASCADE,
  "project_id" bigint NOT NULL REFERENCES "projects_project" ("id") ON DELETE CASCADE,
  "priority" varchar(16) NOT NULL DEFAULT 'medium',
  "sprint_id" bigint NULL REFERENCES "projects_sprint" ("id") ON DELETE SET NULL
)
;
CREATE TABLE IF NOT EXISTS "projects_task_assignees" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  "task_id" bigint NOT NULL REFERENCES "projects_task" ("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "auth_user" ("id") ON DELETE CASCADE
)
;
CREATE TABLE IF NOT EXISTS "projects_githubissuelink" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  "repository_full_name" varchar(255) NOT NULL,
  "issue_number" integer unsigned NOT NULL CHECK ("issue_number" >= 0),
  "title" varchar(255) NOT NULL DEFAULT '',
  "html_url" varchar(200) NOT NULL,
  "state" varchar(32) NOT NULL DEFAULT 'open',
  "created_at" datetime NOT NULL,
  "bug_report_id" bigint NULL REFERENCES "projects_bugreport" ("id") ON DELETE CASCADE,
  "created_by_id" integer NULL REFERENCES "auth_user" ("id") ON DELETE SET NULL,
  "project_id" bigint NOT NULL REFERENCES "projects_project" ("id") ON DELETE CASCADE,
  "task_id" bigint NULL REFERENCES "projects_task" ("id") ON DELETE CASCADE
)
;
CREATE TABLE IF NOT EXISTS "projects_taskcomment" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  "body" text NOT NULL,
  "created_at" datetime NOT NULL,
  "updated_at" datetime NOT NULL,
  "author_id" integer NOT NULL REFERENCES "auth_user" ("id") ON DELETE CASCADE,
  "task_id" bigint NOT NULL REFERENCES "projects_task" ("id") ON DELETE CASCADE,
  "anchor_id" varchar(64) NOT NULL DEFAULT '',
  "anchor_label" varchar(255) NOT NULL DEFAULT '',
  "anchor_type" varchar(32) NOT NULL DEFAULT ''
)
;
CREATE TABLE IF NOT EXISTS "projects_bugcomment" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  "body" text NOT NULL,
  "created_at" datetime NOT NULL,
  "updated_at" datetime NOT NULL,
  "author_id" integer NOT NULL REFERENCES "auth_user" ("id") ON DELETE CASCADE,
  "bug_report_id" bigint NOT NULL REFERENCES "projects_bugreport" ("id") ON DELETE CASCADE,
  "anchor_id" varchar(64) NOT NULL DEFAULT '',
  "anchor_label" varchar(255) NOT NULL DEFAULT '',
  "anchor_type" varchar(32) NOT NULL DEFAULT ''
)
;
CREATE TABLE IF NOT EXISTS "projects_taskcommentreaction" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  "emoji" varchar(8) NOT NULL,
  "created_at" datetime NOT NULL,
  "updated_at" datetime NOT NULL,
  "comment_id" bigint NOT NULL REFERENCES "projects_taskcomment" ("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "auth_user" ("id") ON DELETE CASCADE
)
;
CREATE TABLE IF NOT EXISTS "projects_bugcommentreaction" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  "emoji" varchar(8) NOT NULL,
  "created_at" datetime NOT NULL,
  "updated_at" datetime NOT NULL,
  "comment_id" bigint NOT NULL REFERENCES "projects_bugcomment" ("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "auth_user" ("id") ON DELETE CASCADE
)
;
CREATE TABLE IF NOT EXISTS "projects_activity" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  "action" varchar(64) NOT NULL,
  "description" text NOT NULL,
  "metadata" text NOT NULL DEFAULT '{}',
  "created_at" datetime NOT NULL,
  "actor_id" integer NULL REFERENCES "auth_user" ("id") ON DELETE SET NULL,
  "bug_report_id" bigint NULL REFERENCES "projects_bugreport" ("id") ON DELETE CASCADE,
  "project_id" bigint NOT NULL REFERENCES "projects_project" ("id") ON DELETE CASCADE,
  "task_id" bigint NULL REFERENCES "projects_task" ("id") ON DELETE CASCADE
)
;
CREATE TABLE IF NOT EXISTS "projects_notification" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  "kind" varchar(24) NOT NULL DEFAULT 'system',
  "message" varchar(255) NOT NULL,
  "is_read" bool NOT NULL DEFAULT 0,
  "created_at" datetime NOT NULL,
  "actor_id" integer NULL REFERENCES "auth_user" ("id") ON DELETE SET NULL,
  "bug_report_id" bigint NULL REFERENCES "projects_bugreport" ("id") ON DELETE CASCADE,
  "recipient_id" integer NOT NULL REFERENCES "auth_user" ("id") ON DELETE CASCADE,
  "project_id" bigint NULL REFERENCES "projects_project" ("id") ON DELETE CASCADE,
  "task_id" bigint NULL REFERENCES "projects_task" ("id") ON DELETE CASCADE,
  "metadata" text NOT NULL DEFAULT '{}',
  "organization_id" bigint NULL REFERENCES "projects_organization" ("id") ON DELETE CASCADE,
  "is_closed" bool NOT NULL DEFAULT 0
)
;
CREATE UNIQUE INDEX IF NOT EXISTS "projects_single_personal_organization_per_owner" ON "projects_organization" ("owner_id") WHERE "is_personal"
;
CREATE UNIQUE INDEX IF NOT EXISTS "projects_organizationmembership_organization_id_user_id_f43f6876_uniq" ON "projects_organizationmembership" ("organization_id", "user_id")
;
CREATE UNIQUE INDEX IF NOT EXISTS "projects_projectmembership_project_id_user_id_7d57450d_uniq" ON "projects_projectmembership" ("project_id", "user_id")
;
CREATE UNIQUE INDEX IF NOT EXISTS "projects_sprint_project_id_number_856c441f_uniq" ON "projects_sprint" ("project_id", "number")
;
CREATE UNIQUE INDEX IF NOT EXISTS "projects_task_assignees_task_id_user_id_97db5327_uniq" ON "projects_task_assignees" ("task_id", "user_id")
;
CREATE UNIQUE INDEX IF NOT EXISTS "projects_taskcommentreaction_comment_id_user_id_aaed23a0_uniq" ON "projects_taskcommentreaction" ("comment_id", "user_id")
;
CREATE UNIQUE INDEX IF NOT EXISTS "projects_bugcommentreaction_comment_id_user_id_44ea7696_uniq" ON "projects_bugcommentreaction" ("comment_id", "user_id")
""";
}

public sealed class AuthService(AppConfig config)
{
    private const string AccessTokenType = "access";
    private const string RefreshTokenType = "refresh";

    public string CreateAccessToken(long userId) => CreateToken(userId, AccessTokenType, config.AccessTokenLifetimeSeconds);

    public string CreateRefreshToken(long userId) => CreateToken(userId, RefreshTokenType, config.RefreshTokenLifetimeSeconds);

    public AuthTokenPayload DecodeAccessToken(string token) => DecodeToken(token, AccessTokenType);

    public AuthTokenPayload DecodeRefreshToken(string token) => DecodeToken(token, RefreshTokenType);

    public void SetAuthCookies(HttpResponse response, long userId)
    {
        SetCookie(response, config.AuthAccessCookieName, CreateAccessToken(userId), config.AccessTokenLifetimeSeconds);
        SetCookie(response, config.AuthRefreshCookieName, CreateRefreshToken(userId), config.RefreshTokenLifetimeSeconds);
        response.Headers.CacheControl = "no-store";
    }

    public void SetAccessCookie(HttpResponse response, long userId)
    {
        SetCookie(response, config.AuthAccessCookieName, CreateAccessToken(userId), config.AccessTokenLifetimeSeconds);
    }

    public void ClearAuthCookies(HttpResponse response)
    {
        var options = DeleteCookieOptions();
        response.Cookies.Delete(config.AuthAccessCookieName, options);
        response.Cookies.Delete(config.AuthRefreshCookieName, options);
    }

    public bool ShouldRotate(AuthTokenPayload payload)
    {
        var remaining = payload.Exp - DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        return remaining <= config.AccessTokenRotationLeewaySeconds;
    }

    private string CreateToken(long userId, string tokenType, int lifetimeSeconds)
    {
        var now = DateTimeOffset.UtcNow;
        var header = Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(new Dictionary<string, string>
        {
            ["alg"] = "HS256",
            ["typ"] = "JWT",
        }));
        var payload = Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(new Dictionary<string, object>
        {
            ["sub"] = userId.ToString(CultureInfo.InvariantCulture),
            ["type"] = tokenType,
            ["jti"] = Base64UrlEncode(RandomNumberGenerator.GetBytes(16)),
            ["iat"] = now.ToUnixTimeSeconds(),
            ["exp"] = now.AddSeconds(lifetimeSeconds).ToUnixTimeSeconds(),
        }));
        var signature = Sign($"{header}.{payload}");
        return $"{header}.{payload}.{signature}";
    }

    private AuthTokenPayload DecodeToken(string token, string expectedType)
    {
        var parts = token.Split('.');
        if (parts.Length != 3)
        {
            throw new InvalidOperationException("Malformed token.");
        }

        var expectedSignature = Sign($"{parts[0]}.{parts[1]}");
        if (!CryptographicOperations.FixedTimeEquals(Base64UrlDecode(expectedSignature), Base64UrlDecode(parts[2])))
        {
            throw new InvalidOperationException("Invalid token signature.");
        }

        var payload = JsonSerializer.Deserialize<JsonObject>(Base64UrlDecode(parts[1])) ?? throw new InvalidOperationException("Invalid token payload.");
        var type = payload.Value<string>("type");
        if (!string.Equals(type, expectedType, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Unexpected token type.");
        }

        var exp = payload.Value<long?>("exp") ?? 0;
        if (exp <= DateTimeOffset.UtcNow.ToUnixTimeSeconds())
        {
            throw new InvalidOperationException("Token expired.");
        }

        var sub = payload.Value<string>("sub") ?? throw new InvalidOperationException("Token subject missing.");
        return new AuthTokenPayload(long.Parse(sub, CultureInfo.InvariantCulture), type!, exp);
    }

    private string Sign(string value)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(config.SecretKey));
        return Base64UrlEncode(hmac.ComputeHash(Encoding.ASCII.GetBytes(value)));
    }

    private void SetCookie(HttpResponse response, string name, string value, int maxAgeSeconds)
    {
        response.Cookies.Append(name, value, new CookieOptions
        {
            HttpOnly = true,
            Secure = config.AuthCookieSecure,
            SameSite = config.AuthCookieSameSite,
            Path = config.AuthCookiePath,
            Domain = config.AuthCookieDomain,
            MaxAge = TimeSpan.FromSeconds(maxAgeSeconds),
        });
    }

    private CookieOptions DeleteCookieOptions() => new()
    {
        Path = config.AuthCookiePath,
        Domain = config.AuthCookieDomain,
    };

    public static string Base64UrlEncode(byte[] value) => Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static byte[] Base64UrlDecode(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + ((4 - padded.Length % 4) % 4), '=');
        return Convert.FromBase64String(padded);
    }
}

public sealed record AuthTokenPayload(long UserId, string Type, long Exp);

public static class PasswordHasher
{
    private const int DjangoIterations = 1_200_000;

    public static string Hash(string password)
    {
        var salt = RandomToken(22);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, Encoding.UTF8.GetBytes(salt), DjangoIterations, HashAlgorithmName.SHA256, 32);
        return $"pbkdf2_sha256${DjangoIterations}${salt}${Convert.ToBase64String(hash)}";
    }

    public static bool Verify(string password, string encoded)
    {
        var parts = encoded.Split('$');
        if (parts.Length != 4 || parts[0] != "pbkdf2_sha256" || !int.TryParse(parts[1], out var iterations))
        {
            return false;
        }

        var actual = Rfc2898DeriveBytes.Pbkdf2(password, Encoding.UTF8.GetBytes(parts[2]), iterations, HashAlgorithmName.SHA256, 32);
        var expected = Convert.FromBase64String(parts[3]);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }

    private static string RandomToken(int length)
    {
        const string alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        var bytes = RandomNumberGenerator.GetBytes(length);
        return new string(bytes.Select(x => alphabet[x % alphabet.Length]).ToArray());
    }
}

public sealed class GitHubClient(HttpClient httpClient, AppConfig config)
{
    private const string ApiBase = "https://api.github.com";
    private const string AuthBase = "https://github.com/login/oauth";

    public string BuildAuthorizationUrl(string state)
    {
        if (string.IsNullOrWhiteSpace(config.GitHubClientId))
        {
            throw new GitHubApiException("GitHub OAuth is not configured on the backend.", 503);
        }

        var query = new Dictionary<string, string?>
        {
            ["client_id"] = config.GitHubClientId,
            ["redirect_uri"] = config.GitHubOAuthRedirectUri,
            ["scope"] = "read:user repo",
            ["state"] = state,
            ["allow_signup"] = "true",
        };
        return $"{AuthBase}/authorize?{ToQueryString(query)}";
    }

    public async Task<string> ExchangeCodeForAccessTokenAsync(string code)
    {
        if (string.IsNullOrWhiteSpace(config.GitHubClientId) || string.IsNullOrWhiteSpace(config.GitHubClientSecret))
        {
            throw new GitHubApiException("GitHub OAuth is not configured on the backend.", 503);
        }

        var payload = await RequestJsonAsync<JsonObject>($"{AuthBase}/access_token", HttpMethod.Post, form: new Dictionary<string, string>
        {
            ["client_id"] = config.GitHubClientId,
            ["client_secret"] = config.GitHubClientSecret,
            ["code"] = code,
            ["redirect_uri"] = config.GitHubOAuthRedirectUri,
        });
        return payload.Value<string>("access_token")
            ?? throw new GitHubApiException(payload.Value<string>("error_description") ?? "GitHub did not return an access token.", 502);
    }

    public Task<JsonObject> GetUserAsync(string token) => RequestJsonAsync<JsonObject>($"{ApiBase}/user", HttpMethod.Get, token: token);

    public async Task<List<JsonObject>> GetRepositoriesAsync(string token)
    {
        var array = await RequestJsonAsync<JsonArray>($"{ApiBase}/user/repos?per_page=100&sort=updated", HttpMethod.Get, token: token);
        return array.OfType<JsonObject>().ToList();
    }

    public async Task<List<JsonObject>> GetRepositoryIssuesAsync(string token, string repositoryFullName, string state = "open")
    {
        var array = await RequestJsonAsync<JsonArray>($"{ApiBase}/repos/{repositoryFullName}/issues?per_page=100&state={Uri.EscapeDataString(state)}&sort=updated", HttpMethod.Get, token: token);
        return array.OfType<JsonObject>().ToList();
    }

    public Task<JsonObject> GetIssueAsync(string token, string repositoryFullName, long issueNumber)
    {
        return RequestJsonAsync<JsonObject>($"{ApiBase}/repos/{repositoryFullName}/issues/{issueNumber}", HttpMethod.Get, token: token);
    }

    public Task<JsonObject> CloseIssueAsync(string token, string repositoryFullName, long issueNumber)
    {
        return RequestJsonAsync<JsonObject>($"{ApiBase}/repos/{repositoryFullName}/issues/{issueNumber}", HttpMethod.Patch, token: token, json: new JsonObject { ["state"] = "closed" });
    }

    public async Task<string> CreateRepositoryBranchAsync(string token, string repositoryFullName, string baseBranch, string branchName)
    {
        var branchRef = await RequestJsonAsync<JsonObject>($"{ApiBase}/repos/{repositoryFullName}/git/ref/heads/{Uri.EscapeDataString(baseBranch)}", HttpMethod.Get, token: token);
        var branchSha = branchRef["object"]?.AsObject().Value<string>("sha") ?? "";
        if (string.IsNullOrWhiteSpace(branchSha))
        {
            throw new GitHubApiException("GitHub did not return a base branch SHA.", 502);
        }

        await RequestJsonAsync<JsonObject>($"{ApiBase}/repos/{repositoryFullName}/git/refs", HttpMethod.Post, token: token, json: new JsonObject
        {
            ["ref"] = $"refs/heads/{branchName}",
            ["sha"] = branchSha,
        });
        return $"https://github.com/{repositoryFullName}/tree/{branchName}";
    }

    private async Task<T> RequestJsonAsync<T>(string url, HttpMethod method, string? token = null, Dictionary<string, string>? form = null, JsonObject? json = null)
    {
        var maxAttempts = string.IsNullOrWhiteSpace(token) ? 1 : 4;
        for (var attempt = 0; attempt < maxAttempts; attempt++)
        {
            using var request = new HttpRequestMessage(method, url);
            request.Headers.Accept.ParseAdd("application/json");
            request.Headers.UserAgent.ParseAdd("team-project-manager");
            if (!string.IsNullOrWhiteSpace(token))
            {
                request.Headers.Authorization = new("Bearer", token);
                request.Headers.Add("X-GitHub-Api-Version", "2022-11-28");
            }

            if (form is not null)
            {
                request.Content = new FormUrlEncodedContent(form);
            }
            else if (json is not null)
            {
                request.Content = new StringContent(json.ToJsonString(), Encoding.UTF8, "application/json");
            }

            try
            {
                using var response = await httpClient.SendAsync(request);
                var text = await response.Content.ReadAsStringAsync();
                if (response.IsSuccessStatusCode)
                {
                    return string.IsNullOrWhiteSpace(text)
                        ? JsonSerializer.Deserialize<T>("{}")!
                        : JsonSerializer.Deserialize<T>(text)!;
                }

                var message = ParseGitHubError(text) ?? response.ReasonPhrase ?? "GitHub request failed.";
                if (!string.IsNullOrWhiteSpace(token) && response.StatusCode == HttpStatusCode.Unauthorized && message == "Bad credentials" && attempt < maxAttempts - 1)
                {
                    await Task.Delay(TimeSpan.FromMilliseconds(400 * (attempt + 1)));
                    continue;
                }

                throw new GitHubApiException(message, (int)response.StatusCode);
            }
            catch (HttpRequestException ex)
            {
                throw new GitHubApiException("Unable to reach GitHub. Check your network connection and OAuth app settings.", 502, ex);
            }
        }

        throw new GitHubApiException("GitHub request failed.", 502);
    }

    private static string? ParseGitHubError(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        try
        {
            var payload = JsonNode.Parse(text)?.AsObject();
            return payload?.Value<string>("error_description") ?? payload?.Value<string>("message");
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string ToQueryString(Dictionary<string, string?> values)
    {
        return string.Join('&', values.Where(kv => kv.Value is not null).Select(kv => $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value!)}"));
    }
}

public sealed class GitHubApiException(string message, int statusCode = 502, Exception? innerException = null) : Exception(message, innerException)
{
    public int StatusCode { get; } = statusCode;
}

public static class ApiHelpers
{
    public static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static IResult JsonError(string message, int status = StatusCodes.Status400BadRequest)
    {
        return Results.Json(new { error = message }, statusCode: status);
    }

    public static async Task<(JsonObject? Payload, IResult? Error)> ReadJsonBodyAsync(HttpContext context)
    {
        if (context.Request.ContentLength == 0)
        {
            return (new JsonObject(), null);
        }

        try
        {
            var payload = await JsonSerializer.DeserializeAsync<JsonObject>(context.Request.Body, JsonOptions);
            return (payload ?? new JsonObject(), null);
        }
        catch (JsonException)
        {
            return (null, JsonError("Invalid JSON payload."));
        }
    }

    public static async Task<IResult> WithUserAsync(HttpContext context, AppDb db, AuthService auth, Func<User, Task<IResult>> handler)
    {
        await using var connection = db.Open();
        var accessToken = ExtractAccessToken(context);
        AuthTokenPayload? payload = null;
        long? userId = null;
        var usingCookieAuth = context.Request.Cookies.ContainsKey(EnvAuth.AccessCookieName(context)) || context.Request.Cookies.ContainsKey(EnvAuth.RefreshCookieName(context));
        var rotateAccessCookie = false;

        if (!string.IsNullOrWhiteSpace(accessToken))
        {
            try
            {
                payload = auth.DecodeAccessToken(accessToken);
                userId = payload.UserId;
                rotateAccessCookie = usingCookieAuth && auth.ShouldRotate(payload);
            }
            catch
            {
                payload = null;
            }
        }

        if (userId is null)
        {
            var refreshToken = ExtractRefreshToken(context);
            if (string.IsNullOrWhiteSpace(refreshToken))
            {
                auth.ClearAuthCookies(context.Response);
                return JsonError(!string.IsNullOrWhiteSpace(accessToken) ? "Invalid or expired token." : "Authentication required.", StatusCodes.Status401Unauthorized);
            }

            try
            {
                payload = auth.DecodeRefreshToken(refreshToken);
                userId = payload.UserId;
                rotateAccessCookie = usingCookieAuth;
            }
            catch
            {
                auth.ClearAuthCookies(context.Response);
                return JsonError("Invalid or expired token.", StatusCodes.Status401Unauthorized);
            }
        }

        var user = await connection.QueryFirstOrDefaultAsync<User>("select * from auth_user where id = @Id", new { Id = userId.Value });
        if (user is null)
        {
            auth.ClearAuthCookies(context.Response);
            return JsonError("User not found.", StatusCodes.Status401Unauthorized);
        }

        var result = await handler(user);
        if (rotateAccessCookie)
        {
            auth.SetAccessCookie(context.Response, user.Id);
        }

        return result;
    }

    private static string ExtractAccessToken(HttpContext context)
    {
        var cookie = context.Request.Cookies[EnvAuth.AccessCookieName(context)]?.Trim();
        if (!string.IsNullOrWhiteSpace(cookie))
        {
            return cookie;
        }

        var header = context.Request.Headers.Authorization.ToString();
        return header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? header["Bearer ".Length..].Trim()
            : "";
    }

    private static string ExtractRefreshToken(HttpContext context) => context.Request.Cookies[EnvAuth.RefreshCookieName(context)]?.Trim() ?? "";

    public static string NowSql() => DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss.ffffff", CultureInfo.InvariantCulture);

    public static string Iso(DateTime value) => value.ToString("O", CultureInfo.InvariantCulture);

    public static string? Iso(DateTime? value) => value is null ? null : Iso(value.Value);

    public static object JsonObjectFromText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return new Dictionary<string, object?>();
        }

        try
        {
            return JsonNode.Parse(text)?.Deserialize<object>(JsonOptions) ?? new Dictionary<string, object?>();
        }
        catch (JsonException)
        {
            return new Dictionary<string, object?>();
        }
    }

    public static string ToJsonText(object value) => JsonSerializer.Serialize(value, JsonOptions);

    public static string Slugify(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder();
        foreach (var c in normalized)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(c);
            if (category == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            builder.Append(char.IsLetterOrDigit(c) ? char.ToLowerInvariant(c) : '-');
        }

        return Regex.Replace(builder.ToString(), "-{2,}", "-").Trim('-');
    }

    private static class EnvAuth
    {
        public static string AccessCookieName(HttpContext context) => context.RequestServices.GetRequiredService<AppConfig>().AuthAccessCookieName;

        public static string RefreshCookieName(HttpContext context) => context.RequestServices.GetRequiredService<AppConfig>().AuthRefreshCookieName;
    }
}

public static class JsonNodeExtensions
{
    public static T? Value<T>(this JsonObject payload, string key)
    {
        if (!payload.TryGetPropertyValue(key, out var node) || node is null)
        {
            return default;
        }

        try
        {
            return node.Deserialize<T>(ApiHelpers.JsonOptions);
        }
        catch (JsonException)
        {
            return default;
        }
    }
}

public sealed class User
{
    public long Id { get; set; }
    public string Password { get; set; } = "";
    public DateTime? LastLogin { get; set; }
    public bool IsSuperuser { get; set; }
    public string Username { get; set; } = "";
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Email { get; set; } = "";
    public bool IsStaff { get; set; }
    public bool IsActive { get; set; }
    public DateTime DateJoined { get; set; }
}

public sealed class UserProfile
{
    public long Id { get; set; }
    public string? GithubUserId { get; set; }
    public string GithubUsername { get; set; } = "";
    public string GithubAvatarUrl { get; set; } = "";
    public string GithubAccessToken { get; set; } = "";
    public DateTime? GithubConnectedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public long UserId { get; set; }
}

public sealed class Organization
{
    public long Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public bool IsPersonal { get; set; }
    public long OwnerId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class OrganizationMembership
{
    public long Id { get; set; }
    public long OrganizationId { get; set; }
    public long UserId { get; set; }
    public string Role { get; set; } = "member";
    public string Status { get; set; } = "active";
    public long? InvitedById { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class Project
{
    public long Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public bool UseSprints { get; set; }
    public long? OrganizationId { get; set; }
    public long OwnerId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class Sprint
{
    public long Id { get; set; }
    public long ProjectId { get; set; }
    public long Number { get; set; }
    public string Name { get; set; } = "";
    public string Status { get; set; } = "active";
    public string ReviewText { get; set; } = "";
    public string Summary { get; set; } = "{}";
    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class ProjectMembership
{
    public long Id { get; set; }
    public long ProjectId { get; set; }
    public long UserId { get; set; }
    public string Role { get; set; } = "member";
    public string Status { get; set; } = "active";
    public long? AddedById { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class ProjectRepository
{
    public long Id { get; set; }
    public long ProjectId { get; set; }
    public string GithubRepoId { get; set; } = "";
    public string Name { get; set; } = "";
    public string FullName { get; set; } = "";
    public string HtmlUrl { get; set; } = "";
    public string DefaultBranch { get; set; } = "main";
    public string Visibility { get; set; } = "private";
    public string OwnerLogin { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public sealed class BugReport
{
    public long Id { get; set; }
    public long ProjectId { get; set; }
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public long ReporterId { get; set; }
    public string Status { get; set; } = "open";
    public string Priority { get; set; } = "medium";
    public long? ResolutionTaskId { get; set; }
    public DateTime? ClosedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class TaskItem
{
    public long Id { get; set; }
    public long ProjectId { get; set; }
    public long? BugReportId { get; set; }
    public long? SprintId { get; set; }
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Status { get; set; } = "todo";
    public string Priority { get; set; } = "medium";
    public long CreatorId { get; set; }
    public string BranchName { get; set; } = "";
    public string BranchUrl { get; set; } = "";
    public long? BranchRepositoryId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class GitHubIssueLink
{
    public long Id { get; set; }
    public long ProjectId { get; set; }
    public long? TaskId { get; set; }
    public long? BugReportId { get; set; }
    public string RepositoryFullName { get; set; } = "";
    public long IssueNumber { get; set; }
    public string Title { get; set; } = "";
    public string HtmlUrl { get; set; } = "";
    public string State { get; set; } = "open";
    public long? CreatedById { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class TaskComment
{
    public long Id { get; set; }
    public long TaskId { get; set; }
    public long AuthorId { get; set; }
    public string Body { get; set; } = "";
    public string AnchorType { get; set; } = "";
    public string AnchorId { get; set; } = "";
    public string AnchorLabel { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class BugComment
{
    public long Id { get; set; }
    public long BugReportId { get; set; }
    public long AuthorId { get; set; }
    public string Body { get; set; } = "";
    public string AnchorType { get; set; } = "";
    public string AnchorId { get; set; } = "";
    public string AnchorLabel { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class CommentReaction
{
    public long Id { get; set; }
    public long CommentId { get; set; }
    public long UserId { get; set; }
    public string Emoji { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class Activity
{
    public long Id { get; set; }
    public long ProjectId { get; set; }
    public long? ActorId { get; set; }
    public long? TaskId { get; set; }
    public long? BugReportId { get; set; }
    public string Action { get; set; } = "";
    public string Description { get; set; } = "";
    public string Metadata { get; set; } = "{}";
    public DateTime CreatedAt { get; set; }
}

public sealed class Notification
{
    public long Id { get; set; }
    public long RecipientId { get; set; }
    public long? ActorId { get; set; }
    public long? OrganizationId { get; set; }
    public long? ProjectId { get; set; }
    public long? TaskId { get; set; }
    public long? BugReportId { get; set; }
    public string Kind { get; set; } = "system";
    public string Message { get; set; } = "";
    public string Metadata { get; set; } = "{}";
    public bool IsRead { get; set; }
    public bool IsClosed { get; set; }
    public DateTime CreatedAt { get; set; }
}
