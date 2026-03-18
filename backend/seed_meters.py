import asyncio
import datetime
from dateutil.relativedelta import relativedelta
import random
from app.db.session import async_session
from app.models.submission import DataSubmission
from app.models.meter import Meter
from app.models.user import User, UserProfile
from sqlalchemy.future import select

async def seed_meters():
    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == 'aaa136@gmail.com'))
        user = result.scalars().first()
        if not user: return
        
        result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
        profile = result.scalars().first()
        if not profile: return
        company_id = profile.company_id
        
        result = await db.execute(select(Meter).where(Meter.company_id == company_id))
        meters = result.scalars().all()
        
        today = datetime.date.today()
        seeded_count = 0
        
        for m in meters:
            for i in range(6, -1, -1):
                target_date = today - relativedelta(months=i)
                year = target_date.year
                month = target_date.month
                
                check = await db.execute(
                    select(DataSubmission).where(
                        DataSubmission.company_id == company_id,
                        DataSubmission.data_element_id == m.data_element_id,
                        DataSubmission.year == year,
                        DataSubmission.month == month,
                        DataSubmission.meter_id == m.id
                    )
                )
                existing = check.scalars().first()
                if not existing:
                    sub = DataSubmission(
                        company_id=company_id,
                        data_element_id=m.data_element_id,
                        meter_id=m.id,
                        year=year,
                        month=month,
                        value=float(random.randint(100, 500)),
                        notes="Auto-seeded for meter"
                    )
                    db.add(sub)
                    seeded_count += 1
        
        await db.commit()
        print(f"Seeded {seeded_count} meter records")

if __name__ == '__main__':
    asyncio.run(seed_meters())
