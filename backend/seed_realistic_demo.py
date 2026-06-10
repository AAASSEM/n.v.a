"""
seed_realistic_demo.py
======================
Full realistic demo seed for ESGravity — 2019 through June 2026.

Company:  Apex Hospitality (APEX01)
Sites:    Dubai Marina Resort (Site A) | Abu Dhabi Downtown Hotel (Site B)

Data philosophy
---------------
Every value is grounded in real UAE hospitality benchmarks:

  Electricity   Dubai 4-star hotel ~ 45 kWh/room/night × 300 rooms
                = ~13,500 kWh/day → ~405,000 kWh/month (Site A)
                Abu Dhabi property slightly smaller → ~320,000 kWh/month (Site B)
  Water         Dubai benchmark 280 L/occupied room/night × 300 rooms × 65% occ
                = ~54,600 L/day → ~1,638 m³/month (Site A)
  District Cooling  ~15,000 RT-h/month typical 4-star Dubai hotel
  Waste         ~2 kg/guest-night × 300 rooms × 65% occ × 30 days → ~11,700 kg/month
  Recycling     ~25–35% of waste depending on year (improving over time)
  Fuel (Diesel gen) ~800–1,200 L/month (generators + fleet)
  LPG           ~1,500–2,000 kg/month (kitchen)
  Refrigerant   2–8 kg/year leakage (split across months)

Trend patterns
--------------
- COVID impact:   2020 Mar–Dec → 40–60% occupancy drop → proportional consumption drop
- Recovery:       2021 gradual, 2022 near-normal, 2023 full recovery + Expo legacy
- Seasonality:    Summer (Jun–Sep) +10–15% electricity (AC), -10% water (less guests)
                  Winter (Nov–Mar) -5% electricity, +5% water (peak tourism)
- Efficiency:     Electricity intensity improves ~2% per year (upgrades, LED, BMS)
                  Water intensity improves ~1.5% per year (low-flow fixtures)
                  Waste recycling rate increases ~2% per year
- 2024–2026:      Net Zero commitments → accelerated renewables, recycling push

Social & Governance
-------------------
Annual values seeded once per year (month=12 for the year).
S values reflect a growing UAE hotel: workforce grows from ~180 (2019) to ~260 (2025).
G booleans: most policies implemented by 2021, all by 2023.
"""

import asyncio
import datetime
import random
import math
import os
import sys

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from sqlalchemy import text

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)

from app.core.config import settings
from app.models.company import Company, Site
from app.models.data_element import DataElement
from app.models.checklist import CompanyChecklist
from app.models.submission import DataSubmission
from app.models.meter import Meter
from app.models.user import User

# ─────────────────────────────────────────────────────────────────────────────
# Seasonal & COVID multipliers
# ─────────────────────────────────────────────────────────────────────────────

def occupancy_factor(year: int, month: int) -> float:
    """
    Realistic Dubai hotel occupancy proxy (affects energy, water, waste linearly).
    Normal year baseline = 1.0 (≈65% occupancy).
    """
    # COVID impact
    covid = {
        (2020, 3): 0.55, (2020, 4): 0.20, (2020, 5): 0.22,
        (2020, 6): 0.28, (2020, 7): 0.32, (2020, 8): 0.30,
        (2020, 9): 0.35, (2020, 10): 0.45, (2020, 11): 0.50,
        (2020, 12): 0.55,
        (2021, 1): 0.50, (2021, 2): 0.52, (2021, 3): 0.58,
        (2021, 4): 0.60, (2021, 5): 0.62, (2021, 6): 0.55,
        (2021, 7): 0.55, (2021, 8): 0.53, (2021, 9): 0.65,
        (2021, 10): 0.80, (2021, 11): 0.90, (2021, 12): 1.05,  # Expo 2020 boost
    }
    if (year, month) in covid:
        return covid[(year, month)]

    # Seasonal pattern (base 1.0 = 65% occupancy)
    seasonal = {
        1: 1.10, 2: 1.12, 3: 1.08, 4: 1.00,
        5: 0.88, 6: 0.78, 7: 0.75, 8: 0.74,
        9: 0.82, 10: 1.00, 11: 1.08, 12: 1.12,
    }
    base = seasonal[month]

    # Year-over-year growth (2019 baseline, recovery + Expo legacy)
    year_growth = {
        2019: 1.00, 2020: 0.60, 2021: 0.75,
        2022: 0.95, 2023: 1.05, 2024: 1.08, 2025: 1.10, 2026: 1.10,
    }
    return base * year_growth.get(year, 1.0)


