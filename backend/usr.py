import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.models.user import User

async def check():
    engine = create_async_engine('sqlite+aiosqlite:///./esg_portal.db')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        users = (await db.execute(select(User).options(selectinload(User.profile)))).scalars().all()
        for u in users:
            print(f"ID {u.id}: {u.email} ({u.first_name}) - Company {u.profile.company_id if u.profile else 'No profile'}")

if __name__ == '__main__':
    asyncio.run(check())
