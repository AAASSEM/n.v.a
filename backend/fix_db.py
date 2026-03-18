import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

async def fix_db():
    engine = create_async_engine('sqlite+aiosqlite:///./esg_portal.db')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Find the user's profile
        res = await session.execute(text("SELECT id FROM user_profiles WHERE user_id = 1"))
        profile_id = res.scalar()
        
        if profile_id:
            await session.execute(text("UPDATE user_profiles SET company_id = 1 WHERE id = :pid"), {"pid": profile_id})
            await session.commit()
            print('Linked user to company 1')
        else:
            print('Profile not found')

asyncio.run(fix_db())
