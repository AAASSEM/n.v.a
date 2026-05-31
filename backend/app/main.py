import os
import sys
import logging

logging.basicConfig(level=logging.INFO)
m_logger = logging.getLogger("app.main")

print("=" * 60, flush=True)
print("ESGravty Backend - Starting up...", flush=True)
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
print(f"[CORS] Configured origins: {origins}", flush=True)
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
            db_uri = settings.SQLALCHEMY_DATABASE_URI
            if "+asyncpg" in db_uri:
                sync_url = db_uri.replace("+asyncpg", "")
            elif "+aiosqlite" in db_uri:
                sync_url = db_uri.replace("+aiosqlite", "")
            else:
                sync_url = db_uri

            sync_url = sync_url.replace("ssl=require", "sslmode=require")
            sync_url = sync_url.replace("ssl=true", "sslmode=require")
            sync_url = sync_url.replace("?pgbouncer=true", "")
            sync_url = sync_url.replace("&pgbouncer=true", "")

            print(f"[MIGRATE] Using sync URL: {sync_url[:50]}...", flush=True)
            alembic_cfg.set_main_option("sqlalchemy.url", sync_url)

            from sqlalchemy import create_engine, text
            sync_engine = create_engine(sync_url)
            with sync_engine.connect() as conn:
                try:
                    result = conn.execute(text("SELECT version_num FROM alembic_version"))
                    current = result.scalar()
                    print(f"[MIGRATE] Current version: {current}", flush=True)
                except Exception:
                    print("[MIGRATE] No existing migration state — fresh database", flush=True)
            sync_engine.dispose()

            command.upgrade(alembic_cfg, "head")

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _run_alembic)
        print("[MIGRATE] Database migrations complete!", flush=True)
        
        # Auto-seed if database is fresh
        print("[SEED] Checking if database needs seeding...", flush=True)
        try:
            from app.db.session import async_session
            from sqlalchemy.future import select
            from app.models.framework import Framework
            
            async with async_session() as db_session:
                res = await db_session.execute(select(Framework).limit(1))
                if not res.scalars().first():
                    print("[SEED] Fresh database detected. Running auto-seeding...", flush=True)
                    # 1. Create dev admin user
                    try:
                        from init_db_data import init_dev_user
                        await init_dev_user()
                    except Exception as e:
                        print(f"[SEED] WARNING: Failed to create dev admin user: {e}", flush=True)
                    
                    # 2. Seed frameworks & defaults
                    try:
                        from app.core.seed_data import SEED_DATA
                        from app.models.meter import MeterType
                        from app.models.profiling import ProfilingQuestion
                        from app.models.data_element import DataElement
                        
                        # frameworks
                        for f in SEED_DATA["fws"]:
                            db_session.add(Framework(**f))
                        # meters
                        for m in SEED_DATA["mts"]:
                            db_session.add(MeterType(**m))
                        # questions
                        for p in SEED_DATA["pqs"]:
                            db_session.add(ProfilingQuestion(**p))
                        # elements
                        for de in SEED_DATA["des"]:
                            de["is_metered"] = bool(de.get("is_metered", False))
                            db_session.add(DataElement(**de))
                            
                        await db_session.commit()
                        print("[SEED] Default system library seeded.", flush=True)
                    except Exception as e:
                        print(f"[SEED] WARNING: Failed to seed system defaults: {e}", flush=True)
                        await db_session.rollback()
                    
                    # 3. Seed demo company
                    try:
                        from seed_demo_company import seed_demo
                        await seed_demo()
                        print("[SEED] Demo company seeded successfully.", flush=True)
                    except Exception as e:
                        print(f"[SEED] WARNING: Failed to seed demo company: {e}", flush=True)
                else:
                    print("[SEED] Database already has data. Skipping auto-seed.", flush=True)
        except Exception as e:
            print(f"[SEED] WARNING: Auto-seed error: {e}", flush=True)
    except Exception as e:
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

from fastapi.responses import FileResponse

@app.get("/api")
async def api_root():
    return {"message": "ESGravty API is running", "docs": "/docs"}

app.include_router(api_router, prefix=settings.API_V1_STR)

# Uploads directory
os.makedirs("uploads", exist_ok=True)
try:
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
except Exception as e:
    m_logger.warning(f"Uploads mount warning: {e}")

# Serve Frontend Static Files
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "frontend", "dist")
frontend_dist = os.path.abspath(frontend_dist)

if os.path.exists(frontend_dist):
    print(f"[FRONTEND] Serving static files from {frontend_dist}", flush=True)
    # Mount the assets directory (Vite outputs js/css here)
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    
    # Catch-all for React Router / Vite frontend
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        path = os.path.join(frontend_dist, full_path)
        if os.path.exists(path) and os.path.isfile(path):
            return FileResponse(path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
else:
    print(f"[FRONTEND] WARNING: Frontend dist directory not found at {frontend_dist}", flush=True)
    @app.get("/")
    async def root():
        return {"message": "ESGravty API is running. Frontend not built.", "docs": "/docs"}

print("[OK] Application startup complete!", flush=True)
