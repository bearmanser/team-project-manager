# Team Project Manager

Team Project Manager is a full-stack project management application for software teams. It combines organization and project workspaces, task and bug tracking, sprint support, team permissions, notifications, and GitHub integration in a single workflow.

Live demo: [https://www.grinderstudio.no/team-project-manager](https://www.grinderstudio.no/team-project-manager)

![Team Project Manager screenshot](./example-image.png)

## Highlights

- Organization and project workspaces
- Task boards with status and priority management
- Bug tracking with resolution links to tasks
- Optional sprint-based planning and sprint history
- Role-based memberships for organizations and projects
- Comments, reactions, mentions, and notifications
- GitHub OAuth, repository connection, issue linking, and branch creation

## Tech Stack

### Frontend

- React 19
- TypeScript
- Vite
- Chakra UI

### Backend

- Django 6
- Python 3.13
- SQLite
- Uvicorn / Gunicorn
- Docker

## Architecture

The repository is split into two applications:

- [`Frontend`](./Frontend): the browser client and user interface
- [`Backend`](./Backend): the Django API, business logic, persistence, and GitHub integration

The frontend communicates with the backend over JSON API endpoints under `/api/`. The backend stores application data in SQLite by default and exposes project event streaming for near real-time UI refreshes.

## Getting Started

### Prerequisites

- Node.js LTS and npm
- Python 3.13
- Git

### 1. Set up the backend

```bash
cd Backend
python -m venv .venv
```

Activate the virtual environment:

```powershell
.venv\Scripts\Activate.ps1
```

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a local environment file:

```bash
cp .env.example .env
```

Apply database migrations:

```bash
python manage.py migrate
```

Start the backend:

```bash
python manage.py runserver
```

The backend runs at `http://127.0.0.1:8000`.

### 2. Set up the frontend

```bash
cd Frontend
npm install
cp .env.example .env
```

Start the frontend:

```bash
npm run dev
```

The frontend runs at `http://127.0.0.1:5173`.

### 3. Open the app

With both services running:

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:8000/api/`

You can create an account locally through the application UI.

## Environment Configuration

### Frontend

The frontend reads its configuration from Vite environment variables.

| Variable | Purpose | Default local value |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Base URL for backend API requests | `http://127.0.0.1:8000` |
| `VITE_APP_BASE_PATH` | Base path for routing and deployment | `/` |

### Backend

The backend loads variables from [`Backend/.env.example`](./Backend/.env.example).

| Variable | Purpose |
| --- | --- |
| `DEBUG` | Enables Django debug mode |
| `SECRET_KEY` | Django secret key |
| `ALLOWED_HOSTS` | Allowed backend hostnames |
| `TIME_ZONE` | Application time zone |
| `SQLITE_PATH` | SQLite database file path |
| `FRONTEND_URL` | Frontend URL used for redirects |
| `FRONTEND_ORIGIN` | Primary frontend origin |
| `CORS_ALLOWED_ORIGINS` | Allowed browser origins for API access |
| `JWT_EXPIRATION_SECONDS` | JWT session lifetime |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `GITHUB_OAUTH_REDIRECT_URI` | OAuth callback URL |

## Optional GitHub Integration

GitHub integration is only required if you want to:

- connect GitHub accounts
- attach a repository to a project
- import GitHub issues as bugs
- create task branches from the app

For local development, configure the GitHub OAuth values in `Backend/.env` and use this callback URL:

`http://127.0.0.1:5173/oauth/github/callback`

## Docker

The backend includes a Dockerfile for containerized deployment.

Build the image:

```bash
docker build -t team-project-manager-api ./Backend
```

Run the container:

```bash
docker run --rm -p 8000:8000 --env-file Backend/.env -v team-project-manager-data:/data team-project-manager-api
```

The container entrypoint automatically runs migrations and collects static files before starting Gunicorn.

## Development Commands

### Frontend

```bash
npm run dev
npm run build
npm run lint
```

### Backend

```bash
python manage.py runserver
python manage.py migrate
python manage.py test
```

## Repository Layout

```text
team-project-manager/
|-- Backend/            Django API, models, auth, GitHub integration, Docker setup
|-- Frontend/           React application, routing, UI, API client
|-- example-image.png   Project screenshot
```

## Notes

- `.env` files are gitignored and should be created locally from the provided examples.
- The backend uses SQLite by default, which keeps local setup simple and self-contained.
- Production frontend and backend example env files are included for deployment reference.
