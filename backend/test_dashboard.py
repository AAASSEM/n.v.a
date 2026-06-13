import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import sys
import os

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)

from app.core.config import settings
from app.api.endpoints.dashboard import get_dashboard_metrics, get_esg_score, get_month_comparison
from app.models.user import User
from sqlalchemy.future import select

async def main():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Get admin user
        admin = (await db.execute(select(User).where(User.email == 'admin@apex.demo'))).scalars().first()
        if not admin:
            print("Admin not found")
            return
        
        # Load user profile to avoid lazy load issues
        from sqlalchemy.orm import selectinload
        admin = (await db.execute(
            select(User).options(selectinload(User.profile)).where(User.email == 'admin@apex.demo')
        )).scalars().first()

        try:
            print("Testing get_dashboard_metrics...")
            res = await get_dashboard_metrics(db, current_user=admin, site_id=1, pillar="E")
            print("Success")
        except Exception as e:
            import traceback
            print("Error in get_dashboard_metrics:")
            traceback.print_exc()

        try:
            print("Testing get_esg_score...")
            res2 = await get_esg_score(db, current_user=admin, site_id=1)
            print("Success")
        except Exception as e:
            import traceback
            print("Error in get_esg_score:")
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
