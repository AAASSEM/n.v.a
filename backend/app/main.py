import os
import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

print("=" * 60, flush=True)
print("ESG Compass Backend - Starting up...", flush=True)
print(f"Python: {sys.version}", flush=True)
print(f"PORT: {os.environ.get('PORT', 'not set')}", flush=True)
print(f"ENVIRONMENT: {os.environ.get('ENVIRONMENT', 'not set')}", flush=True)
print(f"DATABASE_URL set: {bool(os.environ.get('DATABASE_URL'))}", flush=True)
print("=" * 60, flush=True)

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.api import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# CORS
origins = list(set(settings.BACKEND_CORS_ORIGINS or []))
if not origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auto-run database migrations on startup ─────────────────────────────
@app.on_event("startup")
async def run_migrations():
    """
    Automatically runs Alembic migrations on every startup.
    Safe to run repeatedly — Alembic only applies pending migrations.
    """
    print("[MIGRATE] Running database migrations...", flush=True)
    try:
        from alembic.config import Config
        from alembic import command
        import asyncio

        def _run_alembic():
            alembic_cfg = Config("alembic.ini")
            # Build synchronous URL from the async one
            db_uri = settings.SQLALCHEMY_DATABASE_URI
            if "+asyncpg" in db_uri:
                sync_url = db_uri.replace("+asyncpg", "")
            elif "+aiosqlite" in db_uri:
                sync_url = db_uri.replace("+aiosqlite", "")
            else:
                sync_url = db_uri

            # Fix SSL param: asyncpg uses 'ssl=require', psycopg2 uses 'sslmode=require'
            sync_url = sync_url.replace("ssl=require", "sslmode=require")
            sync_url = sync_url.replace("ssl=true", "sslmode=require")
            
            # psycopg2 doesn't understand pgbouncer=true, so we strip it
            sync_url = sync_url.replace("?pgbouncer=true", "")
            sync_url = sync_url.replace("&pgbouncer=true", "")

            print(f"[MIGRATE] Using sync URL: {sync_url[:50]}...", flush=True)
            alembic_cfg.set_main_option("sqlalchemy.url", sync_url)
            command.upgrade(alembic_cfg, "head")

        # Run in thread to not block the async event loop
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _run_alembic)
        print("[MIGRATE] Database migrations complete!", flush=True)
    except Exception as e:
        # Don't crash the app if migrations fail — log and continue
        print(f"[MIGRATE] WARNING: Migration error: {e}", flush=True)
        logger.error(f"Migration error: {e}")

# ── Routes ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT
    }

@app.get("/")
async def root():
    return {"message": "ESG Compass API is running", "docs": "/docs"}

app.include_router(api_router, prefix=settings.API_V1_STR)

# Uploads directory
os.makedirs("uploads", exist_ok=True)
try:
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
except Exception as e:
    logger.warning(f"Uploads mount warning: {e}")

print("[OK] Application startup complete!", flush=True)
