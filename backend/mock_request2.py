import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from app.core.config import settings
from app.api.endpoints.auth import register_user
from app.schemas.user import UserCreate

async def test_reg():
    engine = create_async_engine('sqlite+aiosqlite:///./esg_portal.db')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        # We need a fresh email each time to bypass the 400 'already exists' error
        user_in = UserCreate(email="blerg2@example.com", password="pwd", first_name="Blerg", last_name="Blarg", is_active=True)
        try:
            user = await register_user(db=db, user_in=user_in)
            print(f"Success! {user.email}")
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(test_reg())
