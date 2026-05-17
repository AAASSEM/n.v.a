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
        from sqlalchemy import delete
        from app.models.company import Site
        from app.core.security import get_password_hash
        import secrets

        # 0. Clean old demo data (Explicitly delete to avoid SQLite PRAGMA missing cascade issues)
        from app.models.submission import DataSubmission
        from app.models.meter import Meter
        await db.execute(delete(DataSubmission))
        await db.execute(delete(Meter))
        await db.execute(delete(Site))
        
        # Delete UserProfiles for non-developer users
        user_profiles_query = select(UserProfile.id).join(User).where(User.is_developer == False)
        result = await db.execute(user_profiles_query)
        profile_ids = [row for row in result.scalars()]
        if profile_ids:
            from sqlalchemy import delete as sa_delete
            await db.execute(sa_delete(UserProfile).where(UserProfile.id.in_(profile_ids)))
            
        await db.execute(delete(User).where(User.is_developer == False))
        await db.execute(delete(Company))
        await db.flush()

        # 1. Create Company
        comp_code = secrets.token_hex(4).upper()
        new_company = Company(
            name="Apex Hotels Group (Demo)", 
            company_code=comp_code,
            emirate="Dubai", 
            sector="Hospitality",
            active_frameworks=["ESG", "DST", "GREEN KEY"],
            has_green_key=True
        )
        db.add(new_company)
        await db.flush() # Get ID
        
        # 2. Create Sites
        site_dubai = Site(company_id=new_company.id, name="Apex Downtown Dubai", location="Dubai", sector="Hospitality", is_active=True)
        site_auh = Site(company_id=new_company.id, name="Apex Resort Abu Dhabi", location="AbuDhabi", sector="Hospitality", is_active=True)
        db.add_all([site_dubai, site_auh])
        await db.flush()
        
        # 3. Create Users
        # Company Admin (no site_id)
        u_admin = User(email="admin@apex-demo.com", password_hash=get_password_hash("demo123"), first_name="Company", last_name="Admin", is_active=True, email_verified=True)
        db.add(u_admin)
        await db.flush()
        db.add(UserProfile(user_id=u_admin.id, company_id=new_company.id, role="admin"))

        # Site Manager (Dubai)
        u_mgr = User(email="manager.dxb@apex-demo.com", password_hash=get_password_hash("demo123"), first_name="Dubai", last_name="Manager", is_active=True, email_verified=True)
        db.add(u_mgr)
        await db.flush()
        db.add(UserProfile(user_id=u_mgr.id, company_id=new_company.id, site_id=site_dubai.id, role="site_manager"))

        # Data Entry (Abu Dhabi)
        u_entry = User(email="entry.auh@apex-demo.com", password_hash=get_password_hash("demo123"), first_name="AbuDhabi", last_name="DataEntry", is_active=True, email_verified=True)
        db.add(u_entry)
        await db.flush()
        db.add(UserProfile(user_id=u_entry.id, company_id=new_company.id, site_id=site_auh.id, role="uploader"))

        # 4. Seed basic Meters for the sites
        from app.models.meter import Meter
        elements = (await db.execute(select(DataElement))).scalars().all()
        
        el_elec = next((e for e in elements if e.meter_type == "Electricity"), None)
        el_water = next((e for e in elements if e.meter_type == "Water"), None)
        
        meters = []
        if el_elec:
            meters.append(Meter(company_id=new_company.id, site_id=site_dubai.id, data_element_id=el_elec.id, meter_type="Electricity", name="DXB Main Grid", is_active=True))
            meters.append(Meter(company_id=new_company.id, site_id=site_auh.id, data_element_id=el_elec.id, meter_type="Electricity", name="AUH Main Grid", is_active=True))
        if el_water:
            meters.append(Meter(company_id=new_company.id, site_id=site_dubai.id, data_element_id=el_water.id, meter_type="Water", name="DXB Mains Water", is_active=True))
            meters.append(Meter(company_id=new_company.id, site_id=site_auh.id, data_element_id=el_water.id, meter_type="Water", name="AUH Mains Water", is_active=True))
            
        db.add_all(meters)
        await db.flush()
        
        # 5. Seed Submissions
        current_year = datetime.datetime.utcnow().year
        
        for site in [site_dubai, site_auh]:
            for month in range(1, 7):
                for el in elements:
                    if random.random() > 0.3:
                        meter_id = None
                        if el.is_metered:
                            m_match = [m for m in meters if m.site_id == site.id and m.meter_type == el.meter_type]
                            if m_match:
                                meter_id = m_match[0].id

                        sub = DataSubmission(
                            company_id=new_company.id,
                            site_id=site.id,
                            data_element_id=el.id,
                            meter_id=meter_id,
                            year=current_year,
                            month=month,
                            value=float(random.uniform(50, 500)),
                            unit=el.unit or "Units",
                            submitted_by=u_admin.id
                        )
                        db.add(sub)
        
        await db.commit()
        return {"msg": f"Demo completely wiped and recreated! Demo Users: admin@apex-demo.com, manager.dxb@apex-demo.com, entry.auh@apex-demo.com. (Password: demo123)"}

platform_service = PlatformService()
