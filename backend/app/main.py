import os
import sys
import logging

logging.basicConfig(level=logging.INFO)
m_logger = logging.getLogger("app.main")

print("=" * 60, flush=True)
print("ESGravity Backend - Starting up...", flush=True)
print(f"Python: {sys.version}", flush=True)
print(f"PORT: {os.environ.get('PORT', 'not set')}", flush=True)
print(f"ENVIRONMENT: {os.environ.get('ENVIRONMENT', 'not set')}", flush=True)
print(f"DATABASE_URL set: {bool(os.environ.get('DATABASE_URL'))}", flush=True)
print("=" * 60, flush=True)

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.api import api_router

# Rate limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.ENVIRONMENT != "production" else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Request logging middleware
from fastapi import Request
import time

@app.middleware("http")
async def log_requests(request: Request, call_next):
    # Get a logger inside the middleware to avoid any scoping/initialization issues
    m_logger = logging.getLogger("app.main")
    
    # Restrict request size to 10MB to prevent memory exhaustion attacks
    MAX_REQUEST_SIZE = 10 * 1024 * 1024
    if "content-length" in request.headers:
        try:
            content_length = int(request.headers["content-length"])
            if content_length > MAX_REQUEST_SIZE:
                from fastapi.responses import JSONResponse
                return JSONResponse(status_code=413, content={"detail": "Request payload too large"})
        except ValueError:
            pass
            
    start_time = time.time()
    origin = request.headers.get("origin")
    host = request.headers.get("host")
    response = None
    try:
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        formatted_process_time = "{0:.2f}".format(process_time)
        m_logger.info(f"REQUEST: {request.method} {request.url.path} - FROM: {origin} (via {host}) - STATUS: {response.status_code} - TIME: {formatted_process_time}ms")
    except Exception as e:
        m_logger.exception(f"CRASH: {request.method} {request.url.path} - FROM: {origin} - ERROR: {str(e)}")
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
    allow_headers=["*", "X-CSRF-Token"],
)

# ── CSRF protection middleware (double-submit cookie pattern) ────────────
# Skips safe methods (GET/HEAD/OPTIONS) and unauthenticated auth routes that
# set cookies. /health is GET-only but listed for clarity.
# NOTE: /docs and /openapi.json are GET-only → already skipped by method check.
_CSRF_EXEMPT_PATHS = {
    "/health",
    f"{settings.API_V1_STR}/auth/magic-link",
    f"{settings.API_V1_STR}/auth/register",
    f"{settings.API_V1_STR}/auth/request-login-link",
    f"{settings.API_V1_STR}/auth/developer/request-login-link",
    f"{settings.API_V1_STR}/auth/demo-login",
    f"{settings.API_V1_STR}/auth/reset-password",
    f"{settings.API_V1_STR}/auth/logout",
}

@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return await call_next(request)

    path = request.url.path
    # Skip CSRF check for exempt paths (auth endpoints that set cookies)
    if any(path.startswith(exempt) for exempt in _CSRF_EXEMPT_PATHS):
        return await call_next(request)

    # Only enforce CSRF when the request carries an access_token cookie
    # (header-based Bearer token auth is not vulnerable to CSRF)
    if "access_token" in request.cookies:
        cookie_csrf = request.cookies.get("csrf_token")
        header_csrf = request.headers.get("x-csrf-token")
        if not cookie_csrf or not header_csrf or cookie_csrf != header_csrf:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF token missing or invalid"},
            )

    return await call_next(request)

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
                    
                    # --- TEMP FIX: Auto-reset broken migrations ---
                    if current in ('03845ab2ce6f', 'e11acf5f2207', '22c5fb7fd136', '9a1c7e2d4b10', '3429fa218f4a'):
                        conn.execute(text("UPDATE alembic_version SET version_num = 'de33973c150e'"))
                        conn.commit()
                        print(f"[MIGRATE] Auto-reset alembic_version from {current} back to de33973c150e", flush=True)
                    # ----------------------------------------------
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
    return {"message": "ESGravity API is running", "docs": "/docs"}

app.include_router(api_router, prefix=settings.API_V1_STR)

# Uploads directory
# Served through a dedicated route (not a raw StaticFiles mount) so we control
# Content-Type/Content-Disposition ourselves — the upload endpoint only accepts
# a fixed whitelist of extensions, but this is defense-in-depth: it stops the
# browser from ever rendering a served file as HTML/script regardless of content.
UPLOAD_DIR = os.path.abspath("uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

_UPLOAD_INLINE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf"}
_UPLOAD_MEDIA_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
}

@app.get("/uploads/{filename}")
async def serve_upload(filename: str):
    # Uploaded filenames are always <uuid4hex><ext>, generated server-side —
    # reject anything else to prevent path traversal.
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=404, detail="Not found")
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Not found")

    ext = os.path.splitext(filename)[1].lower()
    media_type = _UPLOAD_MEDIA_TYPES.get(ext, "application/octet-stream")
    disposition = "inline" if ext in _UPLOAD_INLINE_EXTENSIONS else "attachment"
    return FileResponse(
        file_path,
        media_type=media_type,
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "X-Content-Type-Options": "nosniff",
        },
    )

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
        return {"message": "ESGravity API is running. Frontend not built.", "docs": "/docs"}

print("[OK] Application startup complete!", flush=True)
