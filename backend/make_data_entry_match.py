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
from app.models.data_element import DataElement
from app.models.profiling import ProfilingQuestion
from app.models.checklist import CompanyChecklist
from app.models.submission import DataSubmission
from app.models.user import User
from app.models.meter import Meter
from app.services.profiling_service import ProfilingService

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

    print("Step 1: Aligning profiling answers to activate all dashboard categories...")

    async with async_session() as db:
        # Get all profiling questions to find match by text
        all_qs = (await db.execute(select(ProfilingQuestion))).scalars().all()
        
        # We want to activate:
        # 1. LPG Fuel (Fuel) -> 'Do you use LPG (cooking gas or similar fuel) in your operations?'
        # 2. Refrigerants (Env Other) -> 'Do you have air conditioning or refrigeration units that require refrigerant (gas) top-ups or servicing?'
        target_questions = [
            "Do you use LPG (cooking gas or similar fuel) in your operations?",
            "Do you have air conditioning or refrigeration units that require refrigerant (gas) top-ups or servicing?"
        ]
        
        answers_to_set = []
        for q in all_qs:
            for target in target_questions:
                if target.lower() in q.question_text.lower():
                    answers_to_set.append({"question_id": q.id, "answer": True})
                    print(f"Target Question Found: id={q.id}, text='{q.question_text[:40]}...'")

        # Get the sites for Apex (company_id = 1)
        sites = (await db.execute(select(Site).where(Site.company_id == 1))).scalars().all()
        
        # For each site, update profiling answers to ensure these are True, and generate checklist
        for site in sites:
            print(f"Setting profiling answers and generating checklist for site: {site.name}")
            
            # Fetch existing answers
            from app.models.profiling import CompanyProfileAnswer
            existing_ans = (await db.execute(
                select(CompanyProfileAnswer).where(
                    CompanyProfileAnswer.company_id == 1,
                    CompanyProfileAnswer.site_id == site.id
                )
            )).scalars().all()
            
            # Build list of all answers to submit (keeping existing and overriding targets)
            ans_dict = {a.question_id: a.answer for a in existing_ans}
            for target_ans in answers_to_set:
                ans_dict[target_ans["question_id"]] = True
                
            formatted_answers = [{"question_id": qid, "answer": ans} for qid, ans in ans_dict.items()]
            
            # Regenerate checklist using ProfilingService
            await ProfilingService.generate_checklist(
                company_id=1,
                site_id=site.id,
                answers=formatted_answers,
                db=db
            )
            print(f"Checklist and meters updated for site: {site.name}")

    print("\nStep 2: Re-seeding dashboard data submissions for these elements...")

    async with async_session() as db:
        # Clear existing submissions for company 1 (Apex)
        await db.execute(text("DELETE FROM data_submissions WHERE company_id = 1;"))
        await db.commit()

        # Query updated company, sites, elements, and admin
        sites = (await db.execute(select(Site).where(Site.company_id == 1))).scalars().all()
        elements = (await db.execute(select(DataElement))).scalars().all()
        admin = (await db.execute(select(User).where(User.email == "admin@apex.demo"))).scalars().first()
        admin_id = admin.id if admin else None

        # Group all data elements by synthetic category
        cat_to_elements = {}
        for e in elements:
            cat = get_synthetic_category(e.name, e.category)
            if cat not in cat_to_elements:
                cat_to_elements[cat] = []
            cat_to_elements[cat].append(e)

        # Target monthly values for Site 1 and Site 2
        target_monthly_vals = {
            'Energy':            {1: 1300.0, 2: 1100.0},
            'Water':             {1: 1100.0, 2: 900.0},
            'Waste':             {1: 950.0,  2: 750.0},
            'Fuel':              {1: 500.0,  2: 400.0},
            'Environment Other': {1: 2100.0, 2: 1800.0},
            'Social':            {1: 2600.0, 2: 2100.0},
            'Governance':        {1: 1900.0, 2: 1500.0}
        }

        months = [1, 2, 3, 4, 5, 6]
        year = 2026
        seeded_count = 0

        # For each site
        for site in sites:
            site_key = 1 if "marina" in site.name.lower() else 2
            
            # For each synthetic category
            for cat, site_targets in target_monthly_vals.items():
                target_base = site_targets[site_key]
                
                # Pick the first element of this category
                possible_elements = cat_to_elements.get(cat, [])
                if not possible_elements:
                    possible_elements = [e for e in elements if e.category == cat[0]]
                if not possible_elements:
                    continue
                    
                element = possible_elements[0]
                
                # Find the corresponding meter for this element and site
                meter = (await db.execute(
                    select(Meter).where(
                        Meter.site_id == site.id,
                        Meter.data_element_id == element.id,
                        Meter.is_active == True
                    )
                )).scalars().first()
                meter_id = meter.id if meter else None

                print(f"Seeding {cat} for {site.name} -> Element: '{element.name}', Meter: {meter_id}")

                # Seed each month
                for month in months:
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
                        notes=f"Simulated {cat} data submission"
                    ))
                    seeded_count += 1

        await db.commit()
        print(f"Data alignment complete. Successfully seeded {seeded_count} submissions matching active Data Entry rows!")

if __name__ == "__main__":
    asyncio.run(main())
