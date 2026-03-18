import os
import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Print startup diagnostics immediately — visible in Render logs
print("=" * 60, flush=True)
print("ESG Compass Backend - Starting up...", flush=True)
print(f"Python: {sys.version}", flush=True)
print(f"PORT: {os.environ.get('PORT', 'not set')}", flush=True)
print(f"ENVIRONMENT: {os.environ.get('ENVIRONMENT', 'not set')}", flush=True)
print(f"DATABASE_URL set: {bool(os.environ.get('DATABASE_URL'))}", flush=True)
print(f"SECRET_KEY set: {bool(os.environ.get('SECRET_KEY'))}", flush=True)
print("=" * 60, flush=True)

try:
    from fastapi import FastAPI
    from fastapi.staticfiles import StaticFiles
    from fastapi.middleware.cors import CORSMiddleware
    print("[OK] FastAPI imported", flush=True)
except Exception as e:
    print(f"[FAIL] FastAPI import error: {e}", flush=True)
    sys.exit(1)

try:
    from app.core.config import settings
    print(f"[OK] Config loaded - ENVIRONMENT={settings.ENVIRONMENT}", flush=True)
    db_preview = settings.SQLALCHEMY_DATABASE_URI[:40] if settings.SQLALCHEMY_DATABASE_URI else "NONE"
    print(f"     DB starts with: {db_preview}...", flush=True)
    print(f"     FRONTEND_URL: {settings.FRONTEND_URL}", flush=True)
except Exception as e:
    print(f"[FAIL] Config error: {e}", flush=True)
    sys.exit(1)

try:
    from app.api.api import api_router
    print("[OK] API router loaded", flush=True)
except Exception as e:
    print(f"[FAIL] API router error: {e}", flush=True)
    sys.exit(1)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# CORS
origins = list(set(settings.BACKEND_CORS_ORIGINS or []))
if not origins:
    origins = ["*"]
print(f"[OK] CORS origins: {origins}", flush=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

try:
    app.include_router(api_router, prefix=settings.API_V1_STR)
    print("[OK] Routes mounted", flush=True)
except Exception as e:
    print(f"[FAIL] Route mounting error: {e}", flush=True)
    sys.exit(1)

# Uploads directory
os.makedirs("uploads", exist_ok=True)
try:
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
    print("[OK] Uploads directory mounted", flush=True)
except Exception as e:
    print(f"[WARN] Uploads mount issue: {e}", flush=True)

print("[OK] Application startup complete!", flush=True)
