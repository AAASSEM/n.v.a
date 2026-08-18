"""
Seed 3 throwaway tenant companies (each with its own super_user) to stress-test
cross-tenant isolation, or tear them down again.

  python scripts/seed_test_tenants.py seed      # create the 3 companies + users
  python scripts/seed_test_tenants.py teardown  # delete them again

All seeded records use the @xtenant.test email domain and TESTCO* company codes,
so teardown targets only those and never touches real or demo data.
"""
import sys
import asyncio
import datetime

sys.path.insert(0, ".")

from sqlalchemy.future import select
from app.db.session import async_session
from app.core import security
from app.models.company import Company
from app.models.user import User, UserProfile

TEST_DOMAIN = "@xtenant.test"
TENANTS = [
    {"code": "TESTCO1", "name": "Test Tenant One",   "email": "owner1" + TEST_DOMAIN},
    {"code": "TESTCO2", "name": "Test Tenant Two",   "email": "owner2" + TEST_DOMAIN},
    {"code": "TESTCO3", "name": "Test Tenant Three", "email": "owner3" + TEST_DOMAIN},
]


async def seed():
    async with async_session() as db:
        created = []
        for t in TENANTS:
            exists = (await db.execute(
                select(Company).where(Company.company_code == t["code"])
            )).scalars().first()
            if exists:
                print(f"  · {t['code']} already exists (id={exists.id}), skipping")
                continue

            company = Company(
                name=t["name"],
                registration_number=f"REG-{t['code']}",
                trade_license_number=f"LIC-{t['code']}",
                company_code=t["code"],
                emirate="dubai",
                sector="hospitality",
                active_frameworks=["ESG"],
                trial_expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=90),
            )
            db.add(company)
            await db.commit()
            await db.refresh(company)

            user = User(
                email=t["email"],
                password_hash=security.get_password_hash("UNUSABLE_TEST_ONLY"),
                first_name="Owner",
                last_name=t["code"],
                is_active=True,
                email_verified=True,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

            db.add(UserProfile(user_id=user.id, company_id=company.id, role="super_user"))
            company.owner_id = user.id
            await db.commit()
            created.append((company.id, user.id))
            print(f"  + {t['code']}: company_id={company.id}, user={t['email']}")
        print(f"Seeded {len(created)} new tenant(s).")


async def teardown():
    async with async_session() as db:
        # Delete users by test domain (profiles cascade), then companies by code.
        users = (await db.execute(
            select(User).where(User.email.like(f"%{TEST_DOMAIN}"))
        )).scalars().all()
        for u in users:
            await db.delete(u)
        companies = (await db.execute(
            select(Company).where(Company.company_code.like("TESTCO%"))
        )).scalars().all()
        for c in companies:
            await db.delete(c)
        await db.commit()
        print(f"Removed {len(users)} test user(s) and {len(companies)} test company(ies).")


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "seed"
    asyncio.run(seed() if action == "seed" else teardown())
