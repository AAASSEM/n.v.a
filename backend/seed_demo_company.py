"""Seed a demo hospitality company with two fully-isolated sites.

Company: Green Horizon Hospitality (ESG + Green Key)
Sites:
  - Dubai Marina Resort
  - Abu Dhabi Downtown Hotel

Users (8 total, password = Demo1234!):
  - admin@greenhorizon.demo           ADMIN (company-wide, site_id=NULL)
  - manager.a@greenhorizon.demo       SITE_MANAGER @ Site A
  - uploader.a1@greenhorizon.demo     UPLOADER     @ Site A
  - uploader.a2@greenhorizon.demo     UPLOADER     @ Site A
  - viewer.a@greenhorizon.demo        VIEWER       @ Site A
  - manager.b@greenhorizon.demo       SITE_MANAGER @ Site B
  - meter.b@greenhorizon.demo         METER_MANAGER @ Site B
  - viewer.b@greenhorizon.demo        VIEWER       @ Site B

Per-site seed actions:
  - Submit a distinct set of profiling answers (so each site's checklist differs).
  - Trigger the profiling service to auto-generate the site's checklist + main meters.
  - Add one custom sub-meter to prove independence.
  - Insert 3 months of DataSubmission values to light up the dashboard.

Idempotent — re-running skips existing users, sites, answers, and submissions.
"""
import asyncio
import datetime
import random
from typing import Dict

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

from app.core.config import settings
from app.core import security
from app.core.permissions import Role
from app.models.user import User, UserProfile
from app.models.company import Company, Site
from app.models.profiling import ProfilingQuestion, CompanyProfileAnswer
from app.models.data_element import DataElement
from app.models.meter import Meter
from app.models.submission import DataSubmission
from app.models.system import AuditLog
from app.models.checklist import CompanyChecklist
from app.services.profiling_service import ProfilingService



def get_synthetic_category(name: str, db_cat: str) -> str:
    n = name.lower()
    if 'water' in n: return 'Water'
    if 'waste' in n or 'recycling' in n or 'compost' in n: return 'Waste'
    if 'fuel' in n or 'diesel' in n or 'petrol' in n or 'vehicles' in n: return 'Fuel'
    if 'energy' in n or 'electricity' in n or 'lighting' in n or 'carbon' in n: return 'Energy'
    if db_cat == 'E': return 'Environment Other'
    if db_cat == 'S': return 'Social'
    if db_cat == 'G': return 'Governance'
    return 'Other'

COMPANY_NAME = "Apex"
COMPANY_CODE = "APEX01"

USERS = [
    # email, first, last, role, site_key (None = company-wide)
    ("super@apex.demo",      "Sam",   "Super",    Role.SUPER_USER.value,    None),
    ("admin@apex.demo",      "Alex",  "Admin",    Role.ADMIN.value,         None),
    ("regional@apex.demo",   "Reggie","Region",   Role.SITE_MANAGER.value,  None),  # Site manager for BOTH sites
    ("manager.a@apex.demo",  "Mona",  "Marina",   Role.SITE_MANAGER.value,  "A"),
    ("manager.b@apex.demo",  "Majid", "Downtown", Role.SITE_MANAGER.value,  "B"),
    ("uploader.a1@apex.demo","Usama", "Upload 1", Role.UPLOADER.value,      "A"),
    ("uploader.a2@apex.demo","Ursula","Upload 2", Role.UPLOADER.value,      "A"),
    ("uploader.b1@apex.demo","Umar",  "Upload B", Role.UPLOADER.value,      "B"),
    ("meter.a@apex.demo",    "Mark",  "Metric A", Role.METER_MANAGER.value, "A"),
    ("meter.b@apex.demo",    "Mira",  "Metric B", Role.METER_MANAGER.value, "B"),
    ("viewer.a@apex.demo",   "Vera",  "Viewer A", Role.VIEWER.value,        "A"),
    ("viewer.b@apex.demo",   "Vikram","Viewer B", Role.VIEWER.value,        "B"),
]

