# S-Clearance API

FastAPI backend for the S-Clearance Student Clearance Management System.

## Local run

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/api/health
- Local development uses SQLite by default and creates `mclears.db` plus `storage/`.

## Docker deployment

Docker configuration is defined at the repository root. From there, run:

```bash
docker compose up --build
```

The `scms-backend` container runs the API, `scms-frontend` serves the React application, and `scms-database` runs PostgreSQL. The backend is configured with a PostgreSQL connection to the `database` service and does not serve the SPA itself.

## Tests

```bash
pytest
```

Tests use a temporary SQLite database and storage directory.
