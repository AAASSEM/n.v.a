
import asyncio
import sys
import os
from pathlib import Path

# Fix pathing to find 'app' module
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete
from app.models.user import User, UserProfile
from app.core import security
from app.core.config import settings
from app.core.permissions import Role

async def cleanup_and_seed():
    db_path = BASE_DIR / "esg_portal.db"
    db_uri = f"sqlite+aiosqlite:///{db_path}"
    print(f"Connecting to database at: {db_path}")
    
    engine = create_async_engine(db_uri)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # 1. Find the keep-user
        result = await session.execute(
            select(User).where(User.email == "aaa136@gmail.com")
        )
        keep_user = result.scalars().first()
        
        if not keep_user:
            print("Error: User aaa136@gmail.com not found.")
            res = await session.execute(select(User))
            users = res.scalars().all()
            print("Available users:", [u.email for u in users])
            return

        result = await session.execute(
            select(UserProfile).where(UserProfile.user_id == keep_user.id)
        )
        keep_profile = result.scalars().first()
        
        if not keep_profile:
            print("Error: User aaa136@gmail.com has no profile.")
            return
            
        company_id = keep_profile.company_id
        print(f"Keeping user {keep_user.email} (ID: {keep_user.id}) in company ID: {company_id}")

        # 2. Delete ALL other users and profiles
        # Delete profiles first to be safe (though cascade should handle it)
        await session.execute(
            delete(UserProfile).where(UserProfile.user_id != keep_user.id)
        )
        await session.execute(
            delete(User).where(User.id != keep_user.id)
        )
        await session.flush()
        print("Cleanup complete.")

        # 3. Add users with all roles
        roles_to_add = [
            Role.ADMIN,
            Role.SITE_MANAGER,
            Role.UPLOADER,
            Role.VIEWER,
            Role.METER_MANAGER
        ]
        
        for role in roles_to_add:
            email = f"{role.value}@example.com"
            print(f"Adding user {email}...")
            
            new_user = User(
                email=email,
                password_hash=security.get_password_hash("password123"),
                first_name=role.value.replace("_", " ").title(),
                last_name="Test",
                is_active=True,
                email_verified=True
            )
            session.add(new_user)
            await session.flush() # Get ID
            
            new_profile = UserProfile(
                user_id=new_user.id,
                company_id=company_id,
                role=role.value,
                must_reset_password=False
            )
            session.add(new_profile)
            await session.flush()
            print(f"Successfully added {role.value}")

        await session.commit()
        print("Final Success!")

if __name__ == "__main__":
    asyncio.run(cleanup_and_seed())
