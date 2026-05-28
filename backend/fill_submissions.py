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
from app.models.company import Company, Site
from app.models.meter import Meter
from app.models.submission import DataSubmission

async def main():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    print("Filling data submissions for Jan 2026 to May 2026...")
    
    async with async_session() as db:
        # Get all meters
        meters = (await db.execute(select(Meter))).scalars().all()
        print(f"Found {len(meters)} meters in the database.")
        
        # We need an admin user ID for submitted_by (optional)
        from app.models.user import User
        admin = (await db.execute(select(User).where(User.email.like("%admin%")))).scalars().first()
        admin_id = admin.id if admin else None
        
        seeded_count = 0
        
        # We want Jan 2026 to May 2026
        target_months = [
            (2026, 1),
            (2026, 2),
            (2026, 3),
            (2026, 4),
            (2026, 5)
        ]
        
        for m in meters:
            random.seed(m.id + 100) # Deterministic but different per meter
            
            # Determine base value based on meter type
            m_type = (m.meter_type or "").lower()
            if "electricity" in m_type or "energy" in m_type:
                base_val = random.randint(3000, 6000)
            elif "water" in m_type:
                base_val = random.randint(1500, 4000)
            elif "waste" in m_type:
                base_val = random.randint(100, 800)
            elif "fuel" in m_type or "diesel" in m_type or "petrol" in m_type:
                base_val = random.randint(500, 2000)
            else:
                base_val = random.randint(200, 1000)
                
            for year, month in target_months:
                # Check if submission already exists
                existing = (await db.execute(
                    select(DataSubmission).where(
                        DataSubmission.company_id == m.company_id,
                        DataSubmission.site_id == m.site_id,
                        DataSubmission.meter_id == m.id,
                        DataSubmission.year == year,
                        DataSubmission.month == month
                    )
                )).scalars().first()
                
                if not existing:
                    # Generate random variance (-15% to +15%)
                    variance = random.uniform(-0.15, 0.15)
                    val = round(base_val * (1 + variance), 2)
                    
                    db.add(DataSubmission(
                        company_id=m.company_id,
                        site_id=m.site_id,
                        data_element_id=m.data_element_id,
                        meter_id=m.id,
                        year=year,
                        month=month,
                        value=val,
                        submitted_by=admin_id,
                        notes="Auto-seeded for dashboard (Jan-May 2026)"
                    ))
                    seeded_count += 1
                    
        await db.commit()
        print(f"Successfully seeded {seeded_count} data submissions for Jan-May 2026.")

if __name__ == "__main__":
    asyncio.run(main())
