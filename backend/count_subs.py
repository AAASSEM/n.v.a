import asyncio
from app.db.session import async_session
from app.models.submission import DataSubmission
from sqlalchemy.future import select

async def count_submissions():
    async with async_session() as db:
        result = await db.execute(select(DataSubmission).where(DataSubmission.company_id == 5))
        subs = result.scalars().all()
        print(f"Company 5 submissions: {len(subs)}")
        
if __name__ == '__main__':
    asyncio.run(count_submissions())
