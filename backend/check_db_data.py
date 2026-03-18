import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from app.models.company import Company
from app.models.profiling import CompanyProfileAnswer
from app.models.user import User

async def check_db():
    engine = create_async_engine('sqlite+aiosqlite:///./esg_portal.db')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        users = (await db.execute(select(User))).scalars().all()
        print(f"Users count: {len(users)}")
        
        comps = (await db.execute(select(Company))).scalars().all()
        print(f"Companies count: {len(comps)}")
        for c in comps:
             print(f" - Company: {c.id} / {c.name} / {c.emirate} / Owner: {c.owner_id}")
             
        answers = (await db.execute(select(CompanyProfileAnswer))).scalars().all()
        print(f"Answers count: {len(answers)}")

if __name__ == '__main__':
    asyncio.run(check_db())
