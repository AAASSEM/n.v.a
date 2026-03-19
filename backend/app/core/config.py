from typing import List, Union, Optional
from pydantic import validator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "ESG Portal API"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment
    ENVIRONMENT: str = "development"  # development | production
    
    # Frontend URL (for emails, CORS)
    FRONTEND_URL: str = "http://localhost:5173"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]], values) -> Union[List[str], str]:
        origins = []
        if isinstance(v, str) and not v.startswith("["):
            origins = [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list,)):
            origins = list(v)
            
        # Add Render frontend URL if ENVIRONMENT == production
        env = values.get("ENVIRONMENT", "development")
        if env == "production":
            # Direct domain
            render_domain = "https://esg-compass.onrender.com"
            if render_domain not in origins:
                origins.append(render_domain)
            
        # Also include the FRONTEND_URL if set
        frontend = values.get("FRONTEND_URL")
        if frontend and frontend not in origins:
            origins.append(frontend)
            
        origins = [o.rstrip("/") for o in origins]
        return origins

    # Database
    # Set DATABASE_URL env var in production (e.g. Cloud SQL)
    # Format: postgresql+asyncpg://user:pass@host:5432/dbname
    DATABASE_URL: Optional[str] = None
    
    # Legacy individual vars (used if DATABASE_URL is not set)
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "esg_portal"
    
    SQLALCHEMY_DATABASE_URI: str = "sqlite+aiosqlite:///./esg_portal.db"
    
    @validator("SQLALCHEMY_DATABASE_URI", pre=True)
    def assemble_db_connection(cls, v, values):
        db_url = values.get("DATABASE_URL")
        if db_url:
            # Clean up pgbouncer param which asyncpg doesn't like
            db_url = db_url.replace("?pgbouncer=true", "")
            db_url = db_url.replace("&pgbouncer=true", "")
            return db_url
        return v  # Keep default (SQLite for local dev)

    # JWT Authentication
    SECRET_KEY: str = "development_secret_key_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Developer Admin
    DEVELOPER_ADMIN_SECRET: str = "super_secret_developer_key_change_me"

    # Email — SMTP (development) or Resend (production) or Sendgrid
    SENDGRID_API_KEY: Optional[str] = None
    RESEND_API_KEY: Optional[str] = None  # Set in production → uses Resend instead of SMTP
    SMTP_TLS: bool = True
    SMTP_SSL: bool = False
    SMTP_PORT: int = 587
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAILS_FROM_EMAIL: Optional[str] = "noreply@esgportal.com"
    EMAILS_FROM_NAME: str = "ESG Compass"
    
    # Google Cloud Storage (production uploads)
    GCS_BUCKET: Optional[str] = None

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
