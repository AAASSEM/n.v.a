import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from app.core.config import settings
from app.models.company import Company
from app.models.user import User

from seed_demo_company import seed_demo, USERS

async def reset_demo():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        print("Finding existing demo company APEX01...")
        company = (await db.execute(select(Company).where(Company.company_code == 'APEX01'))).scalars().first()
        if company:
            print("Deleting existing demo company...")
            await db.delete(company)
            await db.commit()
            print("Demo company deleted (cascade should wipe sites, submissions, checklists, meters).")
        
        print("Finding demo users...")
        demo_emails = [u[0] for u in USERS]
        users = (await db.execute(select(User).where(User.email.in_(demo_emails)))).scalars().all()
        for u in users:
            await db.delete(u)
        if users:
            await db.commit()
            print(f"Deleted {len(users)} demo users.")
            
    # Now that the DB is clean, re-seed it!
    print("Re-seeding the demo company from scratch...")
    await seed_demo()
    print("Demo company reset complete!")

if __name__ == "__main__":
    asyncio.run(reset_demo())
