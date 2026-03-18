import asyncio
from app.db.session import async_session
from app.models.data_element import DataElement
from sqlalchemy.future import select

async def check():
    async with async_session() as db:
        result = await db.execute(select(DataElement))
        elements = result.scalars().all()
        print(f"Total elements: {len(elements)}")
        for e in elements:
            print(f"Element: {e.name}, Category: {e.category}")
        
if __name__ == '__main__':
    asyncio.run(check())
