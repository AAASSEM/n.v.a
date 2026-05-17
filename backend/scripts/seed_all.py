"""One-shot chained seeder: base platform data + demo multi-site company.

Usage:
    cd backend
    python scripts/seed_all.py

Order matters:
  0. alembic upgrade head  — make sure the schema matches the models
  1. init_db_data          — creates the dev super_user
  2. seed_fws              — seeds Framework catalog
  3. seed_questions        — seeds the 22 profiling questions
  4. seed_demo_company     — demo company with 2 sites + 8 users + onboarding
"""
import asyncio
import os
import subprocess
import sys

# Make the backend package importable when run from backend/
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

# Ensure working directory is backend/ so SQLite path "./esg_portal.db" lines up
os.chdir(BACKEND_DIR)

from init_db_data import init_dev_user
from seed_questions import seed_questions
from seed_data_elements import seed_elements
from seed_demo_company import seed_demo


def run_migrations():
    """Apply all Alembic migrations so the DB schema matches the models."""
    print("  running alembic upgrade head …")
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        raise RuntimeError("alembic upgrade head failed")
    if result.stdout.strip():
        print(result.stdout)


async def seed_fws_async():
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.future import select
    from app.core.config import settings
    from app.models.framework import Framework

    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    frameworks = [
        {"framework_id": "ESG", "name": "Environment Social Governance", "type": "mandatory", "description": "Core ESG requirements"},
        {"framework_id": "DST", "name": "Dubai Sustainable Tourism", "type": "voluntary", "description": "Dubai Tourism sustainability standard"},
        {"framework_id": "GREEN KEY", "name": "Green Key", "type": "voluntary", "description": "Green Key eco-label standard"},
    ]
    async with async_session() as db:
        for f in frameworks:
            existing = (await db.execute(select(Framework).where(Framework.framework_id == f['framework_id']))).scalars().first()
            if not existing:
                db.add(Framework(**f))
        await db.commit()


async def main():
    print("==> 0. migrate DB to head")
    run_migrations()
    print("==> 1. init dev super_user")
    await init_dev_user()
    print("==> 2. seed frameworks")
    await seed_fws_async()
    print("==> 3. seed 22 profiling questions")
    await seed_questions()
    print("==> 4. seed data elements catalog")
    await seed_elements()
    print("==> 5. seed demo company + sites + users")
    await seed_demo()
    print("==> all seeds complete")


if __name__ == "__main__":
    asyncio.run(main())
