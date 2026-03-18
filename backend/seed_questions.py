import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from app.core.config import settings
from app.models.profiling import ProfilingQuestion

async def seed_questions():
    engine = create_async_engine('sqlite+aiosqlite:///./esg_portal.db')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        result = await db.execute(select(ProfilingQuestion))
        if len(result.scalars().all()) == 0:
            print('Seeding questions...')
            q1 = ProfilingQuestion(question_text='Do you have on-site laundry facilities?', question_order=1, requires_meter=True)
            q2 = ProfilingQuestion(question_text='Do you have swimming pools or spas?', question_order=2, requires_meter=True)
            q3 = ProfilingQuestion(question_text='Do you operate an in-house restaurant or commercial kitchen?', question_order=3, requires_meter=True)
            q4 = ProfilingQuestion(question_text='Do you maintain a fleet of company-owned vehicles?', question_order=4, requires_meter=True)
            q5 = ProfilingQuestion(question_text='Do you manage extensive landscaped gardens or golf courses?', question_order=5, requires_meter=True)
            
            db.add_all([q1, q2, q3, q4, q5])
            await db.commit()
            print('Questions added successfully!')
        else:
            print('Questions already exist.')

if __name__ == '__main__':
    asyncio.run(seed_questions())
