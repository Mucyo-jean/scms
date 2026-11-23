"""Runtime configuration for the S-Clearance API.

Everything is read from environment variables so the same image can run in
development (SQLite) and production (PostgreSQL) without code changes.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{(BASE_DIR / 'mclears.db').as_posix()}")
# Heroku/Render style URLs still use the old scheme.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL[len("postgres://") :]
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL[len("postgresql://") :]

APP_ENV = os.getenv("APP_ENV", "development")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-insecure-secret-change-in-production")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "720"))
PBKDF2_ITERATIONS = int(os.getenv("PBKDF2_ITERATIONS", "600000"))

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173",
    ).split(",")
    if origin.strip()
]

STORAGE_DIR = Path(os.getenv("STORAGE_DIR", str(BASE_DIR / "storage")))

# Built React app (the Vite output from `npm run build` in the repository root's
# `frontend/`). The Docker image serves it so one container serves both the SPA and
# the API; local development leaves it absent and Vite's dev server handles the
# frontend instead.
FRONTEND_DIR = Path(os.getenv("FRONTEND_DIR", str(BASE_DIR.parent / "frontend" / "dist")))
SERVE_FRONTEND = _bool("SERVE_FRONTEND", True)

AUTO_SEED = _bool("AUTO_SEED", True)
IS_DEVELOPMENT = APP_ENV.lower() in {"development", "dev", "local"}

CURRENCY = "RWF"
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2 MB
MAX_FILES = 5
ALLOWED_FILE_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
}
CLEARANCE_REASONS = ["Graduation", "Transfer", "Withdrawal", "End of programme", "Deferral"]
