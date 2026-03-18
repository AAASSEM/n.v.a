import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from app.models.company import Company
from app.models.profiling import ProfilingQuestion, CompanyProfileAnswer

async def check_data():
    engine = create_async_engine('sqlite+aiosqlite:///./esg_portal.db')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        questions = (await db.execute(select(ProfilingQuestion))).scalars().all()
        print(f"Total questions: {len(questions)}")
        
        comps = (await db.execute(select(Company))).scalars().all()
        for c in comps:
             print(f"Company ID {c.id}: emirate={c.emirate}, sector={c.sector}, frameworks={c.active_frameworks}")

if __name__ == '__main__':
    asyncio.run(check_data())
