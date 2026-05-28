import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

# Add backend directory to path
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)

from app.core.config import settings
from init_db_data import init_dev_user
from seed_from_excel import seed_excel_data
from seed_demo_company import seed_demo

async def seed_fws_async(db: AsyncSession):
    from sqlalchemy.future import select
    from app.models.framework import Framework

    frameworks = [
        {"framework_id": "ESG", "name": "Environment Social Governance", "type": "mandatory", "description": "Core ESG requirements"},
        {"framework_id": "DST", "name": "Dubai Sustainable Tourism", "type": "voluntary", "description": "Dubai Tourism sustainability standard"},
        {"framework_id": "GREEN KEY", "name": "Green Key", "type": "voluntary", "description": "Green Key eco-label standard"},
    ]
    for f in frameworks:
        existing = (await db.execute(select(Framework).where(Framework.framework_id == f['framework_id']))).scalars().first()
        if not existing:
            db.add(Framework(**f))
    await db.commit()

async def main():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    print("Clearing all tables in SQLite database...")
    async with async_session() as db:
        # Disable foreign keys temporarily to clear tables safely
        await db.execute(text("PRAGMA foreign_keys = OFF;"))
        
        tables = [
            "data_submissions",
            "meters",
            "company_checklists",
            "company_profile_answers",
            "user_profiles",
            "users",
            "sites",
            "companies",
            "frameworks",
            "data_elements",
            "profiling_questions"
        ]
        
        for table in tables:
            try:
                await db.execute(text(f"DELETE FROM {table};"))
                print(f"  Cleared table: {table}")
            except Exception as e:
                print(f"  Error clearing {table}: {e}")
                
        await db.execute(text("PRAGMA foreign_keys = ON;"))
        await db.commit()
        
        print("Re-seeding all data...")
        
    # Run the seed pipeline
    print("==> 1. init dev super_user")
    await init_dev_user()
    
    print("==> 2. seed frameworks")
    async with async_session() as db:
        await seed_fws_async(db)
        
    print("==> 3. seed questions & data elements from Excel")
    await seed_excel_data()
    
    print("==> 4. seed demo company + sites + users + submissions")
    await seed_demo()
    
    print("==> Database reset and seeding completed successfully!")

if __name__ == "__main__":
    asyncio.run(main())
