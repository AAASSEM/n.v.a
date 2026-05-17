import asyncio
from app.db.session import async_session
from app.services.platform_service import platform_service

async def run():
    async with async_session() as db:
        try:
            res = await platform_service.seed_demo_property(db, 'Test', 'Test')
            print(res)
        except Exception as e:
            import traceback
            traceback.print_exc()

asyncio.run(run())
