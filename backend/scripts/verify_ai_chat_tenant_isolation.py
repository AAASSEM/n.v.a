"""
Runtime + in-process verification for the AI chat feature's tenant isolation and
directive-validation guarantees (Phase 1 plan §6).

Seeds two throwaway companies (reusing scripts/seed_test_tenants.py's TESTCO1/
TESTCO2 + owner1/owner2@xtenant.test super_users), mints access tokens directly
(these accounts have no real login route — this app's auth is magic-link/demo
only, so a script has no email to click), then:

  1. Confirms POST /ai-chat/query fails CLOSED (503) when ANTHROPIC_API_KEY is
     unset, rather than silently falling back to anything — proves there is no
     fallback path that could leak cross-tenant behavior.
  2. Confirms /ai-chat/dashboard-items CRUD is company-scoped: a chart pinned by
     owner1 never appears in owner2's list, and owner2 cannot delete it.
  3. Confirms /ai-chat/quota is scoped per company.
  4. In-process: feeds `_validate_view_directives` a deliberately malformed /
     adversarial directives payload (bad pillar, out-of-range month/year, and a
     site_id belonging to the OTHER seeded company) as if it came straight from
     the model, and asserts every invalid/foreign field is dropped while valid
     fields survive.

Requires the backend running locally for steps 1-3 (same convention as
scripts/verify_tenant_isolation.py). Step 4 talks to the DB directly.

NOT covered here: the actual Claude tool-loop (`run_chat_turn`) end to end — that
needs a real ANTHROPIC_API_KEY, which this dev environment does not have
configured. Once a key is available, use the manual checklist in the Phase 1
plan (§6 "Manual") to verify live model behavior.

Usage:  python scripts/verify_ai_chat_tenant_isolation.py
"""
import sys
import asyncio
from pathlib import Path

import requests

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.db.session import async_session
from app.core import security
from app.models.user import User
from app.models.company import Site
import scripts.seed_test_tenants as seed_tenants

BASE = "http://localhost:8000/api/v1"

results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {name}" + (f" — {detail}" if detail else ""))


async def mint_tokens():
    async with async_session() as db:
        result = await db.execute(
            select(User)
            .where(User.email.in_(["owner1@xtenant.test", "owner2@xtenant.test"]))
            .options(selectinload(User.profile))
        )
        users = {u.email: u for u in result.scalars().all()}
    if "owner1@xtenant.test" not in users or "owner2@xtenant.test" not in users:
        raise RuntimeError("Seeded tenants not found — seed_test_tenants.seed() may have failed.")
    owner1, owner2 = users["owner1@xtenant.test"], users["owner2@xtenant.test"]
    tok1 = security.create_access_token(owner1.id)
    tok2 = security.create_access_token(owner2.id)
    return (
        owner1, {"Authorization": f"Bearer {tok1}"},
        owner2, {"Authorization": f"Bearer {tok2}"},
    )


async def seed_foreign_site(company2_id: int) -> int:
    async with async_session() as db:
        site = Site(company_id=company2_id, name="TESTCO2 Foreign Site", location="dubai")
        db.add(site)
        await db.commit()
        await db.refresh(site)
        return site.id


async def check_directive_validation(owner1_id: int, foreign_site_id: int):
    from app.services.ai_chat_service import _validate_view_directives

    async with async_session() as db:
        result = await db.execute(
            select(User).where(User.id == owner1_id).options(selectinload(User.profile))
        )
        user = result.scalars().first()

        malformed = {
            "pillar": "Z",                                # invalid enum -> dropped
            "framework": "NOT-A-REAL-FRAMEWORK",          # not in company's active list -> dropped
            "from_period": {"year": 2026, "month": 99},   # invalid month -> dropped
            "to_period": {"year": 2026, "month": 8},      # valid -> kept
            "selected_year": 1999,                         # below _YEAR_MIN -> dropped
            "chart_mode": "actual",                         # valid -> kept
            "compare_mode": True,                           # valid -> kept
            "site_id": foreign_site_id,                     # belongs to TESTCO2, not owner1's TESTCO1 -> dropped
        }
        out = await _validate_view_directives(malformed, user, db)

        check("directive validation drops invalid pillar", out is not None and "pillar" not in out)
        check("directive validation drops unknown framework", out is not None and "framework" not in out)
        check("directive validation drops out-of-range month", out is not None and "from_period" not in out)
        check("directive validation keeps valid to_period",
              out is not None and out.get("to_period") == {"year": 2026, "month": 8})
        check("directive validation drops out-of-range year", out is not None and "selected_year" not in out)
        check("directive validation keeps valid chart_mode", out is not None and out.get("chart_mode") == "actual")
        check("directive validation keeps valid compare_mode", out is not None and out.get("compare_mode") is True)
        check("directive validation drops foreign site_id",
              out is not None and "site_id" not in out, f"foreign_site_id={foreign_site_id}")