# Site-specific profiling answers — keyed by lowercase question_text substring.
# Answers NOT listed default to False.
SITE_ANSWERS = {
    "A": {
        "district cooling service": True,
        "cooking gas": True,
        "segregate and recycle": True,
        "petrol-fueled vehicles": True,
        "diesel fuel": True,
        "diesel backup generators": True,
        "refrigerant": True,
        "value chain emissions": True,
        "carbon offsets": True,
        "hazardous waste": True,
        "renewable sources": True,
        "donations to the community": True,
        "selecting or evaluating": True,
        "diesel-fueled vehicles or generators": True,
        "reduce your carbon footprint": True,
        "water meters for high": True,
        "use or purchase renewable": True,
        "automatic systems": True,
        "track your recycling": True,
        "compost your organic": True,
        "collaborate with local": True,
        "purchase eco-labeled": True,
    },
    "B": {
        "district cooling service": True,
        "cooking gas": True,
        "segregate and recycle": True,
        "petrol-fueled vehicles": True,
        "diesel fuel": True,
        "diesel backup generators": True,
        "refrigerant": True,
        "value chain emissions": True,
        "carbon offsets": True,
        "hazardous waste": True,
        "renewable sources": True,
        "donations to the community": True,
        "selecting or evaluating": True,
        "diesel-fueled vehicles or generators": True,
        "reduce your carbon footprint": True,
        "water meters for high": True,
        "use or purchase renewable": True,
        "automatic systems": True,
        "track your recycling": True,
        "compost your organic": True,
        "collaborate with local": True,
        "purchase eco-labeled": True,
    }
}


def _build_answer_list(questions, answers_for_site: Dict[str, bool]):
    out = []
    for q in questions:
        t = q.question_text.lower()
        answer = False
        for key, val in answers_for_site.items():
            if key in t:
                answer = val
                break
        out.append({"question_id": q.id, "answer": answer})
    return out


async def _get_or_create_user(db, email, first, last, role, company_id, site_id):
    user = (await db.execute(select(User).where(User.email == email))).scalars().first()
    if not user:
        user = User(
            email=email,
            password_hash=security.get_password_hash("Demo1234!"),
            first_name=first,
            last_name=last,
            is_active=True,
            email_verified=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Make sure a profile exists and is correctly wired to this company/site.
    profile = (await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))).scalars().first()
    if not profile:
        db.add(UserProfile(
            user_id=user.id,
            company_id=company_id,
            role=role,
            site_id=site_id,
            must_reset_password=False,
        ))
        print(f"  + user {email}  role={role}  site={site_id}")
    else:
        updated = False
        if profile.company_id != company_id:
            profile.company_id = company_id
            updated = True
        if profile.role != role:
            profile.role = role
            updated = True
        if profile.site_id != site_id:
            profile.site_id = site_id
            updated = True
        if updated:
            print(f"  · user {email}  updated profile → role={role} site={site_id}")
    await db.commit()
    return user


