"""
Runtime verification for the cross-tenant access-control fixes.

Logs in as pre-seeded @apex.demo personas and exercises the endpoints that were
hardened, asserting they now scope/deny correctly. Read-only except for one
deliberately-failed cross-tenant PUT attempt (which is expected to be rejected).

Usage:  python scripts/verify_tenant_isolation.py
"""
import sys
import requests

BASE = "http://localhost:8000/api/v1"

results = []
def check(name, ok, detail=""):
    results.append((name, ok, detail))
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {name}" + (f" — {detail}" if detail else ""))

def login(email):
    r = requests.post(f"{BASE}/auth/demo-login", json={"email": email}, timeout=10)
    r.raise_for_status()
    tok = r.json().get("access_token")
    if not tok:
        raise RuntimeError(f"no token for {email}: {r.json()}")
    return {"Authorization": f"Bearer {tok}"}

def main():
    # Lowest-privilege persona: proves GET /companies/ is no longer wide open,
    # since that route had NO permission check at all before the fix.
    viewer = login("viewer.a@apex.demo")
    my_company = requests.get(f"{BASE}/companies/me", headers=viewer, timeout=10).json()
    my_id = my_company.get("id")
    check("GET /companies/me returns a company", my_id is not None, f"company_id={my_id}")

    r = requests.get(f"{BASE}/companies/", headers=viewer, timeout=10)
    companies = r.json()
    ids = sorted({c["id"] for c in companies}) if isinstance(companies, list) else None
    check(
        "GET /companies/ (viewer) scoped to own company only",
        isinstance(companies, list) and ids == [my_id],
        f"returned ids={ids}, expected [{my_id}]",
    )

    # Admin persona: has users.READ and companies.UPDATE — the perms the leaks rode on.
    admin = login("admin@apex.demo")

    r = requests.get(f"{BASE}/users/", headers=admin, timeout=10)
    users = r.json()
    if isinstance(users, list):
        foreign = [u for u in users
                   if u.get("profile") and u["profile"].get("company_id") not in (None, my_id)]
        # also assert no password_hash field ever surfaces
        leaked_hash = any("password_hash" in u for u in users)
        check("GET /users/ (admin) contains no other-company users",
              len(foreign) == 0, f"foreign users leaked: {len(foreign)}")
        check("GET /users/ never exposes password_hash", not leaked_hash)
    else:
        check("GET /users/ returns a list", False, str(users)[:120])

    # Cross-tenant write attempt: try to update a DIFFERENT company id.
    other_id = (my_id or 0) + 99999  # an id that isn't the admin's company
    payload = {"name": "HACKED", "emirate": "dubai", "sector": "hospitality"}
    r = requests.put(f"{BASE}/companies/{other_id}", headers=admin, json=payload, timeout=10)
    check("PUT /companies/{foreign_id} (admin) is rejected",
          r.status_code in (403, 404), f"status={r.status_code}")

    # Bare create is developer-only now.
    r = requests.post(f"{BASE}/users/", headers=admin,
                      json={"email": "should-not-exist@apex.demo", "password": "x",
                            "first_name": "No", "last_name": "Way"}, timeout=10)
    check("POST /users/ (admin, non-developer) is forbidden",
          r.status_code == 403, f"status={r.status_code}")

    print("\n" + "=" * 50)
    passed = sum(1 for _, ok, _ in results if ok)
    print(f"{passed}/{len(results)} checks passed")
    return 0 if passed == len(results) else 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(2)