def check_ai_disabled_fails_closed(headers1):
    r = requests.post(
        f"{BASE}/ai-chat/query", headers=headers1,
        json={"message": "test", "context": "dashboard"}, timeout=10,
    )
    check(
        "POST /ai-chat/query fails CLOSED (503) with no ANTHROPIC_API_KEY, not a silent fallback",
        r.status_code == 503, f"status={r.status_code}, body={r.text[:150]}",
    )


def check_dashboard_items_isolation(headers1, headers2):
    fake_chart = {
        "chart_type": "single_value", "title": "Isolation probe", "unit": "kWh",
        "x_label": "", "y_label": "", "series": [], "highlight_label": None,
    }
    r = requests.post(
        f"{BASE}/ai-chat/dashboard-items", headers=headers1,
        json={"title": "Owner1 probe item", "chart": fake_chart, "source_question": "isolation test"},
        timeout=10,
    )
    check("POST /ai-chat/dashboard-items (owner1) succeeds",
          r.status_code in (200, 201), f"status={r.status_code}, body={r.text[:150]}")
    item_id = r.json().get("id") if r.status_code in (200, 201) else None

    r2 = requests.get(f"{BASE}/ai-chat/dashboard-items", headers=headers2, timeout=10)
    items2 = r2.json() if r2.status_code == 200 else []
    leaked = any(i.get("id") == item_id for i in items2) if isinstance(items2, list) else True
    check("GET /ai-chat/dashboard-items (owner2) never sees owner1's item", not leaked, f"item_id={item_id}")

    if item_id is not None:
        r3 = requests.delete(f"{BASE}/ai-chat/dashboard-items/{item_id}", headers=headers2, timeout=10)
        check("DELETE /ai-chat/dashboard-items/{foreign_id} (owner2) is rejected",
              r3.status_code in (403, 404), f"status={r3.status_code}")

        requests.delete(f"{BASE}/ai-chat/dashboard-items/{item_id}", headers=headers1, timeout=10)


def check_quota_scoping(headers1, headers2):
    r1 = requests.get(f"{BASE}/ai-chat/quota", headers=headers1, timeout=10)
    r2 = requests.get(f"{BASE}/ai-chat/quota", headers=headers2, timeout=10)
    ok = r1.status_code == 200 and r2.status_code == 200
    check("GET /ai-chat/quota returns 200 for both companies", ok, f"status1={r1.status_code}, status2={r2.status_code}")
    if ok:
        d1, d2 = r1.json(), r2.json()
        check(
            "quota used_today starts at 0 independently per company",
            d1.get("used_today") == 0 and d2.get("used_today") == 0,
            f"owner1={d1}, owner2={d2}",
        )


async def main():
    print("Seeding throwaway TESTCO1/TESTCO2 tenants...")
    await seed_tenants.seed()

    owner1, headers1, owner2, headers2 = await mint_tokens()
    foreign_site_id = await seed_foreign_site(owner2.profile.company_id)

    try:
        check_ai_disabled_fails_closed(headers1)
        check_dashboard_items_isolation(headers1, headers2)
        check_quota_scoping(headers1, headers2)
        await check_directive_validation(owner1.id, foreign_site_id)
    finally:
        print("\nTearing down throwaway tenants...")
        await seed_tenants.teardown()

    print("\n" + "=" * 50)
    passed = sum(1 for _, ok, _ in results if ok)
    print(f"{passed}/{len(results)} checks passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(2)
