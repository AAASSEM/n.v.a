# 3-Month Free Trial & Account Freeze

When a user signs up and creates a company, that company gets a **90-day free trial**. Once the trial expires, **every user in that company** is locked out with a "Trial Expired" screen until you (the admin) manually upgrade or extend them.

## Proposed Changes

### 1. Database — Company Model

#### [MODIFY] [company.py](file:///c:/Users/20100/thefinal/n.v.a/backend/app/models/company.py)

Add a `trial_expires_at` column to the `Company` table:

```python
trial_expires_at = Column(DateTime, nullable=True)  # NULL = no trial limit (grandfathered / paid)
```

- `NULL` → account is not on trial (existing companies, demo company, paid accounts). **No freeze.**
- A datetime value → the exact moment the trial ends. After this, the company is frozen.

> [!IMPORTANT]
> Existing companies (including the demo company) will have `trial_expires_at = NULL` by default, so they are **not affected** at all.

---

### 2. Alembic Migration

#### [NEW] `add_trial_expires_at.py` (in `alembic/versions/`)

A simple migration that adds the nullable `trial_expires_at` column to the `companies` table. Since it's nullable, all existing rows get `NULL` (unfrozen).

---

### 3. Backend — Set Trial on Company Creation

#### [MODIFY] [companies.py](file:///c:/Users/20100/thefinal/n.v.a/backend/app/api/endpoints/companies.py)

When `create_company` is called (during onboarding), set:

```python
from datetime import timedelta
company.trial_expires_at = datetime.datetime.utcnow() + timedelta(days=90)
```

This gives every newly created company exactly 90 days from sign-up.

---

### 4. Backend — Enforce Trial Expiry on Every Request

#### [MODIFY] [deps.py](file:///c:/Users/20100/thefinal/n.v.a/backend/app/api/deps.py)

In `get_current_user`, after loading the user, check the company's trial:

```python
# After fetching the user and checking maintenance mode...
if user.profile and user.profile.company_id:
    company = await db.get(Company, user.profile.company_id)
    if company and company.trial_expires_at and datetime.utcnow() > company.trial_expires_at:
        if not getattr(user, 'is_developer', False):
            raise HTTPException(
                status_code=403,
                detail="TRIAL_EXPIRED"
            )
```

- Uses a special `"TRIAL_EXPIRED"` detail string so the frontend can distinguish it from a normal 403.
- Developer users bypass the check (so you can always log in).

> [!WARNING]
> This adds a DB query for the Company on every authenticated request. To minimize impact, we can cache it similarly to the maintenance mode cache (30-second TTL). We should implement this cache.

---

### 5. Frontend — Handle the Frozen State

#### [MODIFY] [authStore.ts](file:///c:/Users/20100/thefinal/n.v.a/frontend/src/stores/authStore.ts)

In `fetchUser`, if the `/auth/me` call returns a 403 with `detail === "TRIAL_EXPIRED"`, set a new state flag `isTrialExpired: true` instead of logging the user out.

#### [NEW] `TrialExpiredScreen.tsx` (in `frontend/src/components/ui/`)

A full-page overlay/modal that displays:
- **"Your Free Trial Has Ended"** heading
- A message explaining the 90-day trial is over
- A **"Contact Us"** button (mailto: `support@esgravity.com`)
- A **"Log Out"** button

#### [MODIFY] [App.tsx](file:///c:/Users/20100/thefinal/n.v.a/frontend/src/App.tsx)

In `RequireAuth`, if `isTrialExpired` is true, render `<TrialExpiredScreen />` instead of the children. This blocks all navigation.

---

### 6. Backend — Expose Trial Info in `/auth/me`

#### [MODIFY] [auth.py](file:///c:/Users/20100/thefinal/n.v.a/backend/app/api/endpoints/auth.py) & [user.py schema](file:///c:/Users/20100/thefinal/n.v.a/backend/app/schemas/user.py)

Add `trial_expires_at` (as an ISO string or null) to the user response so the frontend can show a countdown banner like *"12 days left in your trial"* in the sidebar or header.

#### [MODIFY] [user.ts types](file:///c:/Users/20100/thefinal/n.v.a/frontend/src/types/user.ts)

Add `trial_expires_at?: string | null` to the `User` interface.

---

### 7. Developer Admin — Extend or Remove Trial

#### [MODIFY] [developer_admin.py](file:///c:/Users/20100/thefinal/n.v.a/backend/app/api/endpoints/developer_admin.py)

Add an endpoint or extend the existing company audit to allow:
- **Extend trial**: Set `trial_expires_at` to a new date (e.g., +90 days from now)
- **Remove trial (upgrade to paid)**: Set `trial_expires_at = NULL`

This gives you full control without touching the database directly.

---

## Open Questions

> [!IMPORTANT]
> **Demo company**: Should the demo company remain permanently unfrozen? The current plan keeps it unfrozen because `trial_expires_at` will be `NULL` for existing records. Just confirming this is correct.

> [!IMPORTANT]
> **Trial countdown banner**: Do you want a visible countdown (e.g., "14 days left") in the sidebar/header for users currently on trial, or just the hard block when it expires?

> [!IMPORTANT]
> **Grace period**: When the trial expires, should the user see their data in read-only mode, or should it be a complete block with no access at all?

---

## Verification Plan

### Automated Tests
1. Run `alembic upgrade head` to verify the migration applies cleanly
2. Create a new company via the API → confirm `trial_expires_at` is set ~90 days out
3. Manually set `trial_expires_at` to a past date → confirm API returns `403 TRIAL_EXPIRED`
4. Build the frontend: `npm run build` to confirm no TypeScript errors

### Manual Verification
1. Sign up as a new user → create company → verify trial date in DB
2. Fast-forward the trial date to the past → refresh the app → see the "Trial Expired" screen
3. Use developer admin to extend the trial → refresh → access restored
4. Confirm existing/demo companies are unaffected
