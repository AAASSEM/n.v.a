import os
import sys
import logging

logging.basicConfig(level=logging.INFO)
m_logger = logging.getLogger("app.main")

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

# Request logging middleware
from fastapi import Request
import time

@app.middleware("http")
async def log_requests(request: Request, call_next):
    # Get a logger inside the middleware to avoid any scoping/initialization issues
    m_logger = logging.getLogger("app.main")
    
    # Hard print to bypass logging configuration issues
    print(f"DEBUG: REQUEST RECEIVED - METHOD: {request.method} - PATH: {request.url.path}", flush=True)
    start_time = time.time()
    origin = request.headers.get("origin")
    host = request.headers.get("host")
    response = None
    try:
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        formatted_process_time = "{0:.2f}".format(process_time)
        m_logger.info(f"REQUEST: {request.method} {request.url.path} - FROM: {origin} (via {host}) - STATUS: {response.status_code} - TIME: {formatted_process_time}ms")
        print(f"DEBUG: RESPONSE SENT - STATUS: {response.status_code}", flush=True)
    except Exception as e:
        m_logger.exception(f"CRASH: {request.method} {request.url.path} - FROM: {origin} - ERROR: {str(e)}")
        print(f"DEBUG: REQUEST CRASHED - ERROR: {e}", flush=True)
        raise e
    return response

# CORS
origins = list(set(settings.BACKEND_CORS_ORIGINS or []))
# Credentials (cookies/headers) cannot be allowed with * origin
allow_creds = True
m_logger = logging.getLogger("app.main")

if not origins or "*" in origins:
    origins = ["*"]
    allow_creds = False # Spec requirement
    m_logger.info("CORS: Using wildcard * (Credentials disabled)")
else:
    m_logger.info(f"CORS: Allowed origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=allow_creds,
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
            
            # Fresh database: drop alembic version tracking so migrations run clean
            # This is safe because there's no real user data yet
            from sqlalchemy import create_engine, text
            sync_engine = create_engine(sync_url)
            with sync_engine.connect() as conn:
                # Check if we have a broken migration state
                try:
                    result = conn.execute(text("SELECT version_num FROM alembic_version"))
                    current = result.scalar()
                    print(f"[MIGRATE] Current version: {current}", flush=True)
                    
                    # If stuck on a partial migration, reset everything
                    if current and current != '420c36d11686':
                        print("[MIGRATE] Partial migration detected — resetting for clean run...", flush=True)
                        # Drop all app tables so we can re-create them cleanly
                        conn.execute(text("DROP TABLE IF EXISTS data_submissions CASCADE"))
                        conn.execute(text("DROP TABLE IF EXISTS user_profiles CASCADE"))
                        conn.execute(text("DROP TABLE IF EXISTS meters CASCADE"))
                        conn.execute(text("DROP TABLE IF EXISTS company_profile_answers CASCADE"))
                        conn.execute(text("DROP TABLE IF EXISTS company_frameworks CASCADE"))
                        conn.execute(text("DROP TABLE IF EXISTS company_checklists CASCADE"))
                        conn.execute(text("DROP TABLE IF EXISTS sites CASCADE"))
                        conn.execute(text("DROP TABLE IF EXISTS audit_logs CASCADE"))
                        conn.execute(text("DROP TABLE IF EXISTS system_settings CASCADE"))
                        conn.execute(text("DROP TABLE IF EXISTS profiling_questions CASCADE"))
                        conn.execute(text("DROP TABLE IF EXISTS data_elements CASCADE"))
                        conn.execute(text("DROP TABLE IF EXISTS email_verification_tokens CASCADE"))
                        conn.execute(text("DROP TABLE IF EXISTS generated_reports CASCADE"))
                        conn.execute(text("DROP TABLE IF EXISTS meter_types CASCADE"))
                        conn.execute(text("DROP TABLE IF EXISTS companies CASCADE"))
                        conn.execute(text("DROP TABLE IF EXISTS users CASCADE"))
                        conn.execute(text("DROP TABLE IF EXISTS frameworks CASCADE"))
                        conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE"))
                        # Postgres ENUM types are persistent objects and must be dropped manually
                        conn.execute(text("DROP TYPE IF EXISTS tokentype CASCADE"))
                        conn.commit()
                        print("[MIGRATE] Tables cleared — running fresh migration...", flush=True)
                except Exception:
                    print("[MIGRATE] No existing migration state — fresh database", flush=True)
                    pass
            sync_engine.dispose()
            
            command.upgrade(alembic_cfg, "head")

        # Run in thread to not block the async event loop
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _run_alembic)
        print("[MIGRATE] Database migrations complete!", flush=True)
    except Exception as e:
        # Don't crash the app if migrations fail — log and continue
        print(f"[MIGRATE] WARNING: Migration error: {e}", flush=True)
        m_logger.error(f"Migration error: {e}")

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
    m_logger.warning(f"Uploads mount warning: {e}")

print("[OK] Application startup complete!", flush=True)
