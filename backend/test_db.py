import asyncio
import sys
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

# Must be run from backend dir
from app.core.config import settings
from app.models.company import Site, Company

async def test():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as db:
        print("SITES:")
        res = await db.execute(select(Site))
        for s in res.scalars():
            print(f"Site ID: {s.id}, Name: {s.name}, Location: {s.location}")
            
        print("COMPANIES:")
        res = await db.execute(select(Company))
        for c in res.scalars():
            print(f"Company ID: {c.id}, Name: {c.name}, Emirate: {c.emirate}")

asyncio.run(test())
