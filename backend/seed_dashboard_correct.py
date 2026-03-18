import asyncio
import datetime
from dateutil.relativedelta import relativedelta
import random
from app.db.session import async_session
from app.models.submission import DataSubmission
from app.models.data_element import DataElement
from app.models.user import User, UserProfile
from sqlalchemy.future import select

def get_synthetic_category(name: str, db_cat: str) -> str:
    n = name.lower()
    if 'water' in n: return 'Water'
    if 'waste' in n or 'recycling' in n or 'compost' in n: return 'Waste'
    if 'fuel' in n or 'diesel' in n or 'petrol' in n or 'vehicles' in n: return 'Fuel'
    if 'energy' in n or 'electricity' in n or 'lighting' in n or 'carbon' in n: return 'Energy'
    if db_cat == 'E': return 'Environment Other'
    if db_cat == 'S': return 'Social'
    if db_cat == 'G': return 'Governance'
    return 'Other'

async def seed_dashboard_data_for_user():
    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == 'aaa136@gmail.com'))
        user = result.scalars().first()
        if not user: return
        
        result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
        profile = result.scalars().first()
        if not profile: return
        
        company_id = profile.company_id
        
        result = await db.execute(select(DataElement))
        elements = result.scalars().all()
        
        elements_to_mock = []
        for e in elements:
            cat = get_synthetic_category(e.name, e.category)
            if cat in ['Energy', 'Water', 'Waste', 'Fuel', 'Social', 'Governance', 'Environment Other']:
                elements_to_mock.append((e, cat))

        today = datetime.date.today()
        seeded_count = 0
        
        for i in range(6, -1, -1):
            target_date = today - relativedelta(months=i)
            year = target_date.year
            month = target_date.month
            
            for element, synthetic_cat in elements_to_mock:
                if synthetic_cat == 'Energy': base_val = random.randint(3000, 6000)
                elif synthetic_cat == 'Water': base_val = random.randint(1500, 4000)
                elif synthetic_cat == 'Waste': base_val = random.randint(100, 800)
                elif synthetic_cat == 'Fuel': base_val = random.randint(500, 2000)
                else: base_val = random.randint(10, 100)
                
                check = await db.execute(
                    select(DataSubmission).where(
                        DataSubmission.company_id == company_id,
                        DataSubmission.data_element_id == element.id,
                        DataSubmission.year == year,
                        DataSubmission.month == month,
                        DataSubmission.meter_id == None
                    )
                )
                existing = check.scalars().first()
                if not existing:
                    val = base_val + random.randint(-50, 50)
                    if val < 0: val = 10
                    sub = DataSubmission(
                        company_id=company_id,
                        data_element_id=element.id,
                        meter_id=None,
                        year=year,
                        month=month,
                        value=float(val),
                        notes="Auto-seeded for dashboard demo"
                    )
                    db.add(sub)
                    seeded_count += 1
        
        await db.commit()
        print(f"Successfully seeded {seeded_count} dashboard records for company {company_id}.")

if __name__ == '__main__':
    asyncio.run(seed_dashboard_data_for_user())
