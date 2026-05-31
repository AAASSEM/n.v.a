from typing import List, Union, Optional
from pydantic import model_validator
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

    @model_validator(mode='after')
    def assemble_settings(self) -> 'Settings':
        # 1. Assemble CORS Origins
        v = self.BACKEND_CORS_ORIGINS
        origins = []
        if isinstance(v, str):
            if not v.startswith("["):
                origins = [i.strip() for i in v.split(",") if i.strip()]
            else:
                import json
                try:
                    origins = json.loads(v)
                except Exception:
                    origins = []
        elif isinstance(v, list):
            origins = list(v)

        if self.ENVIRONMENT == "production":
            for domain in ["https://esg-compass.onrender.com", "https://esg-compass-3vkg.onrender.com", "https://n-v-a.onrender.com"]:
                if domain not in origins:
                    origins.append(domain)

        frontend = self.FRONTEND_URL
        if frontend and frontend not in origins:
            origins.append(frontend)

        self.BACKEND_CORS_ORIGINS = [o.rstrip("/") for o in origins]

        # 2. Assemble DB Connection
        db_url = self.DATABASE_URL
        if db_url:
            db_url = db_url.replace("?pgbouncer=true", "")
            db_url = db_url.replace("&pgbouncer=true", "")
            self.SQLALCHEMY_DATABASE_URI = db_url
            
        return self

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
    EMAILS_FROM_NAME: str = "ESGravity"
    
    # Google Cloud Storage (production uploads)
    GCS_BUCKET: Optional[str] = None

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
