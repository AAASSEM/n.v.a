import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

async def check_db():
    engine = create_async_engine('sqlite+aiosqlite:///./esg_portal.db')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        result = await session.execute(text('SELECT u.email, p.company_id FROM users u LEFT JOIN user_profiles p ON u.id = p.user_id'))
        for row in result:
            print(f'User: {row[0]}, Company ID: {row[1]}')

asyncio.run(check_db())
