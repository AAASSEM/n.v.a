import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from app.core.config import settings
from app.models.framework import Framework

async def seed_frameworks():
    engine = create_async_engine('sqlite+aiosqlite:///./esg_portal.db')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    frameworks_to_add = [
        {"framework_id": "ESG", "name": "Environment Social Governance", "type": "mandatory", "description": "Core ESG requirements"},
        {"framework_id": "DST", "name": "Dubai Sustainable Tourism", "type": "voluntary", "description": "Dubai Tourism sustainability standard"},
        {"framework_id": "GREEN KEY", "name": "Green Key", "type": "voluntary", "description": "Green Key eco-label standard"}
    ]
    
    async with async_session() as db:
        for fw_data in frameworks_to_add:
            stmt = select(Framework).where(Framework.framework_id == fw_data['framework_id'])
            existing = (await db.execute(stmt)).scalars().first()
            if not existing:
                print(f"Adding Framework: {fw_data['framework_id']}")
                new_fw = Framework(**fw_data)
                db.add(new_fw)
            else:
                existing.name = fw_data['name']
                existing.description = fw_data['description']
                print(f"Framework updated: {fw_data['framework_id']}")
        
        await db.commit()
        print("Frameworks seeded successfully.")

asyncio.run(seed_frameworks())
