import asyncio
import os
import sys
import random
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from sqlalchemy import text

# Add backend directory to path
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)

from app.core.config import settings
from app.models.company import Company, Site
from app.models.checklist import CompanyChecklist
from app.models.data_element import DataElement
from app.models.submission import DataSubmission
from app.models.user import User
from app.models.meter import Meter

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

async def main():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    print("Simulating historical dashboard data matched to the site checklists...")

    async with async_session() as db:
        # Clear existing submissions for company 1 (Apex)
        await db.execute(text("DELETE FROM data_submissions WHERE company_id = 1;"))
        await db.commit()
        print("Cleared previous submissions for Apex.")

        # Query company, sites, and admin user
        company = await db.get(Company, 1)
        if not company:
            print("Company Apex not found.")
            return

        sites = (await db.execute(select(Site).where(Site.company_id == 1))).scalars().all()
        admin = (await db.execute(select(User).where(User.email == "admin@apex.demo"))).scalars().first()
        admin_id = admin.id if admin else None

        # Target monthly values for Site 1 (Dubai Marina) and Site 2 (Abu Dhabi Downtown)
        # Total monthly: Energy (2400), Water (2000), Waste (1700), Fuel (900), Env Other (3900), Social (4700), Gov (3400)
        target_monthly_vals = {
            'Energy':            {1: 1300.0, 2: 1100.0},
            'Water':             {1: 1100.0, 2: 900.0},
            'Waste':             {1: 950.0,  2: 750.0},
            'Fuel':              {1: 500.0,  2: 400.0},
            'Environment Other': {1: 2100.0, 2: 1800.0},
            'Social':            {1: 2600.0, 2: 2100.0},
            'Governance':        {1: 1900.0, 2: 1500.0}
        }

        months = [1, 2, 3, 4, 5]  # Jan to May 2026
        year = 2026
        seeded_count = 0

        # For each site
        for site in sites:
            site_key = 1 if "marina" in site.name.lower() else 2
            print(f"\nProcessing active checklist for site: {site.name}")
            
            # Fetch active checklist elements for this site
            checklist_items = (await db.execute(
                select(CompanyChecklist).where(CompanyChecklist.site_id == site.id)
            )).scalars().all()
            
            # Retrieve the element details
            active_elements = []
            for item in checklist_items:
                el = await db.get(DataElement, item.data_element_id)
                if el:
                    active_elements.append(el)
                    
            # Group active checklist elements by synthetic category
            cat_to_active = {}
            for el in active_elements:
                cat = get_synthetic_category(el.name, el.category)
                if cat not in cat_to_active:
                    cat_to_active[cat] = []
                cat_to_active[cat].append(el)
                
            print(f"  Active categories in checklist: {list(cat_to_active.keys())}")
            
            # For each synthetic category
            for cat, site_targets in target_monthly_vals.items():
                target_base = site_targets[site_key]
                
                # Try to get an active element from this category
                possible_elements = cat_to_active.get(cat, [])
                
                # If no elements are active for this site in this category, print a warning and skip
                if not possible_elements:
                    print(f"  [WARNING] Category '{cat}' has no active elements in the checklist for {site.name}. Skipping.")
                    continue
                    
                # Pick the first active data element for this category
                element = possible_elements[0]
                
                # Check if there is an associated meter for this element and site
                meter = (await db.execute(
                    select(Meter).where(
                        Meter.site_id == site.id,
                        Meter.data_element_id == element.id,
                        Meter.is_active == True
                    )
                )).scalars().first()
                meter_id = meter.id if meter else None

                print(f"  Seeding {cat} using element '{element.name}' (Code: {element.element_code}, Meter ID: {meter_id})")

                # Seed each month
                for month in months:
                    # Add some random variance
                    variance = random.uniform(-0.15, 0.15)
                    value = round(target_base * (1 + variance), 2)
                    
                    db.add(DataSubmission(
                        company_id=1,
                        site_id=site.id,
                        data_element_id=element.id,
                        meter_id=meter_id,
                        year=year,
                        month=month,
                        value=value,
                        submitted_by=admin_id,
                        notes=f"Simulated historical {cat} data entry"
                    ))
                    seeded_count += 1

        await db.commit()
        print(f"\nSeeding completed. Inserted {seeded_count} submissions matched to site checklists.")

if __name__ == "__main__":
    asyncio.run(main())
