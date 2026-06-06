import asyncio
import os
import sys
import random
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

# Add backend directory to path
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)

from app.core.config import settings
from app.models.company import Site
from app.models.data_element import DataElement
from app.models.submission import DataSubmission

BOOLEAN_CODES = {
    'HOSP-S-012', 'HOSP-G-013', 'HOSP-G-014', 'HOSP-G-035', 'HOSP-G-037',
    'HOSP-G-038', 'HOSP-G-039', 'HOSP-G-040', 'HOSP-G-041', 'HOSP-E-043',
    'HOSP-S-044', 'HOSP-S-045', 'HOSP-S-046', 'HOSP-S-047', 'HOSP-E-048',
    'HOSP-E-049', 'HOSP-E-050', 'HOSP-E-051', 'HOSP-E-052', 'HOSP-E-053',
    'HOSP-E-054', 'HOSP-E-055', 'HOSP-E-056', 'HOSP-E-057', 'HOSP-S-058',
    'HOSP-G-059', 'HOSP-E-064', 'HOSP-G-070', 'HOSP-E-075', 'HOSP-G-079', 'HOSP-G-080',
}

async def main():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Get all S and G elements
        elements = (await db.execute(
            select(DataElement).where(DataElement.category.in_(['S', 'G']))
        )).scalars().all()
        
        # Get company 1 sites (Assuming Apex is company 1, which Sam belongs to based on previous sim script)
        sites = (await db.execute(select(Site).where(Site.company_id == 1))).scalars().all()
        
        if not sites:
            print("No sites found for Company 1.")
            return

        seeded_count = 0
        year = 2026
        months = [1, 2, 3, 4, 5, 6]

        for month in months:
            for site in sites:
                for element in elements:
                    # Check if it already exists
                    existing = (await db.execute(
                        select(DataSubmission).where(
                            DataSubmission.company_id == 1,
                            DataSubmission.site_id == site.id,
                            DataSubmission.data_element_id == element.id,
                            DataSubmission.year == year,
                            DataSubmission.month == month
                        )
                    )).scalars().first()

                    if not existing:
                        # Decide value
                        if element.element_code in BOOLEAN_CODES or element.unit == 'boolean':
                            # 80% chance of being Yes
                            val = 1.0 if random.random() < 0.8 else 0.0
                        elif element.unit == '%':
                            val = float(random.randint(40, 100))
                        else:
                            val = float(random.randint(10, 500))

                        db.add(DataSubmission(
                            company_id=1,
                            site_id=site.id,
                            data_element_id=element.id,
                            year=year,
                            month=month,
                            value=val,
                            notes="Auto-seeded S/G data for all months"
                        ))
                        seeded_count += 1
        
        await db.commit()
        print(f"Successfully seeded {seeded_count} missing S/G data elements across {len(sites)} sites for months 1-6.")

if __name__ == "__main__":
    asyncio.run(main())
