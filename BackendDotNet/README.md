# Team Project Manager .NET Backend

This is the ASP.NET Core replacement for the Django backend in `../Backend`.
It keeps the existing `/api/.../` JSON contract, cookie auth behavior, SQLite
schema, GitHub integration, project event stream, organizations, projects,
tasks, bugs, comments, reactions, notifications, sprint handling, and role
permissions.

The old Python backend is intentionally left in place. By default this service
uses `../Backend/db.sqlite3` when that file exists, so it can run against the
current Django data without a migration.

## Local Setup

```powershell
cd BackendDotNet
Copy-Item .env.example .env
dotnet restore
dotnet run --urls http://127.0.0.1:8000
```

Keep `SECRET_KEY` the same as the Django backend if you want existing auth
cookies to remain valid. Keep `SQLITE_PATH=../Backend/db.sqlite3` if you want
to reuse the existing database.

The frontend can continue using:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Verification

```powershell
dotnet build
```

The API bootstraps missing tables on startup, but it does not delete or rewrite
the Django backend directory. For isolated testing, point `SQLITE_PATH` at a
temporary `.sqlite3` file.

## Docker

From the repository root:

```powershell
docker build -t team-project-manager-api-dotnet -f BackendDotNet/Dockerfile .
docker run --rm -p 8000:8000 --env-file BackendDotNet/.env -v team-project-manager-data:/data team-project-manager-api-dotnet
```

For container data storage, set `SQLITE_PATH=/data/db.sqlite3` in the env file.
