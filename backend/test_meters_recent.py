import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.api.deps import get_current_active_user
from app.models.user import User, UserProfile
from sqlalchemy.future import select
from app.db.session import SessionLocal
from app.models.meter import Meter

async def get_test():
    async with SessionLocal() as db:
        stmt = select(Meter).order_by(Meter.id.desc()).limit(5)
        res = await db.execute(stmt)
        recent = res.scalars().all()
        for r in recent:
            print(f"ID: {r.id}, Name: {r.name}, Company: {r.company_id}")

if __name__ == '__main__':
    asyncio.run(get_test())