def efficiency_factor(year: int, element_code: str) -> float:
    """
    Gradual efficiency improvement per year vs 2019 baseline.
    Energy: ~2%/yr, Water: ~1.5%/yr, Waste: ~1%/yr improvement.
    """
    years_since_2019 = max(0, year - 2019)
    rates = {
        'HOSP-E-001': 0.020,  # Electricity — LED, BMS upgrades
        'HOSP-E-002': 0.015,  # Water — low-flow fixtures
        'HOSP-E-003': 0.018,  # District cooling — BMS
        'HOSP-E-005': 0.010,  # Waste generated — procurement changes
        'HOSP-E-009': 0.025,  # Generator diesel — grid reliability improving
    }
    rate = rates.get(element_code, 0.005)
    return max(0.70, 1.0 - (rate * years_since_2019))


def summer_ac_boost(month: int) -> float:
    """Extra electricity boost in summer from AC load."""
    boosts = {6: 1.08, 7: 1.14, 8: 1.15, 9: 1.07}
    return boosts.get(month, 1.0)


# ─────────────────────────────────────────────────────────────────────────────
# Base monthly values — Site A (Dubai Marina Resort, 300 rooms)
# ─────────────────────────────────────────────────────────────────────────────

BASE_MONTHLY_A = {
    # Environmental — monthly
    'HOSP-E-001': 405_000,    # kWh electricity
    'HOSP-E-002': 1_638,      # m³ water
    'HOSP-E-003': 15_200,     # RT-h district cooling
    'HOSP-E-004': 1_750,      # kg LPG (kitchen)
    'HOSP-E-005': 11_800,     # kg non-hazardous waste
    'HOSP-E-006': 2_950,      # kg waste recycled (~25% base)
    'HOSP-E-007': 420,        # L petrol (fleet)
    'HOSP-E-008': 380,        # L diesel (vehicles)
    'HOSP-E-009': 980,        # L diesel (generators)
    'HOSP-E-010': 0.5,        # kg refrigerant leak/month (6 kg/yr avg)
    'HOSP-E-023': 8_200,      # kWh solar (installed 2022, grows each year)
    'HOSP-E-042': 1_360,      # L diesel owned vehicles+generators (DST)
    'HOSP-E-043': 1,          # Carbon calculator submitted (boolean, monthly)
    'HOSP-E-066': 210,        # m³ sub-metered water
    'HOSP-E-069': 2.0,        # % renewable energy
    'HOSP-E-072': 25.0,       # % recycling rate (base, improves over time)
    'HOSP-E-073': 380,        # kg organic waste composted
}

BASE_MONTHLY_B = {
    # Site B (Abu Dhabi Downtown Hotel, 240 rooms) — ~80% of Site A
    'HOSP-E-001': 318_000,
    'HOSP-E-002': 1_290,
    'HOSP-E-003': 11_800,
    'HOSP-E-004': 1_380,
    'HOSP-E-005': 9_400,
    'HOSP-E-006': 2_200,
    'HOSP-E-007': 330,
    'HOSP-E-008': 300,
    'HOSP-E-009': 760,
    'HOSP-E-010': 0.4,
    'HOSP-E-023': 6_100,
    'HOSP-E-042': 1_060,
    'HOSP-E-043': 1,
    'HOSP-E-066': 165,
    'HOSP-E-069': 1.9,
    'HOSP-E-072': 22.0,
    'HOSP-E-073': 295,
}

# ─────────────────────────────────────────────────────────────────────────────
# Annual values — Environmental (per site, per year)
# ─────────────────────────────────────────────────────────────────────────────

