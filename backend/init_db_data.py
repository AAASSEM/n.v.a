import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

from app.core.config import settings
from app.core import security
from app.models.user import User, UserProfile
from app.core.permissions import Role

async def init_dev_user():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as db:
        # Check if user exists
        result = await db.execute(select(User).where(User.email == "admin@esgportal.com"))
        user = result.scalars().first()
        
        if not user:
            print("Creating dev admin user...")
            user = User(
                email="admin@esgportal.com",
                password_hash=security.get_password_hash("admin123"),
                first_name="Admin",
                last_name="User",
                is_active=True,
                email_verified=True
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            
            profile = UserProfile(
                user_id=user.id,
                role=Role.SUPER_USER
            )
            db.add(profile)
            await db.commit()
            print("Dev user created! admin@esgportal.com / admin123")
        else:
            print("Dev user already exists.")

if __name__ == "__main__":
    asyncio.run(init_dev_user())
