import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from app.models.profiling import ProfilingQuestion

async def check():
    engine = create_async_engine('sqlite+aiosqlite:///./esg_portal.db')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        questions = (await db.execute(select(ProfilingQuestion))).scalars().all()
        for q in questions[:5]:
            print(f"ID {q.id}: '{q.frameworks}'")

if __name__ == '__main__':
    asyncio.run(check())