def annual_E_values(year: int, site: str) -> dict:
    """
    Annual E element values. site = 'A' or 'B'.
    GHG values computed from rough consumption totals (simplified Scope 1+2).
    """
    scale = 1.0 if site == 'A' else 0.80

    # Electricity annual (sum of monthly)
    total_kwh_A = sum(
        BASE_MONTHLY_A['HOSP-E-001'] * occupancy_factor(year, m) * efficiency_factor(year, 'HOSP-E-001') * summer_ac_boost(m)
        for m in range(1, 13)
    )
    total_kwh = total_kwh_A * scale

    # Rough Scope 2 (Dubai grid 0.4564 kgCO2e/kWh)
    scope2 = round(total_kwh * 0.4564 / 1000, 1)
    # Rough Scope 1 (fuel combustion)
    total_diesel_L = BASE_MONTHLY_A['HOSP-E-009'] * scale * 12
    total_lpg_kg   = BASE_MONTHLY_A['HOSP-E-004'] * scale * 12
    scope1 = round((total_diesel_L * 2.684 + total_lpg_kg * 2.943) / 1000, 1)
    # Scope 3 estimate (~30% of Scope 1+2 for hospitality supply chain)
    scope3 = round((scope1 + scope2) * 0.30, 1)
    total_ghg = round(scope1 + scope2, 1)

    # Renewable energy grows: 0 in 2019-2021, installed 2022, grows each year
    renewable_solar = {
        2019: 0, 2020: 0, 2021: 0,
        2022: 98_400,   # installed mid-2022
        2023: 118_000,
        2024: 142_000,
        2025: 168_000,
        2026: 145_000,  # partial year
    }
    solar_kwh = renewable_solar.get(year, 0) * scale
    renewable_pct = round((solar_kwh / total_kwh * 100) if total_kwh > 0 else 0, 1)

    # Recycling rate improves 2%/year from 25%
    recycling_rate = min(55, 25 + (year - 2019) * 2.2)

    # LED % improves each year
    led_pct = min(98, 45 + (year - 2019) * 8.5)

    # Waste generated (annual total from monthly)
    annual_waste = round(sum(
        BASE_MONTHLY_A['HOSP-E-005'] * scale * occupancy_factor(year, m) * efficiency_factor(year, 'HOSP-E-005')
        for m in range(1, 13)
    ))

    # Emissions reduction target (% vs baseline 2019) — grows each year
    reduction_target = min(40, max(0, (year - 2019) * 5))
    baseline_emissions = round(total_ghg * (1 + (year - 2019) * 0.02), 1) if year == 2019 else round(scope1 + scope2 + (year - 2019) * 20, 1)

    return {
        'HOSP-E-011': total_ghg,
        'HOSP-E-015': scope1,
        'HOSP-E-016': scope2,
        'HOSP-E-017': scope3,
        'HOSP-E-018': baseline_emissions,
        'HOSP-E-019': reduction_target,
        'HOSP-E-021': round(scope3 * 0.05, 1),  # carbon offsets ~5% of scope3
        'HOSP-E-022': round(120 * scale + random.uniform(-20, 20), 1),  # hazardous waste kg
        'HOSP-E-062': round(8.5 - (year - 2019) * 0.15, 2),   # shower flow L/min (improving)
        'HOSP-E-063': round(6.0 - (year - 2019) * 0.10, 2),   # tap flow L/min
        'HOSP-E-067': round(min(95, 60 + (year - 2019) * 5.5), 1),  # energy-efficient lighting %
        'HOSP-E-068': round(led_pct, 1),
        'HOSP-E-074': round(18 + (year - 2019) * 2.5),  # sustainable food products count
    }


def annual_E_boolean(year: int) -> dict:
    """
    Boolean E elements — policies/practices. Most activated by 2021–2022.
    """
    return {
        'HOSP-E-043': 1,   # carbon calculator — always
        'HOSP-E-048': 1 if year >= 2020 else 0,   # energy management plan
        'HOSP-E-049': 1 if year >= 2021 else 0,   # energy automation
        'HOSP-E-050': 1 if year >= 2020 else 0,   # transportation policy
        'HOSP-E-051': 1,                            # water conservation
        'HOSP-E-052': 1 if year >= 2020 else 0,   # wastewater
        'HOSP-E-053': 1,                            # waste management plan
        'HOSP-E-054': 1 if year >= 2021 else 0,   # waste management bathroom
        'HOSP-E-055': 1,                            # minimise pollution
        'HOSP-E-056': 1 if year >= 2022 else 0,   # harmful substances
        'HOSP-E-057': 1 if year >= 2021 else 0,   # sustainable purchasing
        'HOSP-E-064': 1 if year >= 2020 else 0,   # dual flush toilets
        'HOSP-E-075': 1 if year >= 2022 else 0,   # vegetarian/vegan options
    }


