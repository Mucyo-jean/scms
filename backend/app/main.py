from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import (
    APP_ENV,
    AUTO_SEED,
    CORS_ORIGINS,
    FRONTEND_DIR,
    SERVE_FRONTEND,
    STORAGE_DIR,
)
from .database import Base, SessionLocal, engine
from .routers import admin, auth, catalog, dev, documents, notifications, public, requests
from .seed import seed_database


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    if AUTO_SEED:
        with SessionLocal() as db:
            seed_database(db)
    yield


def attach_frontend(app: FastAPI) -> bool:
    """Serve the built React app from the same origin as the API.

    The Docker image places the Vite build in `FRONTEND_DIR`, so a single
    container serves the UI and the REST API on one port: no CORS, no second
    deployment. Unknown paths fall back to `index.html` for the client-side
    router, while `/api/*` keeps returning JSON 404s.
    """
    index = FRONTEND_DIR / "index.html"
    if not SERVE_FRONTEND or not index.is_file():
        return False

    root = index.parent.resolve()
    assets = root / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        if full_path:
            candidate = (root / full_path).resolve()
            if root in candidate.parents and candidate.is_file():
                return FileResponse(candidate)
        return FileResponse(index)

    return True


app = FastAPI(
    title="S-Clearance API",
    description="Student Clearance Management System REST API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    auth.router,
    catalog.router,
    requests.router,
    documents.router,
    notifications.router,
    admin.router,
    public.router,
    dev.router,
):
    app.include_router(router, prefix="/api")


@app.get("/api/health", tags=["system"])
def health():
    return {"status": "ok", "env": APP_ENV}


# Registered last so the SPA fallback never shadows an API route.
serving_frontend = attach_frontend(app)

if not serving_frontend:

    @app.get("/", include_in_schema=False)
    def root():
        return {"name": "S-Clearance API", "docs": "/docs", "health": "/api/health"}