async def seed_demo():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # 1. Company
        company = (await db.execute(select(Company).where(Company.company_code == COMPANY_CODE))).scalars().first()
        if not company:
            # Need an owner user first
            admin_user = (await db.execute(select(User).where(User.email == USERS[0][0]))).scalars().first()
            if not admin_user:
                admin_user = User(
                    email=USERS[0][0],
                    password_hash=security.get_password_hash("Demo1234!"),
                    first_name=USERS[0][1],
                    last_name=USERS[0][2],
                    is_active=True,
                    email_verified=True,
                )
                db.add(admin_user)
                await db.commit()
                await db.refresh(admin_user)
            company = Company(
                owner_id=admin_user.id,
                name=COMPANY_NAME,
                company_code=COMPANY_CODE,
                emirate="Dubai",
                sector="Hospitality",
                active_frameworks=["ESG", "DST", "GREEN KEY"],
                has_green_key=True,
            )
            db.add(company)
            await db.commit()
            await db.refresh(company)
            print(f"[demo] created company id={company.id}: {company.name}")
        else:
            print(f"[demo] company already exists id={company.id}")

        # 2. Sites
        sites: Dict[str, Site] = {}
        desired = [
            ("A", "Dubai Marina Resort",      "DUBAI"),
            ("B", "Abu Dhabi Downtown Hotel", "Abu DHABI"),
        ]
        for key, name, loc in desired:
            site = (await db.execute(
                select(Site).where(Site.company_id == company.id, Site.name == name)
            )).scalars().first()
            if not site:
                site = Site(company_id=company.id, name=name, location=loc, is_active=True)
                db.add(site)
                await db.commit()
                await db.refresh(site)
                print(f"  + site {name}")
            sites[key] = site

        # 3. Users
        for (email, first, last, role, site_key) in USERS:
            site_id = sites[site_key].id if site_key else None
            await _get_or_create_user(db, email, first, last, role, company.id, site_id)

        # Make sure the admin user's profile points at this company
        admin = (await db.execute(
            select(User).where(User.email == USERS[0][0])
        )).scalars().first()
        prof = (await db.execute(
            select(UserProfile).where(UserProfile.user_id == admin.id)
        )).scalars().first()
        if prof and prof.company_id != company.id:
            prof.company_id = company.id
            await db.commit()

        # 4. Profiling answers + checklist generation per site
        questions = (await db.execute(
            select(ProfilingQuestion).order_by(ProfilingQuestion.question_order)
        )).scalars().all()
        if not questions:
            print("[demo] WARNING: no profiling questions seeded — run seed_questions first")
        else:
            for key, site in sites.items():
                existing_answers = (await db.execute(
                    select(CompanyProfileAnswer).where(
                        CompanyProfileAnswer.company_id == company.id,
                        CompanyProfileAnswer.site_id == site.id,
                    )
                )).scalars().all()
                if existing_answers:
                    print(f"  · site {site.name}: onboarding already complete ({len(existing_answers)} answers)")
                    continue
                answer_list = _build_answer_list(questions, SITE_ANSWERS[key])
                await ProfilingService.generate_checklist(
                    company_id=company.id,
                    site_id=site.id,
                    answers=answer_list,
                    db=db,
                )
                print(f"  [OK] site {site.name}: onboarded, checklist generated")

        # 5. One custom sub-meter per site (for an electricity element if present)
        el = (await db.execute(
            select(DataElement).where(DataElement.is_metered == True).limit(1)
        )).scalars().first()
        if el:
            for key, site in sites.items():
                name = f"Sub-Meter Wing {key}"
                exists = (await db.execute(
                    select(Meter).where(
                        Meter.company_id == company.id,
                        Meter.site_id == site.id,
                        Meter.name == name,
                    )
                )).scalars().first()
                if not exists:
                    db.add(Meter(
                        company_id=company.id,
                        site_id=site.id,
                        data_element_id=el.id,
                        name=name,
                        meter_type=el.meter_type or el.category,
                        location=f"Tower {key}",
                    ))
            await db.commit()

        # 6. Simulate historical dashboard data matched to the site checklists
        from sqlalchemy import text
        print("[demo] seeding historical submissions...")
        # Clear existing submissions first
        await db.execute(text("DELETE FROM data_submissions WHERE company_id = :cid"), {"cid": company.id})
        
        target_monthly_vals = {
            'Energy':            {1: 1300.0, 2: 1100.0},
            'Water':             {1: 1100.0, 2: 900.0},
            'Waste':             {1: 950.0,  2: 750.0},
            'Fuel':              {1: 500.0,  2: 400.0},
            'Environment Other': {1: 2100.0, 2: 1800.0},
            'Social':            {1: 2600.0, 2: 2100.0},
            'Governance':        {1: 1900.0, 2: 1500.0}
        }
        
        months = [1, 2, 3, 4, 5]  # Jan to May 2026
        year = 2026
        seeded_count = 0
        
        for key, site in sites.items():
            site_key = 1 if key == "A" else 2
            
            checklist_items_q = (await db.execute(
                select(CompanyChecklist).where(CompanyChecklist.site_id == site.id)
            )).scalars().all()
            
            active_elements = []
            for item in checklist_items_q:
                el = await db.get(DataElement, item.data_element_id)
                if el:
                    active_elements.append(el)
                    
            cat_to_active = {}
            for el in active_elements:
                cat = get_synthetic_category(el.name, el.category)
                if cat not in cat_to_active:
                    cat_to_active[cat] = []
                cat_to_active[cat].append(el)
                
            for cat, site_targets in target_monthly_vals.items():
                target_base = site_targets[site_key]
                possible_elements = cat_to_active.get(cat, [])
                if not possible_elements:
                    continue
                    
                element = possible_elements[0]
                meter = (await db.execute(
                    select(Meter).where(
                        Meter.site_id == site.id,
                        Meter.data_element_id == element.id,
                        Meter.is_active == True
                    )
                )).scalars().first()
                meter_id = meter.id if meter else None
                
                for month in months:
                    variance = random.uniform(-0.15, 0.15)
                    value = round(target_base * (1 + variance), 2)
                    db.add(DataSubmission(
                        company_id=company.id,
                        site_id=site.id,
                        data_element_id=element.id,
                        meter_id=meter_id,
                        year=year,
                        month=month,
                        value=value,
                        submitted_by=admin.id if admin else None,
                        notes=f"Simulated historical {cat} data entry"
                    ))
                    seeded_count += 1
        await db.commit()
        print(f"  · site submissions: inserted {seeded_count} checklist-matched submissions")

        # 6.5 Assign checklist items to demo users
        print("[demo] assigning checklist items to users...")
        from sqlalchemy.orm import selectinload
        for key, site in sites.items():
            checklist_items_res = await db.execute(
                select(CompanyChecklist)
                .options(selectinload(CompanyChecklist.data_element))
                .where(
                    CompanyChecklist.company_id == company.id,
                    CompanyChecklist.site_id == site.id
                )
            )
            checklist_items = checklist_items_res.scalars().all()
            
            site_users_res = await db.execute(
                select(User)
                .join(UserProfile)
                .where(
                    UserProfile.company_id == company.id,
                    UserProfile.site_id == site.id
                )
            )
            site_users = {u.email: u for u in site_users_res.scalars().all()}
            
            assigned_count = 0
            if key == "A":
                uploader_1 = site_users.get("uploader.a1@apex.demo")
                uploader_2 = site_users.get("uploader.a2@apex.demo")
                meter_user = site_users.get("meter.a@apex.demo")
                
                for item in checklist_items:
                    if not item.data_element:
                        continue
                    cat = item.data_element.category.upper()
                    if cat == "E" and uploader_1:
                        item.assigned_to = uploader_1.id
                        db.add(item)
                        assigned_count += 1
                    elif cat == "S" and uploader_2:
                        item.assigned_to = uploader_2.id
                        db.add(item)
                        assigned_count += 1
                    elif cat == "G" and meter_user:
                        item.assigned_to = meter_user.id
                        db.add(item)
                        assigned_count += 1
            elif key == "B":
                uploader_b = site_users.get("uploader.b1@apex.demo")
                meter_b = site_users.get("meter.b@apex.demo")
                
                for item in checklist_items:
                    if not item.data_element:
                        continue
                    cat = item.data_element.category.upper()
                    if cat == "E" and uploader_b:
                        item.assigned_to = uploader_b.id
                        db.add(item)
                        assigned_count += 1
                    elif (cat == "S" or cat == "G") and meter_b:
                        item.assigned_to = meter_b.id
                        db.add(item)
                        assigned_count += 1
            print(f"  · site {site.name}: assigned {assigned_count} checklist items to users")
        await db.commit()

        # 7. Seed demo AuditLog records
        print("[demo] seeding audit log records...")
        
        # Check if audit logs already exist to make it idempotent
        existing_logs = (await db.execute(select(AuditLog).limit(1))).scalars().first()
        if not existing_logs:
            # Let's retrieve the users to use their real user IDs
            users_res = await db.execute(select(User))
            db_users = {u.email: u for u in users_res.scalars().all()}
            
            # Let's fetch sites to use their real site IDs
            sites_res = await db.execute(select(Site))
            db_sites = {s.name: s for s in sites_res.scalars().all()}
            
            # Seed logs
            logs_to_add = [
                # Super User / Admin actions
                {
                    "email": "super@apex.demo",
                    "action": "LOGIN",
                    "entity_type": "USER",
                    "details": {"email": "super@apex.demo", "method": "password"},
                    "ip_address": "192.168.1.10",
                    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "created_at": datetime.datetime.utcnow() - datetime.timedelta(days=10)
                },
                {
                    "email": "super@apex.demo",
                    "action": "CREATE_COMPANY",
                    "entity_type": "COMPANY",
                    "details": {"name": COMPANY_NAME, "sector": "hospitality", "emirate": "dubai"},
                    "ip_address": "192.168.1.10",
                    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "created_at": datetime.datetime.utcnow() - datetime.timedelta(days=9, hours=23)
                },
                {
                    "email": "super@apex.demo",
                    "action": "CREATE_SITE",
                    "entity_type": "SITE",
                    "details": {"name": "Dubai Marina Resort", "location": "Dubai", "sector": "hospitality"},
                    "ip_address": "192.168.1.10",
                    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "created_at": datetime.datetime.utcnow() - datetime.timedelta(days=9, hours=22)
                },
                {
                    "email": "super@apex.demo",
                    "action": "CREATE_SITE",
                    "entity_type": "SITE",
                    "details": {"name": "Abu Dhabi Downtown Hotel", "location": "Abu Dhabi", "sector": "hospitality"},
                    "ip_address": "192.168.1.10",
                    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "created_at": datetime.datetime.utcnow() - datetime.timedelta(days=9, hours=21)
                },
                {
                    "email": "super@apex.demo",
                    "action": "INVITE_USER",
                    "entity_type": "USER",
                    "details": {"email": "admin@apex.demo", "role": "admin", "site_id": None},
                    "ip_address": "192.168.1.10",
                    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "created_at": datetime.datetime.utcnow() - datetime.timedelta(days=9, hours=20)
                },
                {
                    "email": "admin@apex.demo",
                    "action": "INVITE_USER",
                    "entity_type": "USER",
                    "details": {"email": "manager.a@apex.demo", "role": "site_manager", "site_id": db_sites.get("Dubai Marina Resort").id if db_sites.get("Dubai Marina Resort") else None},
                    "ip_address": "192.168.1.15",
                    "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
                    "created_at": datetime.datetime.utcnow() - datetime.timedelta(days=8)
                },
                {
                    "email": "admin@apex.demo",
                    "action": "INVITE_USER",
                    "entity_type": "USER",
                    "details": {"email": "uploader.a1@apex.demo", "role": "uploader", "site_id": db_sites.get("Dubai Marina Resort").id if db_sites.get("Dubai Marina Resort") else None},
                    "ip_address": "192.168.1.15",
                    "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
                    "created_at": datetime.datetime.utcnow() - datetime.timedelta(days=7)
                },
                {
                    "email": "manager.a@apex.demo",
                    "action": "LOGIN",
                    "entity_type": "USER",
                    "details": {"email": "manager.a@apex.demo", "method": "magic_link"},
                    "ip_address": "10.0.0.4",
                    "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)",
                    "created_at": datetime.datetime.utcnow() - datetime.timedelta(days=6)
                },
                {
                    "email": "manager.a@apex.demo",
                    "action": "CREATE_METER",
                    "entity_type": "METER",
                    "details": {"name": "Sub-Meter Wing A", "element_id": 1, "site_id": db_sites.get("Dubai Marina Resort").id if db_sites.get("Dubai Marina Resort") else None},
                    "ip_address": "10.0.0.4",
                    "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)",
                    "created_at": datetime.datetime.utcnow() - datetime.timedelta(days=5)
                },
                {
                    "email": "uploader.a1@apex.demo",
                    "action": "LOGIN",
                    "entity_type": "USER",
                    "details": {"email": "uploader.a1@apex.demo", "method": "password"},
                    "ip_address": "10.0.0.5",
                    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0",
                    "created_at": datetime.datetime.utcnow() - datetime.timedelta(days=4)
                },
                {
                    "email": "uploader.a1@apex.demo",
                    "action": "SUBMIT_DATA",
                    "entity_type": "SUBMISSION",
                    "details": {"year": 2026, "month": 3, "site_id": db_sites.get("Dubai Marina Resort").id if db_sites.get("Dubai Marina Resort") else None, "created": 4, "updated": 0},
                    "ip_address": "10.0.0.5",
                    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0",
                    "created_at": datetime.datetime.utcnow() - datetime.timedelta(days=3)
                },
                {
                    "email": "uploader.a1@apex.demo",
                    "action": "SUBMIT_DATA",
                    "entity_type": "SUBMISSION",
                    "details": {"year": 2026, "month": 4, "site_id": db_sites.get("Dubai Marina Resort").id if db_sites.get("Dubai Marina Resort") else None, "created": 4, "updated": 0},
                    "ip_address": "10.0.0.5",
                    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0",
                    "created_at": datetime.datetime.utcnow() - datetime.timedelta(days=2)
                },
                {
                    "email": "admin@apex.demo",
                    "action": "UPDATE_ROLE",
                    "entity_type": "USER",
                    "details": {"email": "uploader.a2@apex.demo", "old_role": "uploader", "new_role": "site_manager"},
                    "ip_address": "192.168.1.15",
                    "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
                    "created_at": datetime.datetime.utcnow() - datetime.timedelta(days=1)
                },
                {
                    "email": "uploader.a1@apex.demo",
                    "action": "LOGIN_FAILED",
                    "details": {"email": "uploader.a1@apex.demo", "reason": "Incorrect email or password"},
                    "ip_address": "10.0.0.5",
                    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0",
                    "created_at": datetime.datetime.utcnow() - datetime.timedelta(hours=4)
                },
                {
                    "email": "uploader.a1@apex.demo",
                    "action": "LOGIN",
                    "entity_type": "USER",
                    "details": {"email": "uploader.a1@apex.demo", "method": "password"},
                    "ip_address": "10.0.0.5",
                    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0",
                    "created_at": datetime.datetime.utcnow() - datetime.timedelta(hours=3, minutes=58)
                },
                {
                    "email": "uploader.a1@apex.demo",
                    "action": "SUBMIT_DATA",
                    "entity_type": "SUBMISSION",
                    "details": {"year": 2026, "month": 5, "site_id": db_sites.get("Dubai Marina Resort").id if db_sites.get("Dubai Marina Resort") else None, "created": 4, "updated": 0},
                    "ip_address": "10.0.0.5",
                    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0",
                    "created_at": datetime.datetime.utcnow() - datetime.timedelta(hours=2)
                }
            ]
            
            for item in logs_to_add:
                actor_user = db_users.get(item["email"])
                new_log = AuditLog(
                    user_id=actor_user.id if actor_user else None,
                    company_id=company.id,
                    action=item["action"],
                    entity_type=item["entity_type"],
                    entity_id=str(actor_user.id) if item["action"] == "LOGIN" and actor_user else item.get("entity_id", "1"),
                    details=item["details"],
                    ip_address=item["ip_address"],
                    user_agent=item["user_agent"],
                    created_at=item["created_at"]
                )
                db.add(new_log)
                
            await db.commit()
            print("  [OK] seeded 16 audit logs")

        print("[demo] seeding complete")


if __name__ == "__main__":
    asyncio.run(seed_demo())
