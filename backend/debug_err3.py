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
        # Check an active company
        stmt_comp = select(Company).limit(1)
        company = (await db.execute(stmt_comp)).scalars().first()
        
        # the frontend payload sends answeredCount < totalQuestions guard. 
        # so answers array is FULL. Let's send a full array with boolean values exactly like the TSX.
        from app.models.profiling import ProfilingQuestion
        qs = (await db.execute(select(ProfilingQuestion))).scalars().all()
        
        answers = [{"question_id": q.id, "answer": True} for q in qs]
        
        try:
            print("Trying generate checklist with full true answers...")
            await ProfilingService.generate_checklist(company.id, answers, db)
            print("Successfully regenerated")
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(debug())
