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
            # Add known production domains.
            # NOTE: esg-compass.onrender.com (unclaimed/404) and esg-compass-3vkg.onrender.com
            # (suspended/503) were removed — dead domains have no business being trusted
            # CORS origins, since either could be reclaimed by someone else later.
            for domain in ["https://n-v-a.onrender.com"]:
                if domain not in origins:
                    origins.append(domain)
            # Remove localhost origins for security
            origins = [o for o in origins if "localhost" not in o and "127.0.0.1" not in o]

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
        # 3. Parse Developer Emails
        if self.DEVELOPER_EMAILS:
            self.parsed_developer_emails = [
                e.strip().lower() 
                for e in self.DEVELOPER_EMAILS.split(",") 
                if e.strip()
            ]
        else:
            self.parsed_developer_emails = []

        # Trailing whitespace/newlines are an easy paste artifact in a dashboard's
        # env var field, and httpcore2 rejects any header value containing one
        # outright (LocalProtocolError) — fails fast client-side before any network
        # call, which looks identical to a real connectivity problem. Strip it here
        # once so this class of misconfiguration can never silently break the
        # feature again, however the value ends up set.
        if self.ANTHROPIC_API_KEY:
            self.ANTHROPIC_API_KEY = self.ANTHROPIC_API_KEY.strip()

        return self

    # JWT Authentication
    SECRET_KEY: str = "development_secret_key_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Developer Admin Emails (comma-separated list in env)
    DEVELOPER_EMAILS: str = ""
    parsed_developer_emails: List[str] = []

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
    
    # Evidence-upload storage directory. Leave unset for local dev (writes to ./uploads,
    # relative to the app's working directory). On Render, set this to the mount path of
    # an attached persistent Disk (e.g. "/var/data/uploads") so uploaded files survive
    # deploys/restarts — Render's default filesystem is ephemeral otherwise.
    UPLOAD_DIR: Optional[str] = None

    # AI chat ("ask your data") — real Claude tool-calling integration.
    # ANTHROPIC_API_KEY unset = feature is disabled (endpoint returns a clear 503,
    # never silently falls back to the old fake-brain keyword matcher).
    ANTHROPIC_API_KEY: Optional[str] = None
    AI_CHAT_MODEL: str = "claude-haiku-4-5"
    AI_CHAT_MAX_TOKENS: int = 4096
    AI_CHAT_MAX_TOOL_ITERATIONS: int = 6
    # Hard wall-clock ceiling on the whole tool-calling loop — tool-call latency is
    # genuinely nondeterministic (the same question can take 4s or 48s), and this
    # must fire comfortably before Render/Cloudflare's own gateway timeout does, so
    # a slow turn ends in our own friendly message instead of a raw proxy error.
    AI_CHAT_TIMEOUT_SECONDS: int = 45
    AI_CHAT_RATE_LIMIT: str = "10/minute"
    AI_CHAT_DAILY_QUOTA_PER_COMPANY: int = 50
    AI_CHAT_DAILY_QUOTA_DEMO: int = 10

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
