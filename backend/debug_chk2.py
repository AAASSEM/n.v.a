import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from app.models.company import Company
from app.models.profiling import CompanyProfileAnswer, ProfilingQuestion
from app.models.data_element import DataElement
from app.services.profiling_service import ProfilingService

async def debug():
    engine = create_async_engine('sqlite+aiosqlite:///./esg_portal.db')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        stmt_comp = select(Company).limit(1)
        company = (await db.execute(stmt_comp)).scalars().first()
        
        # force generate checklist
        await ProfilingService.generate_checklist(company.id, [], db)
        print("Checklist regenerated.")
        
        # Check elements count
        from app.models.checklist import CompanyChecklist
        chk = (await db.execute(select(CompanyChecklist).where(CompanyChecklist.company_id == company.id))).scalars().all()
        print(f"Checklist now has {len(chk)} elements")
        
if __name__ == '__main__':
    asyncio.run(debug())
