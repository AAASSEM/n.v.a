from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings

# Disable SQL echo in production
is_dev = settings.ENVIRONMENT == "development"

# Create async engine for SQLAlchemy
engine_kwargs = {"pool_size": 5, "max_overflow": 10, "pool_pre_ping": True}

if "postgresql" in settings.SQLALCHEMY_DATABASE_URI:
    # Disable prepared statement caching for PgBouncer / Connection Poolers (transaction mode)
    engine_kwargs["connect_args"] = {
        "prepared_statement_cache_size": 0, 
        "statement_cache_size": 0
    }

engine = create_async_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    echo=is_dev,
    future=True,
    **engine_kwargs
)

# Create session factory
async_session = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

# Dependency for FastAPI
async def get_db():
    async with async_session() as session:
        yield session