# ─────────────────────────────────────────────────────────────────────────────
# Annual values — Social (per year, per site)
# ─────────────────────────────────────────────────────────────────────────────

def annual_S_values(year: int, site: str) -> dict:
    """
    Realistic UAE hotel workforce data.
    Dubai Marina (A) ~300 rooms: starts 185 staff (2019), grows to 265 (2025).
    Abu Dhabi (B) ~240 rooms: starts 148 staff (2019), grows to 210 (2025).
    """
    # COVID caused layoffs in 2020, recovery in 2021+
    workforce_A = {
        2019: 185, 2020: 148, 2021: 162, 2022: 198, 2023: 232, 2024: 252, 2025: 265, 2026: 268,
    }
    workforce_B = {
        2019: 148, 2020: 118, 2021: 130, 2022: 158, 2023: 185, 2024: 200, 2025: 210, 2026: 212,
    }
    workforce = (workforce_A if site == 'A' else workforce_B).get(year, 200)
    scale = 1.0 if site == 'A' else 0.80

    # Female % — UAE hospitality target is improving
    female_pct = round(min(45, 28 + (year - 2019) * 2.2), 1)

    # New hires (higher in recovery years, lower in COVID)
    new_hires = {2019: 22, 2020: 5, 2021: 28, 2022: 45, 2023: 38, 2024: 30, 2025: 25, 2026: 18}
    hires = round(new_hires.get(year, 20) * scale)

    # Turnover % — industry avg 25%, improving
    turnover = round(max(12, 28 - (year - 2019) * 2.0) + random.uniform(-1.5, 1.5), 1)

    # Training hours/employee — improving
    training_hrs = round(min(48, 18 + (year - 2019) * 4.2) + random.uniform(-2, 2), 1)

    # Safety
    ltifr = round(max(0.0, 2.8 - (year - 2019) * 0.35) + random.uniform(-0.2, 0.2), 2)
    injuries = max(0, round(3 - (year - 2019) * 0.4 + random.uniform(-0.5, 0.5)))

    # Grievances
    reported = max(1, round(8 - (year - 2019) * 0.8 + random.uniform(-1, 1)))
    resolved = max(0, min(reported, reported - random.randint(0, 1)))

    # Nationalities — diverse UAE hospitality workforce
    nationalities = min(32, 18 + (year - 2019))

    # Community investment (AED) — grows each year, dips in COVID
    comm_inv = {2019: 45_000, 2020: 12_000, 2021: 28_000, 2022: 65_000,
                2023: 82_000, 2024: 95_000, 2025: 110_000, 2026: 88_000}
    community_aed = round(comm_inv.get(year, 50_000) * scale)

    # Staff training total hours
    staff_training = round(workforce * training_hrs)

    # Community engagement activities
    community_eng = max(1, round(3 + (year - 2019) * 1.2 + random.uniform(-0.5, 0.5)))

    return {
        'HOSP-S-024': workforce,
        'HOSP-S-025': female_pct,
        'HOSP-S-026': hires,
        'HOSP-S-027': turnover,
        'HOSP-S-028': training_hrs,
        'HOSP-S-029': ltifr,
        'HOSP-S-030': injuries,
        'HOSP-S-031': reported,
        'HOSP-S-032': resolved,
        'HOSP-S-033': nationalities,
        'HOSP-S-034': community_aed,
        'HOSP-S-076': staff_training,
        'HOSP-S-077': community_eng,
    }


