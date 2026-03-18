import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from app.models.profiling import ProfilingQuestion

async def delete_questions():
    engine = create_async_engine('sqlite+aiosqlite:///./esg_portal.db')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        questions = (await db.execute(select(ProfilingQuestion).where(ProfilingQuestion.id <= 5))).scalars().all()
        for q in questions:
            await db.delete(q)
        await db.commit()
        print(f"Deleted {len(questions)} old dummy questions")

if __name__ == '__main__':
    asyncio.run(delete_questions())
