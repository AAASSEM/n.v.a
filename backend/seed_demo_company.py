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
from app.services.profiling_service import ProfilingService


COMPANY_NAME = "Green Horizon Hospitality"
COMPANY_CODE = "GRNHRZ01"

USERS = [
    # email, first, last, role, site_key (None = company-wide)
    ("admin@greenhorizon.demo",      "Alex",  "Admin",    Role.ADMIN.value,         None),
    ("manager.a@greenhorizon.demo",  "Mona",  "Marina",   Role.SITE_MANAGER.value,  "A"),
    ("uploader.a1@greenhorizon.demo","Usama", "Upload",   Role.UPLOADER.value,      "A"),
    ("uploader.a2@greenhorizon.demo","Ursula","Uploadie", Role.UPLOADER.value,      "A"),
    ("viewer.a@greenhorizon.demo",   "Vera",  "Viewer",   Role.VIEWER.value,        "A"),
    ("manager.b@greenhorizon.demo",  "Majid", "Downtown", Role.SITE_MANAGER.value,  "B"),
    ("meter.b@greenhorizon.demo",    "Mira",  "Metric",   Role.METER_MANAGER.value, "B"),
    ("viewer.b@greenhorizon.demo",   "Vikram","Vista",    Role.VIEWER.value,        "B"),
]

# Site-specific profiling answers — keyed by lowercase question_text substring.
# Answers NOT listed default to False.
SITE_ANSWERS = {
    "A": {  # Marina Resort — beachfront, full service
        "on-site laundry": True,
        "swimming pools": True,
        "in-house restaurant": True,
        "fleet of company-owned vehicles": True,
        "landscaped gardens": True,
        "full-service spa": True,
        "on-site gym": True,
        "ev charging": True,
        "solar panels": False,
        "compost": True,
        "single-use plastics": True,
        "linen and towel reuse": True,
        "refillable guest amenity": True,
        "sustainability/green team": True,
    },
    "B": {  # Downtown Hotel — leaner, urban
        "on-site laundry": False,
        "swimming pools": False,
        "in-house restaurant": True,
        "fleet of company-owned vehicles": False,
        "landscaped gardens": False,
        "full-service spa": False,
        "on-site gym": True,
        "meetings, conferences": True,
        "bars or licensed": True,
        "ev charging": False,
        "solar panels": True,
        "outsource laundry": True,
        "single-use plastics": True,
        "linen and towel reuse": True,
        "sustainability/green team": True,
    },
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
                active_frameworks=["ESG", "Green Key"],
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
            ("A", "Dubai Marina Resort",      "Dubai Marina, Dubai, UAE"),
            ("B", "Abu Dhabi Downtown Hotel", "Corniche Road, Abu Dhabi, UAE"),
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
                print(f"  ✓ site {site.name}: onboarded, checklist generated")

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

        # 6. 3 months of DataSubmissions per site for metered main meters
        today = datetime.date.today()
        for key, site in sites.items():
            meters = (await db.execute(
                select(Meter).where(
                    Meter.company_id == company.id,
                    Meter.site_id == site.id,
                    Meter.name.like("Main %"),
                )
            )).scalars().all()
            if not meters:
                continue
            random.seed(hash(key))
            created = 0
            for i in range(3):
                month_date = today - datetime.timedelta(days=30 * i)
                for m in meters:
                    existing = (await db.execute(
                        select(DataSubmission).where(
                            DataSubmission.company_id == company.id,
                            DataSubmission.site_id == site.id,
                            DataSubmission.meter_id == m.id,
                            DataSubmission.year == month_date.year,
                            DataSubmission.month == month_date.month,
                        )
                    )).scalars().first()
                    if existing:
                        continue
                    base = 3000 if key == "A" else 1800
                    db.add(DataSubmission(
                        company_id=company.id,
                        site_id=site.id,
                        data_element_id=m.data_element_id,
                        meter_id=m.id,
                        year=month_date.year,
                        month=month_date.month,
                        value=round(base + random.random() * base * 0.4, 2),
                        submitted_by=admin.id if admin else None,
                    ))
                    created += 1
            await db.commit()
            if created:
                print(f"  · site {site.name}: inserted {created} demo submissions")

        print("[demo] seeding complete")


if __name__ == "__main__":
    asyncio.run(seed_demo())
