import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import avatars, diagnostics, dograh, health, sessions
from app.api.routes import settings as settings_routes
from app.config import get_settings
from app.models.db import db
from app.services.avatar_service import avatar_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("kiosk")


@asynccontextmanager
async def lifespan(_: FastAPI):
    cfg = get_settings()
    avatar_service.ensure_dirs()
    Path(cfg.database_path).parent.mkdir(parents=True, exist_ok=True)
    await db.init()
    logger.info("Kiosk backend ready (avatar_engine=%s)", cfg.avatar_engine)
    yield


app = FastAPI(
    title="AI Digital Human Kiosk",
    version="1.0.0",
    lifespan=lifespan,
)

cfg = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=cfg.cors_origin_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(dograh.router)
app.include_router(avatars.router)
app.include_router(sessions.router)
app.include_router(settings_routes.router)
app.include_router(diagnostics.router)

# Serve uploaded assets when path is absolute under avatar_data
uploads = cfg.uploads_dir
uploads.mkdir(parents=True, exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory=str(uploads)), name="uploads")
