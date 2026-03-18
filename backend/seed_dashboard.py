import asyncio
import datetime
from dateutil.relativedelta import relativedelta
import random
from app.db.session import async_session
from app.models.submission import DataSubmission
from app.models.data_element import DataElement
from app.models.company import Company
from sqlalchemy.future import select

async def seed_dashboard_data():
    async with async_session() as db:
        # Get first company
        result = await db.execute(select(Company))
        company = result.scalars().first()
        if not company:
            print("No company found.")
            return

        # Get data elements
        result = await db.execute(select(DataElement))
        elements = result.scalars().all()
        
        elements_to_mock = []
        for e in elements:
            if e.category in ['Energy', 'Water', 'Waste', 'Fuel']:
                elements_to_mock.append(e)

        today = datetime.date.today()
        
        for i in range(6, -1, -1):
            target_date = today - relativedelta(months=i)
            year = target_date.year
            month = target_date.month
            
            for element in elements_to_mock:
                # Randomize somewhat realistic values based on category
                if element.category == 'Energy':
                    base_val = random.randint(3000, 6000)
                elif element.category == 'Water':
                    base_val = random.randint(1500, 4000)
                elif element.category == 'Waste':
                    base_val = random.randint(100, 800)
                elif element.category == 'Fuel':
                    base_val = random.randint(500, 2000)
                else:
                    base_val = random.randint(50, 500)
                
                # Check if exists to avoid UNIQUE constraints
                check = await db.execute(
                    select(DataSubmission)
                    .where(
                        DataSubmission.company_id == company.id,
                        DataSubmission.data_element_id == element.id,
                        DataSubmission.year == year,
                        DataSubmission.month == month,
                        DataSubmission.meter_id == None
                    )
                )
                existing = check.scalars().first()
                if not existing:
                    val = base_val + (random.randint(-500, 500))
                    if val < 0: val = 100
                    sub = DataSubmission(
                        company_id=company.id,
                        data_element_id=element.id,
                        meter_id=None,
                        year=year,
                        month=month,
                        value=float(val),
                        notes="Auto-seeded for dashboard demo"
                    )
                    db.add(sub)
        
        await db.commit()
        print("Successfully seeded dashboard historical submissions.")

if __name__ == '__main__':
    asyncio.run(seed_dashboard_data())
