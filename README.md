# S-Clearance — Student Clearance Management System

S-Clearance is a React, FastAPI, and PostgreSQL application for managing the student-clearance workflow.

## Run with Docker

From the repository root:

```bash
docker compose up --build
```

This creates the `scms` Compose project and three separate containers:

| Container | Service | Address | Purpose |
|---|---|---|---|
| `scms-frontend` | `frontend` | http://localhost:5174 | nginx serves the React application and proxies `/api` |
| `scms-backend` | `backend` | http://localhost:8000 | FastAPI REST API and API documentation at `/docs` |
| `scms-database` | `database` | internal only | PostgreSQL 16 database |

The frontend talks to the backend through its nginx proxy, so no browser API URL needs to be configured. PostgreSQL data and uploaded documents are retained in the `scms_postgres_data` and `scms_backend_storage` named volumes.

Set a production secret before deployment:

```bash
SECRET_KEY="replace-with-a-long-random-value" POSTGRES_PASSWORD="replace-this-password" docker compose up --build
```

Use `docker compose down` to stop the stack. `docker compose down -v` also removes the database and upload volumes.

## Docker layout

```text
docker-compose.yml            SCMS services and persistent volumes
docker/
  Dockerfile.backend          FastAPI image
  Dockerfile.frontend         React build and nginx image
  nginx.conf                  SPA routing and backend proxy
backend/                      FastAPI application
frontend/                     React application
```

## Local development

Start the API from `backend/`:

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Then start the Vite frontend from `frontend/`:

```bash
npm install
npm run dev
```

The local frontend is available at http://localhost:5173 and proxies `/api` to port 8000.
