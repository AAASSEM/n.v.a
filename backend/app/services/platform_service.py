import random
import datetime
from typing import Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.models.company import Company
from app.models.user import User, UserProfile
from app.models.data_element import DataElement
from app.models.submission import DataSubmission
from app.models.system import SystemSetting, AuditLog

class PlatformService:
    @staticmethod
    async def get_system_setting(db: AsyncSession, key: str, default: Any = None) -> Any:
        """Fetch a single system setting value."""
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        setting = result.scalars().first()
        return setting.value if setting else default

    @staticmethod
    async def get_system_settings(db: AsyncSession) -> Dict[str, Any]:
        """Fetch all platform-wide system settings as a dictionary."""
        result = await db.execute(select(SystemSetting))
        settings = result.scalars().all()
        return {s.key: s.value for s in settings}

    @staticmethod
    async def set_system_setting(db: AsyncSession, key: str, value: Any, description: str = None) -> SystemSetting:
        """Update or create a platform-wide system setting."""
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        setting = result.scalars().first()
        if setting:
            setting.value = value
            if description:
                setting.description = description
        else:
            setting = SystemSetting(key=key, value=value, description=description)
            db.add(setting)
        await db.commit()
        await db.refresh(setting)
        return setting

    @staticmethod
    async def get_platform_stats(db: AsyncSession) -> Dict[str, Any]:
        """Comprehensive statistics across the entire engine."""
        comp_count = await db.execute(select(func.count()).select_from(Company))
        user_count = await db.execute(select(func.count()).select_from(User))
        elem_count = await db.execute(select(func.count()).select_from(DataElement))
        
        # Growth: Entities created in the last 30 days
        last_30_days = datetime.datetime.utcnow() - datetime.timedelta(days=30)
        recent_users = await db.execute(select(func.count()).select_from(User).where(User.created_at >= last_30_days))
        
        # Data Coverage: Active Submissions
        total_subs = await db.execute(select(func.count()).select_from(DataSubmission))
        
        # Evidence Metrics
        # Note: In Postgres, comparing JSONB/JSON to '[]' (string) might vary by driver.
        # We'll use a safer check for non-empty evidence.
        evidence_count = await db.execute(
            select(func.count()).select_from(DataSubmission).where(
                DataSubmission.evidence_files != None,
                DataSubmission.evidence_files != '[]'
            )
        )
        
        return {
            "total_nodes": comp_count.scalar(),
            "total_identities": user_count.scalar(),
            "total_metric_definitions": elem_count.scalar(),
            "growth_30d": recent_users.scalar(),
            "total_data_points": total_subs.scalar(),
            "evidence_doc_count": evidence_count.scalar()
        }

    @staticmethod
    async def seed_demo_property(db: AsyncSession, company_name: str, admin_email: str) -> Dict[str, Any]:
        """Seed a fully-populated demo company for sales/demo purposes."""
        # 1. Create Company
        new_company = Company(
            name=company_name, 
            emirate="Dubai", 
            sector="Hospitality",
            active_frameworks={"mandatory": ["DST_BASIC"], "voluntary": ["GREEN_KEY"]}
        )
        db.add(new_company)
        await db.flush() # Get ID
        
        # 2. Create Admin User
        from app.core.security import get_password_hash
        new_user = User(
            email=admin_email,
            hashed_password=get_password_hash("demo123"), # Hardcoded for demo/seed
            first_name="Demo",
            last_name="Manager",
            is_active=True,
            email_verified=True
        )
        db.add(new_user)
        await db.flush()
        
        new_profile = UserProfile(user_id=new_user.id, company_id=new_company.id, role="admin")
        db.add(new_profile)
        
        # 3. Seed some random data for the last 6 months
        elements = (await db.execute(select(DataElement))).scalars().all()
        if not elements:
            return {"msg": "No data elements in library. Seeding failed."}
            
        current_year = datetime.datetime.utcnow().year
        for month in range(1, 7):
            for el in elements:
                # Randomly populate ~70% as filled
                if random.random() > 0.3:
                    sub = DataSubmission(
                        company_id=new_company.id,
                        data_element_id=el.id,
                        year=current_year,
                        month=month,
                        value=float(random.uniform(500, 5000)),
                        unit=el.unit or "Units",
                        submitted_by=new_user.id
                    )
                    db.add(sub)
        
        await db.commit()
        return {"msg": f"Demo property '{company_name}' seeded successfully - Credentials: {admin_email} / demo123"}

platform_service = PlatformService()
