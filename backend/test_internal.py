import asyncio
import json
from app.db.session import SessionLocal
from app.api.endpoints.dashboard import get_dashboard_metrics

async def main():
    db = SessionLocal()
    try:
        # Assuming company_id=1, user_id=1, site_id=1 exists
        res = await get_dashboard_metrics(db=db, company_id=1, pillar='E', site_id=1)
        
        for stat in res.get('stats', []):
            print(f"--- {stat['name']} ---")
            elements = stat.get('contributing_elements', [])
            print(f"Elements: {len(elements)}")
            for e in elements:
                print(f"  {e['name']}: {e['value']} {e['unit']}")
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(main())