def annual_S_boolean(year: int) -> dict:
    """Social boolean elements — rollout over years."""
    return {
        'HOSP-S-012': 1 if year >= 2021 else 0,  # guest sustainability education
        'HOSP-S-044': 1 if year >= 2020 else 0,  # sustainability training
        'HOSP-S-045': 1 if year >= 2021 else 0,  # sustainability committee
        'HOSP-S-046': 1 if year >= 2021 else 0,  # staff engagement
        'HOSP-S-047': 1 if year >= 2022 else 0,  # green events
        'HOSP-S-058': 1 if year >= 2022 else 0,  # local communities
    }


# ─────────────────────────────────────────────────────────────────────────────
# Annual values — Governance (per year)
# ─────────────────────────────────────────────────────────────────────────────

def annual_G_values(year: int, site: str) -> dict:
    scale = 1.0 if site == 'A' else 0.90
    return {
        'HOSP-G-060': min(20, round(4 + (year - 2019) * 2.5)),  # action plan items
        'HOSP-G-061': min(40, max(0, (year - 2019) * 5)),         # carbon reduction target %
        'HOSP-G-065': min(10, round(2 + (year - 2019) * 1.2)),   # water leak checks/day
        'HOSP-G-071': min(8, round(3 + (year - 2019) * 0.8)),    # waste separation categories
        'HOSP-G-078': round(min(85, 20 + (year - 2019) * 10.5) + random.uniform(-3, 3), 1),  # eco-labeled products %
    }


def annual_G_boolean(year: int) -> dict:
    """Governance policies — progressive rollout. Most major hotels had basics by 2020."""
    return {
        'HOSP-G-013': 1,                            # sustainability policy — always
        'HOSP-G-014': 1 if year >= 2021 else 0,   # food waste initiatives
        'HOSP-G-035': 1 if year >= 2022 else 0,   # emissions inventory verified
        'HOSP-G-037': 1 if year >= 2022 else 0,   # board oversight climate
        'HOSP-G-038': 1,                            # ethics policy — always
        'HOSP-G-039': 1,                            # health & safety policy — always
        'HOSP-G-040': 1 if year >= 2020 else 0,   # data privacy policy
        'HOSP-G-041': 1 if year >= 2021 else 0,   # supplier code of conduct
        'HOSP-G-059': 1 if year >= 2022 else 0,   # environmental manager appointed
        'HOSP-G-070': 1 if year >= 2021 else 0,   # automatic energy controls
        'HOSP-G-079': 1 if year >= 2023 else 0,   # non-chlorine paper products
        'HOSP-G-080': 1 if year >= 2023 else 0,   # eco-labeled equipment
    }


# ─────────────────────────────────────────────────────────────────────────────
# Compute monthly value with all adjustments
# ─────────────────────────────────────────────────────────────────────────────

def monthly_value(code: str, base: float, year: int, month: int) -> float:
    """Apply occupancy, efficiency, seasonality, and noise to a base monthly value."""
    occ  = occupancy_factor(year, month)
    eff  = efficiency_factor(year, code)
    ac   = summer_ac_boost(month) if code in ('HOSP-E-001', 'HOSP-E-003') else 1.0

    # Renewable generation grows over the years and is higher in summer (more sun)
    if code == 'HOSP-E-023':
        solar_years = {2019: 0, 2020: 0, 2021: 0,
                       2022: 0.5, 2023: 1.0, 2024: 1.18, 2025: 1.38, 2026: 1.38}
        solar_seasonal = {1:0.80, 2:0.85, 3:0.95, 4:1.00,
                          5:1.10, 6:1.15, 7:1.12, 8:1.12,
                          9:1.05, 10:0.95, 11:0.82, 12:0.78}
        val = base * solar_years.get(year, 0) * solar_seasonal[month]
        if year == 2026 and month > 6:
            val = 0  # data not yet available
        return round(val * random.uniform(0.97, 1.03), 2)

    # Recycling rate — improves year on year regardless of occupancy
    if code == 'HOSP-E-072':
        base_rate = min(55, 25 + (year - 2019) * 2.2)
        return round(base_rate + random.uniform(-1.5, 1.5), 1)

    # Renewable energy percentage
    if code == 'HOSP-E-069':
        pct = {2019:0, 2020:0, 2021:0, 2022:1.2, 2023:3.2, 2024:4.8, 2025:6.2, 2026:6.2}
        return round(pct.get(year, 0) + random.uniform(-0.1, 0.1), 1)

    # Boolean monthly (carbon calculator)
    if code == 'HOSP-E-043':
        return 1

    # Noise: ±5% random variation
    noise = random.uniform(0.95, 1.05)
    val = base * occ * eff * ac * noise

    # Recycled waste tracks total waste × improving recycling rate
    if code == 'HOSP-E-006':
        waste_base_code = 'HOSP-E-005'
        recycling_rate = min(55, 25 + (year - 2019) * 2.2) / 100
        waste_val = BASE_MONTHLY_A['HOSP-E-005'] * occ * efficiency_factor(year, waste_base_code) * noise
        return round(waste_val * recycling_rate, 1)

    return round(val, 2)


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

