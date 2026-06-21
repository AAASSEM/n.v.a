import asyncio
from httpx import AsyncClient
from app.main import app
import traceback

async def test():
    try:
        async with AsyncClient(app=app, base_url='http://test') as ac:
            response = await ac.get('/api/v1/auth/me', headers={'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODI2ODMzMjAsInN1YiI6IjMifQ.bWB8TzHi0lW0NPMcibY5FrurBpqXhBITWopLVU3zGoo'})
            print(response.status_code)
            print(response.text)
    except Exception as e:
        traceback.print_exc()

asyncio.run(test())
