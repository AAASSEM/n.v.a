import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.framework import Framework

async def check():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        res = await session.execute(select(Framework))
        fw = res.scalars().all()
        print(f'Total frameworks in DB: {len(fw)}')

asyncio.run(check())
