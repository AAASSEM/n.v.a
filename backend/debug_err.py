import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from app.models.company import Company
from app.services.profiling_service import ProfilingService

async def debug():
    engine = create_async_engine('sqlite+aiosqlite:///./esg_portal.db')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        stmt_comp = select(Company).limit(1)
        company = (await db.execute(stmt_comp)).scalars().first()
        
        try:
            await ProfilingService.generate_checklist(company.id, [], db)
            print("Successfully regenerated")
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(debug())
