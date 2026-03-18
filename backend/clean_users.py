import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from app.core.config import settings
from app.models.user import User

async def clean_users():
    engine = create_async_engine('sqlite+aiosqlite:///./esg_portal.db')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        result = await db.execute(select(User).where(User.email.in_(['testcors@example.com', 'testcors2@example.com', 'freshuser@test.com', 'blerg@example.com'])))
        users = result.scalars().all()
        for u in users:
            await db.delete(u)
        await db.commit()
        print(f"Deleted {len(users)} test users.")

if __name__ == '__main__':
    asyncio.run(clean_users())
