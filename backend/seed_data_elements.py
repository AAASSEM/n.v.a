"""Seed the master catalog of DataElements (the metrics every company tracks).

These are the E / S / G data points. Only a trimmed canonical set is seeded
here — enough for the onboarding wizard to generate a realistic checklist with
metered and non-metered items across frameworks. Safe to re-run.
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

from app.core.config import settings
from app.models.data_element import DataElement


# (code, name, category, unit, frequency, condition_logic, frameworks, is_metered, meter_type)
ELEMENTS = [
    # ── Always-on core metrics ────────────────────────────────────────────
    ("ELEC-001",   "Electricity Consumption",     "E", "kWh",     "Monthly",   None, "ESG,DST,Green Key", True,  "Electricity"),
    ("WATER-001",  "Water Consumption",           "E", "m³",      "Monthly",   None, "ESG,DST,Green Key", True,  "Water"),
    ("WASTE-001",  "General Waste Generated",     "E", "kg",      "Monthly",   None, "ESG,DST,Green Key", True,  "Waste"),
    ("COOL-001",   "District Cooling",            "E", "RTh",     "Monthly",   None, "ESG,DST",           True,  "Cooling"),
    ("GAS-001",    "LPG / Cooking Gas",           "E", "kg",      "Monthly",   "Do you operate an in-house restaurant or commercial kitchen?", "ESG,DST", True, "Gas"),

    # ── Conditional metered metrics ──────────────────────────────────────
    ("FUEL-FLT-001", "Fleet Fuel (Diesel/Petrol)","E", "L",       "Monthly",   "Do you maintain a fleet of company-owned vehicles?", "ESG,DST", True, "Fuel"),
    ("POOL-W-001",   "Pool Top-Up Water",         "E", "m³",      "Monthly",   "Do you have swimming pools or spas?",                 "ESG,DST,Green Key", True, "Water"),
    ("LND-W-001",    "Irrigation Water",          "E", "m³",      "Monthly",   "Do you manage extensive landscaped gardens or golf courses?", "ESG,Green Key", True, "Water"),
    ("SOLAR-001",    "Solar Generation",          "E", "kWh",     "Monthly",   "Do you have solar panels or other on-site renewable energy generation?", "ESG,DST,Green Key", True, "Energy"),
    ("EV-001",       "EV Charging Consumption",   "E", "kWh",     "Monthly",   "Do you offer EV charging stations for guests or staff?", "ESG,DST,Green Key", True, "Electricity"),

    # ── Social / Governance (non-metered, policy-type) ───────────────────
    ("EMP-001",      "Total Employees (FTE)",     "S", "people",  "Annually",  None, "ESG,DST,Green Key", False, None),
    ("TRAIN-001",    "Sustainability Training Hours", "S", "hours", "Annually", "Do you have an active sustainability/green team?", "ESG,DST,Green Key", False, None),
    ("POL-PLASTIC",  "Single-Use Plastics Policy Status", "G", "status", "Annually", "Do you have a formal single-use plastics reduction policy?", "ESG,DST,Green Key", False, None),
    ("POL-LINEN",    "Linen Reuse Program Status","G", "status",  "Annually",  "Do you run a linen and towel reuse program for guests?", "DST,Green Key", False, None),
    ("POL-AMENITY",  "Refillable Amenity Coverage","G", "%",      "Annually",  "Do you use refillable guest amenity dispensers (shampoo, soap, lotion)?", "DST,Green Key", False, None),
]


async def seed_elements():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        existing = {e.element_code for e in (await db.execute(select(DataElement))).scalars().all()}
        added = 0
        for code, name, cat, unit, freq, cond, fws, metered, mt in ELEMENTS:
            if code in existing:
                continue
            db.add(DataElement(
                element_code=code,
                name=name,
                category=cat,
                unit=unit,
                collection_frequency=freq,
                condition_logic=cond,
                frameworks=fws,
                is_metered=metered,
                meter_type=mt,
            ))
            added += 1
        await db.commit()
        print(f"Seeded {added} new data elements (catalog total = {len(ELEMENTS)})")


if __name__ == "__main__":
    asyncio.run(seed_elements())
