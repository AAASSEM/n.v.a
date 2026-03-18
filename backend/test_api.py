import asyncio
import httpx

async def test():
    async with httpx.AsyncClient() as client:
        res = await client.get('http://localhost:8000/api/v1/health')
        print(f"Health: {res.status_code}")
