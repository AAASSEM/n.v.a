import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from app.models.company import Company
from app.models.profiling import CompanyProfileAnswer
from app.services.profiling_service import ProfilingService

async def fix_data():
    engine = create_async_engine('sqlite+aiosqlite:///./esg_portal.db')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        companies = (await db.execute(select(Company))).scalars().all()
        for c in companies:
             answers = (await db.execute(select(CompanyProfileAnswer).where(CompanyProfileAnswer.company_id == c.id))).scalars().all()
             
             formatted_answers = [{"question_id": a.question_id, "answer": a.answer} for a in answers]
             print(f"Fixing company {c.id} with {len(formatted_answers)} answers")
             
             await ProfilingService.generate_checklist(c.id, formatted_answers, db)
        
        print("Done!")

if __name__ == '__main__':
    asyncio.run(fix_data())