async def main():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    print("=" * 60)
    print("ESGravity Realistic Seed — 2019 to June 2026")
    print("=" * 60)

    async with async_session() as db:

        # ── Resolve company ───────────────────────────────────────────────
        company = (await db.execute(
            select(Company).where(Company.company_code == 'APEX01')
        )).scalars().first()
        if not company:
            print("ERROR: Company APEX01 not found. Run seed_demo_company.py first.")
            return
        print(f"[OK] Company: {company.name} (id={company.id}, emirate={company.emirate})")

        # ── Resolve sites ─────────────────────────────────────────────────
        sites_res = (await db.execute(
            select(Site).where(Site.company_id == company.id)
        )).scalars().all()
        sites = {s.name: s for s in sites_res}
        site_A = next((s for s in sites_res if 'marina' in s.name.lower()), None)
        site_B = next((s for s in sites_res if 'abu dhabi' in s.name.lower() or 'downtown' in s.name.lower()), None)

        if not site_A or not site_B:
            print(f"ERROR: Could not find both sites. Found: {[s.name for s in sites_res]}")
            return
        print(f"[OK] Site A: {site_A.name} (id={site_A.id})")
        print(f"[OK] Site B: {site_B.name} (id={site_B.id})")

        site_map = {'A': site_A, 'B': site_B}
        base_map = {'A': BASE_MONTHLY_A, 'B': BASE_MONTHLY_B}

        # ── Resolve admin user ────────────────────────────────────────────
        admin = (await db.execute(
            select(User).where(User.email == 'admin@apex.demo')
        )).scalars().first()
        if not admin:
            admin = (await db.execute(
                select(User).where(User.email == 'super@apex.demo')
            )).scalars().first()
        admin_id = admin.id if admin else None
        print(f"[OK] Admin user: {admin.email if admin else 'None'}")

        # ── Load all data elements into a lookup dict ─────────────────────
        all_elements_res = (await db.execute(select(DataElement))).scalars().all()
        elements_by_code = {e.element_code: e for e in all_elements_res}
        print(f"[OK] Loaded {len(elements_by_code)} data elements")

        # ── Load meters per site ──────────────────────────────────────────
        meters_res = (await db.execute(
            select(Meter).where(Meter.company_id == company.id)
        )).scalars().all()
        # meter lookup: (site_id, element_id) → meter
        meter_lookup: dict[tuple, int] = {}
        for m in meters_res:
            key = (m.site_id, m.data_element_id)
            if key not in meter_lookup:
                meter_lookup[key] = m.id

        # ── Wipe existing submissions for this company ────────────────────
        print("\nClearing existing submissions...")
        await db.execute(
            text("DELETE FROM data_submissions WHERE company_id = :cid"),
            {"cid": company.id}
        )
        await db.commit()
        print("[OK] Cleared.")

        total_inserted = 0

        # ─────────────────────────────────────────────────────────────────
        # MONTHLY ENVIRONMENTAL ELEMENTS — 2019 to June 2026
        # ─────────────────────────────────────────────────────────────────
        print("\nSeeding monthly Environmental elements (2019–2026)...")

        for site_key, site in site_map.items():
            bases = base_map[site_key]
            scale = 1.0 if site_key == 'A' else 0.80

            for year in range(2019, 2027):
                max_month = 6 if year == 2026 else 12

                for month in range(1, max_month + 1):
                    for code, base in bases.items():
                        el = elements_by_code.get(code)
                        if not el:
                            continue

                        val = monthly_value(code, base, year, month)

                        # Skip zero solar before installation
                        if code == 'HOSP-E-023' and val == 0:
                            continue

                        meter_id = meter_lookup.get((site.id, el.id))

                        db.add(DataSubmission(
                            company_id=company.id,
                            site_id=site.id,
                            data_element_id=el.id,
                            meter_id=meter_id,
                            year=year,
                            month=month,
                            value=val,
                            unit=el.unit,
                            submitted_by=admin_id,
                            notes=f"Historical data {year}-{month:02d}",
                            submitted_at=datetime.datetime(year, month, 28, 10, 0, 0),
                        ))
                        total_inserted += 1

                if total_inserted % 500 == 0:
                    await db.flush()

        await db.commit()
        print(f"  → Monthly E submissions: {total_inserted} rows")

        # ─────────────────────────────────────────────────────────────────
        # ANNUAL ENVIRONMENTAL ELEMENTS — 2019 to 2025 (+ 2026 partial)
        # ─────────────────────────────────────────────────────────────────
        print("\nSeeding annual Environmental elements (2019–2026)...")
        annual_E_count = 0
        report_month = 12  # annual data reported in December

        for site_key, site in site_map.items():
            scale = 1.0 if site_key == 'A' else 0.80

            for year in range(2019, 2027):
                ym = 6 if year == 2026 else report_month

                # Numeric annual E values
                vals = annual_E_values(year, site_key)
                for code, val in vals.items():
                    el = elements_by_code.get(code)
                    if not el:
                        continue
                    scaled_val = round(val * scale if site_key == 'B' else val, 2)
                    db.add(DataSubmission(
                        company_id=company.id,
                        site_id=site.id,
                        data_element_id=el.id,
                        meter_id=None,
                        year=year,
                        month=ym,
                        value=scaled_val,
                        unit=el.unit,
                        submitted_by=admin_id,
                        notes=f"Annual report {year}",
                        submitted_at=datetime.datetime(year, ym, 28, 9, 0, 0),
                    ))
                    annual_E_count += 1

                # Boolean annual E values
                bools = annual_E_boolean(year)
                for code, val in bools.items():
                    el = elements_by_code.get(code)
                    if not el:
                        continue
                    db.add(DataSubmission(
                        company_id=company.id,
                        site_id=site.id,
                        data_element_id=el.id,
                        meter_id=None,
                        year=year,
                        month=ym,
                        value=val,
                        unit='boolean',
                        submitted_by=admin_id,
                        notes=f"Annual policy review {year}",
                        submitted_at=datetime.datetime(year, ym, 28, 9, 30, 0),
                    ))
                    annual_E_count += 1

        await db.commit()
        print(f"  → Annual E submissions: {annual_E_count} rows")

        # ─────────────────────────────────────────────────────────────────
        # ANNUAL SOCIAL ELEMENTS — 2019 to 2026
        # ─────────────────────────────────────────────────────────────────
        print("\nSeeding Social elements (2019–2026)...")
        social_count = 0

        for site_key, site in site_map.items():
            for year in range(2019, 2027):
                ym = 6 if year == 2026 else report_month

                # Numeric S values
                s_vals = annual_S_values(year, site_key)
                for code, val in s_vals.items():
                    el = elements_by_code.get(code)
                    if not el:
                        continue
                    db.add(DataSubmission(
                        company_id=company.id,
                        site_id=site.id,
                        data_element_id=el.id,
                        meter_id=None,
                        year=year,
                        month=ym,
                        value=val,
                        unit=el.unit,
                        submitted_by=admin_id,
                        notes=f"Annual HR & Social report {year}",
                        submitted_at=datetime.datetime(year, ym, 29, 10, 0, 0),
                    ))
                    social_count += 1

                # Boolean S values
                s_bools = annual_S_boolean(year)
                for code, val in s_bools.items():
                    el = elements_by_code.get(code)
                    if not el:
                        continue
                    db.add(DataSubmission(
                        company_id=company.id,
                        site_id=site.id,
                        data_element_id=el.id,
                        meter_id=None,
                        year=year,
                        month=ym,
                        value=val,
                        unit='boolean',
                        submitted_by=admin_id,
                        notes=f"Social policy review {year}",
                        submitted_at=datetime.datetime(year, ym, 29, 10, 30, 0),
                    ))
                    social_count += 1

        await db.commit()
        print(f"  → Social submissions: {social_count} rows")

        # ─────────────────────────────────────────────────────────────────
        # ANNUAL GOVERNANCE ELEMENTS — 2019 to 2026
        # ─────────────────────────────────────────────────────────────────
        print("\nSeeding Governance elements (2019–2026)...")
        gov_count = 0

        for site_key, site in site_map.items():
            for year in range(2019, 2027):
                ym = 6 if year == 2026 else report_month

                # Numeric G values
                g_vals = annual_G_values(year, site_key)
                for code, val in g_vals.items():
                    el = elements_by_code.get(code)
                    if not el:
                        continue
                    db.add(DataSubmission(
                        company_id=company.id,
                        site_id=site.id,
                        data_element_id=el.id,
                        meter_id=None,
                        year=year,
                        month=ym,
                        value=val,
                        unit=el.unit,
                        submitted_by=admin_id,
                        notes=f"Governance review {year}",
                        submitted_at=datetime.datetime(year, ym, 30, 9, 0, 0),
                    ))
                    gov_count += 1

                # Boolean G values
                g_bools = annual_G_boolean(year)
                for code, val in g_bools.items():
                    el = elements_by_code.get(code)
                    if not el:
                        continue
                    db.add(DataSubmission(
                        company_id=company.id,
                        site_id=site.id,
                        data_element_id=el.id,
                        meter_id=None,
                        year=year,
                        month=ym,
                        value=val,
                        unit='boolean',
                        submitted_by=admin_id,
                        notes=f"Governance policy review {year}",
                        submitted_at=datetime.datetime(year, ym, 30, 9, 30, 0),
                    ))
                    gov_count += 1

        await db.commit()
        print(f"  → Governance submissions: {gov_count} rows")

        # ─────────────────────────────────────────────────────────────────
        # SUMMARY
        # ─────────────────────────────────────────────────────────────────
        final_count = (await db.execute(
            text("SELECT COUNT(*) FROM data_submissions WHERE company_id = :cid"),
            {"cid": company.id}
        )).scalar()

        print("\n" + "=" * 60)
        print(f"SEED COMPLETE")
        print(f"  Total submissions in DB:  {final_count}")
        print(f"  Date range:               Jan 2019 → Jun 2026")
        print(f"  Sites:                    {site_A.name}, {site_B.name}")
        print(f"  Monthly E rows/site:      {17 * 90} months × 2 sites")
        print(f"  Annual E+S+G rows/site:   ~{(len(annual_E_values(2025,'A')) + len(annual_E_boolean(2025)) + len(annual_S_values(2025,'A')) + len(annual_S_boolean(2025)) + len(annual_G_values(2025,'A')) + len(annual_G_boolean(2025)))} elements × 8 years × 2 sites")
        print("=" * 60)
        print()
        print("Key data patterns seeded:")
        print("  ✓ COVID drop in 2020 (40–60% consumption reduction)")
        print("  ✓ Gradual recovery 2021, full recovery 2022")
        print("  ✓ Expo 2020 boost (Oct–Dec 2021)")
        print("  ✓ Summer AC spike (Jun–Sep each year)")
        print("  ✓ Winter tourism peak (Nov–Feb each year)")
        print("  ✓ Solar panels installed mid-2022, growing to 2025")
        print("  ✓ Recycling rate 25% → 45%+ over the period")
        print("  ✓ LED lighting 45% → 95%+ over the period")
        print("  ✓ Workforce growth with COVID layoff dip in 2020")
        print("  ✓ Training hours improving year-on-year")
        print("  ✓ Governance policies rolling out progressively 2020–2023")
        print("  ✓ Carbon reduction target growing each year")
        print("  ✓ All values include ±5% realistic monthly noise")


if __name__ == "__main__":
    asyncio.run(main())
