"""
dashboard.py — ESGravity Dashboard API
=======================================

Endpoints
---------
GET /dashboard/metrics          Main KPI cards + 7-month chart
GET /dashboard/elements         Individual element values for S / G pillars
GET /dashboard/compare          Month-over-month comparison for any two periods

Carbon accounting:
  Uses app/services/carbon_accounting.py (GHG Protocol, Scope 1 + 2).
  No demo/mock formulas anywhere in this file.
"""

from __future__ import annotations
from typing import Any, Optional
import datetime
from dateutil.relativedelta import relativedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_

from app.api.deps import get_db, get_current_active_user, resolve_site_id
from app.models.user import User
from app.models.submission import DataSubmission
from app.models.data_element import DataElement
from app.models.company import Company, Site
from app.services.carbon_accounting import (
    build_emissions_breakdown,
    ELEMENT_EF_MAP,
    get_electricity_ef,
    get_electricity_ef_source,
)

router = APIRouter()

# Framework display-name → DB abbreviation mapping
# DB stores: E (ESG), D (DST), G (GREEN KEY)
FRAMEWORK_NAME_TO_ABBR = {
    "ESG": "E",
    "DST": "D",
    "GREEN KEY": "G",
    "GREENKEY": "G",
    "GREEN_KEY": "G",
    # pass-through for already-abbreviated values
    "E": "E",
    "D": "D",
    "G": "G",
}

def _resolve_framework(fw: Optional[str]) -> Optional[str]:
    """Convert a user-facing framework name to the DB abbreviation."""
    if not fw:
        return None
    return FRAMEWORK_NAME_TO_ABBR.get(fw.upper().strip(), fw)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _display_category(name: str, db_cat: str) -> str:
    """Map an element to a chart/stat bucket."""
    n = name.lower()
    if "recycling rate" in n:
        return "Recycling Rate"
    if "renewable energy" in n and "%" in n:
        return "Renewable Energy %"
    if "water" in n:
        return "Water"
    if "waste" in n or "recycling" in n or "compost" in n:
        return "Waste"
    if "fuel" in n or "diesel" in n or "petrol" in n or "vehicle" in n:
        return "Fuel"
    if "energy" in n or "electricity" in n or "lighting" in n or "cooling" in n:
        return "Energy"
    if db_cat == "S":
        return "Social"
    if db_cat == "G":
        return "Governance"
    if db_cat == "E":
        return "Environment Other"
    return "Other"

def _is_additive(db_cat: str, el_unit: Optional[str], disp: str) -> bool:
    """Determine if a metric's unit should be summed into the category total."""
    if not el_unit: 
        return True
    u = el_unit.lower().strip()
    if u in ("boolean", "count", "l/min", "text"): 
        return False
    if u == "%" and disp not in ("Recycling Rate", "Renewable Energy %"): 
        return False
    # If the unit has weird characters like m, we assume it's m³ which is additive.
    return True


def _trend(this_val: float, prev_val: float) -> tuple[str, str]:
    """Return (direction, label) comparing two monthly totals."""
    if prev_val == 0:
        return "neutral", "No prior data"
    if prev_val < 1.0:
        return "neutral", "Insufficient prior data"
    pct = ((this_val - prev_val) / prev_val) * 100
    if abs(pct) > 999:
        return "neutral", "Large variance — check data"
    if abs(pct) < 0.01:
        return "neutral", "No change"
    direction = "up" if pct > 0 else "down"
    return direction, f"{abs(pct):.1f}% vs last month"


# Whether a higher value is better for a given element code
# True  = higher is better (training, recycled waste, renewables …)
# False = lower is better  (energy, water, emissions, fuel …)
_IMPROVEMENT_DIR: dict[str, bool] = {
    "HOSP-E-006": True,   # Waste Recycled
    "HOSP-E-023": True,   # Renewable Generation
    "HOSP-E-069": True,   # Renewable Energy %
    "HOSP-E-072": True,   # Recycling Rate
    "HOSP-S-024": True,   # Workforce Size
    "HOSP-S-025": True,   # Female Employee %
    "HOSP-S-026": True,   # New Hires
    "HOSP-S-028": True,   # Training Hours / Employee
    "HOSP-S-032": True,   # Grievances Resolved
    "HOSP-S-034": True,   # Community Investment
    "HOSP-S-076": True,   # Staff Training Hours
    "HOSP-S-077": True,   # Community Engagement Activities
    "HOSP-G-060": True,   # Annual Action Plan (more actions = better)
    "HOSP-G-061": True,   # Carbon Reduction Target %
    "HOSP-G-078": True,   # Eco-labeled Cleaning Products %
}

def _is_improvement(code: str, direction: str) -> bool:
    higher_is_better = _IMPROVEMENT_DIR.get(code, False)
    if direction == "neutral":
        return True
    return (direction == "up") == higher_is_better


async def _get_emirate(
    db: AsyncSession,
    company_id: int,
    site_id: Optional[int] = None,
) -> Optional[str]:
    """
    Return the emirate for GHG grid factor lookup.
    Priority: Site.emirate → Company.emirate → None (defaults to Dubai in carbon engine)
    """
    if site_id:
        result = await db.execute(
            select(Site).where(Site.id == site_id)
        )
        site_obj = result.scalar_one_or_none()
        if site_obj:
            search_str = f"{site_obj.location or ''} {site_obj.name or ''}".lower()
            emirates = ["abu dhabi", "dubai", "sharjah", "ajman", "ras al khaimah", "fujairah", "umm al quwain"]
            for em in emirates:
                if em in search_str:
                    return em
            if site_obj.location:
                return site_obj.location
    # Fallback to company-level emirate
    result = await db.execute(
        select(Company.emirate).where(Company.id == company_id)
    )
    return result.scalar_one_or_none()


def get_electricity_ef_source(emirate: Optional[str]) -> str:
    """Human-readable source label for the grid emission factor."""
    if not emirate:
        return "DEWA 2023 (default)"
    e = emirate.lower().strip()
    sources = {
        "dubai":           "DEWA Sustainability Report 2023",
        "abu dhabi":       "ADWEA Annual Report 2023",
        "sharjah":         "IEA UAE National Average 2023",
        "ajman":           "IEA UAE National Average 2023",
        "ras al khaimah":  "IEA UAE National Average 2023",
        "fujairah":        "IEA UAE National Average 2023",
        "umm al quwain":   "IEA UAE National Average 2023",
    }
    return sources.get(e, "IEA UAE National Average 2023")


async def _base_filters(
    current_user: User,
    site_id: Optional[int],
    db: AsyncSession,
    pillar: Optional[str] = None,
    framework: Optional[str] = None,
) -> tuple[int, Optional[int], list]:
    """Resolve company_id, effective site_id, and shared WHERE clauses."""
    company_id = current_user.profile.company_id if current_user.profile else None
    if not company_id:
        raise HTTPException(status_code=400, detail="User not assigned to a company.")

    effective_site_id = await resolve_site_id(current_user, site_id, db, required=False)

    filters = [
        DataSubmission.company_id == company_id,
        DataSubmission.value.isnot(None),
    ]
    if effective_site_id is not None:
        filters.append(DataSubmission.site_id == effective_site_id)
    if pillar in ("E", "S", "G"):
        filters.append(DataElement.category == pillar)
    if framework:
        fw_abbr = _resolve_framework(framework)
        filters.append(
            or_(
                DataElement.frameworks.ilike(f"%{fw_abbr}%"),
                DataElement.frameworks == None,
                DataElement.frameworks == ""
            )
        )

    return company_id, effective_site_id, filters


# ─────────────────────────────────────────────────────────────────────────────
# GET /dashboard/metrics
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/metrics")
async def get_dashboard_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    site_id: Optional[int] = Query(None),
    pillar: Optional[str] = Query(None),   # "E" | "S" | "G" | None
    framework: Optional[str] = Query(None),
    target_year: Optional[int] = Query(None),
    target_month: Optional[int] = Query(None),
) -> Any:
    """
    Main dashboard KPI cards and 7-month chart data.

    When pillar is set, stat cards and chart series are scoped to that pillar.
    Carbon GHG cards are always Pillar E and are suppressed for S / G.
    """
    company_id, effective_site_id, filters = await _base_filters(
        current_user, site_id, db, pillar, framework
    )
    emirate = await _get_emirate(db, company_id, effective_site_id)

    today = datetime.date.today()

    # ── Pull all submissions joined to their element ──────────────────────
    query = (
        select(
            DataSubmission.year,
            DataSubmission.month,
            DataSubmission.value,
            DataElement.category,
            DataElement.name,
            DataElement.element_code,
            DataElement.unit,
        )
        .join(DataElement, DataSubmission.data_element_id == DataElement.id)
        .where(*filters)
    )
    result = await db.execute(query)
    rows = result.all()

    is_specific_period = target_year is not None and target_month is not None
    if not is_specific_period:
        target_year = today.year
        target_month = today.month

    # ── YTD skeleton (Jan to target_month) ──────────────────────────
    import calendar
    months_series = []
    for m in range(1, target_month + 1):
        months_series.append({"year": target_year, "month": m, "name": calendar.month_abbr[m]})
    month_index = {(m["year"], m["month"]): m for m in months_series}

    stats_map: dict[str, float] = {}
    stats_elements: dict[str, dict[str, dict]] = {}
    global_stats: dict[tuple, dict] = {}
    carbon_inputs: list[tuple] = []
    found_categories: set[str] = set()

    for year, month, value, db_cat, el_name, el_code, el_unit in rows:
        if value is None:
            continue
        fval = float(value)
        disp = _display_category(el_name, db_cat)
        found_categories.add(disp)

        if year == target_year and month == target_month:
            if disp not in stats_elements:
                stats_elements[disp] = {}
            if el_code not in stats_elements[disp]:
                stats_elements[disp][el_code] = {"code": el_code, "name": el_name, "value": 0, "unit": el_unit}
            stats_elements[disp][el_code]["value"] += fval

            if _is_additive(db_cat, el_unit, disp):
                stats_map[disp] = stats_map.get(disp, 0) + fval

        if _is_additive(db_cat, el_unit, disp):
            if (year, month) in month_index:
                slot = month_index[(year, month)]
                slot[disp] = slot.get(disp, 0) + fval
                
            if (year, month) not in global_stats:
                global_stats[(year, month)] = {}
            global_stats[(year, month)][disp] = global_stats[(year, month)].get(disp, 0) + fval

        carbon_inputs.append((el_code, fval, year, month))

    # Fallback to previous month if no specific period was requested and current month is empty
    if not is_specific_period and not stats_map:
        prev = today.replace(day=1) - datetime.timedelta(days=1)
        target_year = prev.year
        target_month = prev.month
        # Rebuild skeleton for the fallback target_month
        months_series = []
        for m in range(1, target_month + 1):
            months_series.append({"year": target_year, "month": m, "name": calendar.month_abbr[m]})
        month_index = {(m["year"], m["month"]): m for m in months_series}
        # Re-run slot mapping for new skeleton
        for year, month, value, db_cat, el_name, el_code, el_unit in rows:
            if value is None:
                continue
            fval = float(value)
            disp = _display_category(el_name, db_cat)
            if _is_additive(db_cat, el_unit, disp):
                if (year, month) in month_index:
                    slot = month_index[(year, month)]
                    slot[disp] = slot.get(disp, 0) + fval

        for year, month, value, db_cat, el_name, el_code, el_unit in rows:
            if value is None:
                continue
            if year == prev.year and month == prev.month:
                fval = float(value)
                disp = _display_category(el_name, db_cat)
                
                if disp not in stats_elements:
                    stats_elements[disp] = {}
                if el_code not in stats_elements[disp]:
                    stats_elements[disp][el_code] = {"code": el_code, "name": el_name, "value": 0, "unit": el_unit}
                stats_elements[disp][el_code]["value"] += fval

                if _is_additive(db_cat, el_unit, disp):
                    stats_map[disp] = stats_map.get(disp, 0) + fval

    # ── GHG engine ────────────────────────────────────────────────────────
    show_ghg = pillar in (None, "E")
    if framework and _resolve_framework(framework) == "G":
        show_ghg = False
    
    ghg = None
    if show_ghg:
        # All-time for charts
        ghg_all = build_emissions_breakdown(carbon_inputs, emirate=emirate)
        for em in ghg_all["monthly_emissions"]:
            key = (em["year"], em["month"])
            if key in month_index:
                slot = month_index[key]
                slot["Scope 1"] = round(em["scope1"], 3)
                slot["Scope 2"] = round(em["scope2"], 3)
                slot["Emissions"] = round(em["total"], 3)

        # Target period only for the stat cards
        target_carbon_inputs = [c for c in carbon_inputs if c[2] == target_year and c[3] == target_month]
        ghg = build_emissions_breakdown(target_carbon_inputs, emirate=emirate)

    # ── Month-over-month trend helpers ────────────────────────────────────
    this_m  = (target_year, target_month)
    prev_m  = (target_year - 1, 12) if target_month == 1 else (target_year, target_month - 1)

    def cat_trend(cat: str):
        a = global_stats.get(this_m, {}).get(cat, 0)
        b = global_stats.get(prev_m, {}).get(cat, 0)
        return _trend(a, b)

    # ── Build stat cards ──────────────────────────────────────────────────
    UNIT_MAP = {
        "Energy": " kWh", "Water": " m³", "Waste": " kg", "Fuel": " L",
        "Recycling Rate": "%", "Renewable Energy %": "%"
    }
    formatted_stats = []

    for cat, total in stats_map.items():
        if cat in ("Social", "Governance", "Environment Other", "Other"):
            continue   # S, G and incomparable E-buckets shown via /elements
        trend, change = cat_trend(cat)
        
        # Convert dict of elements to a sorted list
        contributing_elements = list(stats_elements.get(cat, {}).values())
        contributing_elements.sort(key=lambda x: (-x["value"], x["name"]))
        
        formatted_stats.append({
            "name": f"Total {cat}" if cat not in ("Recycling Rate", "Renewable Energy %") else cat,
            "value": f"{total:,.1f}{UNIT_MAP.get(cat, '')}" if cat in ("Recycling Rate", "Renewable Energy %") else f"{total:,.0f}{UNIT_MAP.get(cat, '')}",
            "change": change,
            "trend": trend,
            "pillar": "E" if cat not in ("Social", "Governance") else ("S" if cat == "Social" else "G"),
            "contributing_elements": contributing_elements,
        })

    # GHG scope cards
    if ghg and show_ghg:
        target_carbon_this = [c for c in carbon_inputs if c[2] == this_m[0] and c[3] == this_m[1]]
        target_carbon_prev = [c for c in carbon_inputs if c[2] == prev_m[0] and c[3] == prev_m[1]]
        em_this = build_emissions_breakdown(target_carbon_this, emirate=emirate)["total_tco2e"]
        em_prev = build_emissions_breakdown(target_carbon_prev, emirate=emirate)["total_tco2e"]
        
        em_trend, em_change = _trend(em_this, em_prev)

        full_breakdown = [
            {
                "label": v["label"],
                "scope": v["scope"],
                "tco2e": round(v["tco2e"], 3),
                "ef_used": v["ef_used"],
                "unit": v["unit"],
            }
            for v in ghg["breakdown_by_source"].values()
            if abs(v["tco2e"]) > 0
        ]
        scope1_breakdown = [b for b in full_breakdown if b["scope"] == 1]
        scope2_breakdown = [b for b in full_breakdown if b["scope"] == 2]
        
        grid_ef = get_electricity_ef(emirate)

        formatted_stats += [
            {
                "name": "Scope 1 Emissions",
                "value": f"{ghg['scope1_tco2e']:,.2f} tCO₂e",
                "change": "Direct combustion + fugitive",
                "trend": "neutral",
                "pillar": "E",
                "scope": 1,
                "breakdown": scope1_breakdown,
                "methodology": (
                    f"Scope 1 covers direct GHG emissions from sources owned or controlled by the company. "
                    f"Diesel combustion: 2.684 kgCO₂e/L (IPCC 2006 Vol.2 + DEFRA 2023). "
                    f"Petrol combustion: 2.312 kgCO₂e/L (DEFRA 2023). "
                    f"LPG combustion: 2.943 kgCO₂e/kg (IPCC 2006 Table 1.4, propane-dominant blend). "
                    f"Refrigerant leakage (R-410A): 2,088 kgCO₂e/kg GWP100 (IPCC AR5 Table AII.1.2). "
                    f"Standard: GHG Protocol Corporate Accounting and Reporting Standard."
                ),
            },
            {
                "name": "Scope 2 Emissions",
                "value": f"{ghg['scope2_tco2e']:,.2f} tCO₂e",
                "change": f"Grid: {emirate or 'UAE'} location-based",
                "trend": "neutral",
                "pillar": "E",
                "scope": 2,
                "breakdown": scope2_breakdown,
                "emirate": emirate,
                "grid_ef": grid_ef,
                "grid_ef_source": get_electricity_ef_source(emirate),
                "methodology": (
                    f"Scope 2 covers indirect GHG emissions from purchased electricity and district cooling. "
                    f"Method: location-based (uses average grid emission factor for {emirate or 'UAE'}). "
                    f"Electricity grid factor ({(emirate or 'UAE').title()}): {grid_ef} kgCO₂e/kWh "
                    f"({get_electricity_ef_source(emirate)}). "
                    f"District cooling: 0.0928 kgCO₂e/RT-h (Tabreed/EMPOWER UAE benchmark, "
                    f"derived from grid EF ÷ system COP 4.92). "
                    f"On-site renewable generation offsets Scope 2 at the same grid factor. "
                    f"Standard: GHG Protocol Corporate Accounting and Reporting Standard."
                ),
            },
            {
                "name": "Total GHG Emissions",
                "value": f"{ghg['total_tco2e']:,.2f} tCO₂e",
                "change": em_change,
                "trend": em_trend,
                "pillar": "E",
                "breakdown": full_breakdown,
                "emirate": emirate,
                "grid_ef": grid_ef,
                "grid_ef_source": get_electricity_ef_source(emirate),
                "methodology": ghg["methodology"],
            },
        ]

    # ── Chart category list ───────────────────────────────────────────────
    ORDER = ["Energy", "Water", "Waste", "Fuel", "Recycling Rate", "Renewable Energy %", "Emissions"]
    chart_categories = sorted(
        [c for c in found_categories if c not in ("Social", "Governance", "Other", "Environment Other")],
        key=lambda x: ORDER.index(x) if x in ORDER else 99,
    )

    grid_ef = get_electricity_ef(emirate) if show_ghg else None

    return {
        "stats": formatted_stats,
        "chartData": months_series,
        "categories": chart_categories,
        "pillar": pillar,
        "ghg_visible": show_ghg,
        "emirate": emirate,
        "grid_ef": grid_ef,
        "grid_ef_source": get_electricity_ef_source(emirate),
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /dashboard/elements
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/elements")
async def get_pillar_elements(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    site_id: Optional[int] = Query(None),
    pillar: str = Query(...),   # required: "S" or "G"
    framework: Optional[str] = Query(None),
    target_year: Optional[int] = Query(None),
    target_month: Optional[int] = Query(None),
) -> Any:
    """
    Return individual element values for the Social or Governance pillar.

    Each element is returned as its own card — never aggregated.
    For boolean elements, value 1 = Yes, 0 = No.
    Uses the most recently submitted value per element.
    """
    if pillar not in ("S", "G"):
        raise HTTPException(status_code=400, detail="pillar must be 'S' or 'G'")

    company_id, effective_site_id, filters = await _base_filters(
        current_user, site_id, db, pillar, framework
    )

    from sqlalchemy import func as sqlfunc

    if target_year and pillar in ("S", "G"):
        sub = (
            select(
                DataSubmission.data_element_id,
                sqlfunc.max(DataSubmission.year * 100 + DataSubmission.month).label("latest_ym"),
            )
            .join(DataElement, DataSubmission.data_element_id == DataElement.id)
            .where(*filters)
            .where(DataSubmission.year == target_year)
            .group_by(DataSubmission.data_element_id)
            .subquery()
        )
    else:
        sub = (
            select(
                DataSubmission.data_element_id,
                sqlfunc.max(DataSubmission.year * 100 + DataSubmission.month).label("latest_ym"),
            )
            .join(DataElement, DataSubmission.data_element_id == DataElement.id)
            .where(*filters)
            .group_by(DataSubmission.data_element_id)
            .subquery()
        )

    query = (
        select(
            DataElement.element_code,
            DataElement.name,
            DataElement.unit,
            DataElement.category,
            DataSubmission.value,
            DataSubmission.year,
            DataSubmission.month,
        )
        .join(DataElement, DataSubmission.data_element_id == DataElement.id)
        .join(
            sub,
            (DataSubmission.data_element_id == sub.c.data_element_id) &
            (DataSubmission.year * 100 + DataSubmission.month == sub.c.latest_ym),
        )
        .where(*filters)
        .order_by(DataElement.element_code)
    )

    result = await db.execute(query)
    rows = result.all()

    elements = []
    for code, name, unit, category, value, year, month in rows:
        elements.append({
            "code": code,
            "name": name,
            "unit": unit,
            "value": float(value) if value is not None else None,
            "year": year,
            "month": month,
        })

    history_query = (
        select(
            DataElement.element_code,
            DataSubmission.value,
            DataSubmission.year,
            DataSubmission.month,
        )
        .join(DataElement, DataSubmission.data_element_id == DataElement.id)
        .where(*filters)
    )
    history_result = await db.execute(history_query)
    history_rows = history_result.all()
    
    history = []
    for code, value, year, month in history_rows:
        history.append({
            "code": code,
            "value": float(value) if value is not None else None,
            "year": year,
            "month": month,
        })

    if elements:
        latest = max(elements, key=lambda e: e["year"] * 100 + e["month"])
        import calendar
        reported_period = f"{calendar.month_abbr[latest['month']]} {latest['year']}"
    else:
        reported_period = None

    return {
        "pillar": pillar,
        "elements": elements,
        "history": history,
        "reported_period": reported_period,
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /dashboard/compare
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/compare")
async def get_month_comparison(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    site_id: Optional[int] = Query(None),
    month_a_year:  int = Query(...),
    month_a_month: int = Query(...),
    month_b_year:  int = Query(...),
    month_b_month: int = Query(...),
    pillar: Optional[str] = Query(None),
) -> Any:
    """
    Compare any two months across all submitted elements.

    Returns per-element deltas, improvement verdicts, a summary,
    and a GHG sub-comparison using the production carbon engine.
    """
    if (month_a_year, month_a_month) == (month_b_year, month_b_month):
        raise HTTPException(status_code=400, detail="Select two different months.")

    company_id, effective_site_id, base_filters = await _base_filters(
        current_user, site_id, db, pillar
    )
    emirate = await _get_emirate(db, company_id, effective_site_id)

    # ── Fetch submissions for BOTH months in one query ────────────────────
    filters = base_filters + [
        (
            ((DataSubmission.year == month_a_year) & (DataSubmission.month == month_a_month)) |
            ((DataSubmission.year == month_b_year) & (DataSubmission.month == month_b_month))
        )
    ]

    query = (
        select(
            DataElement.element_code,
            DataElement.name,
            DataElement.category,
            DataElement.unit,
            DataSubmission.year,
            DataSubmission.month,
            DataSubmission.value,
        )
        .join(DataElement, DataSubmission.data_element_id == DataElement.id)
        .where(*filters)
        .order_by(DataElement.element_code)
    )
    result = await db.execute(query)
    rows = result.all()

    # ── Index values by (code, year, month) ──────────────────────────────
    data_a: dict[str, dict] = {}   # code → {name, category, unit, value}
    data_b: dict[str, dict] = {}

    for code, name, category, unit, year, month, value in rows:
        entry = {"name": name, "category": category, "unit": unit, "value": float(value) if value is not None else None}
        if year == month_a_year and month == month_a_month:
            data_a[code] = entry
        else:
            data_b[code] = entry

    # ── Build comparison rows ─────────────────────────────────────────────
    all_codes = sorted(set(data_a.keys()) | set(data_b.keys()))
    compare_rows = []
    ghg_inputs_a: list[tuple] = []
    ghg_inputs_b: list[tuple] = []

    improvements = regressions = no_change = 0

    for code in all_codes:
        a_entry = data_a.get(code)
        b_entry = data_b.get(code)

        meta = a_entry or b_entry
        val_a = a_entry["value"] if a_entry else None
        val_b = b_entry["value"] if b_entry else None

        # Compute delta
        if val_a is not None and val_b is not None:
            delta = val_b - val_a
            delta_pct = (delta / val_a * 100) if val_a != 0 else None
            if delta > 0:
                direction = "up"
            elif delta < 0:
                direction = "down"
            else:
                direction = "neutral"
        else:
            delta = None
            delta_pct = None
            direction = "neutral"

        is_good = _is_improvement(code, direction)

        if delta_pct is not None:
            if direction == "neutral":
                no_change += 1
            elif is_good:
                improvements += 1
            else:
                regressions += 1

        compare_rows.append({
            "element_code": code,
            "name": meta["name"],
            "category": meta["category"],
            "unit": meta["unit"],
            "value_a": val_a,
            "value_b": val_b,
            "delta": round(delta, 4) if delta is not None else None,
            "delta_pct": round(delta_pct, 2) if delta_pct is not None else None,
            "direction": direction,
            "is_improvement": is_good,
        })

        # Feed GHG engine
        if code in ELEMENT_EF_MAP:
            if val_a is not None:
                ghg_inputs_a.append((code, val_a, month_a_year, month_a_month))
            if val_b is not None:
                ghg_inputs_b.append((code, val_b, month_b_year, month_b_month))

    # ── GHG comparison ────────────────────────────────────────────────────
    ghg_result = None
    if ghg_inputs_a or ghg_inputs_b:
        ghg_a = build_emissions_breakdown(ghg_inputs_a, emirate=emirate)
        ghg_b = build_emissions_breakdown(ghg_inputs_b, emirate=emirate)
        a_total = ghg_a["total_tco2e"]
        b_total = ghg_b["total_tco2e"]
        delta_ghg = b_total - a_total
        delta_pct_ghg = (delta_ghg / a_total * 100) if a_total != 0 else 0
        ghg_result = {
            "month_a_tco2e": a_total,
            "month_b_tco2e": b_total,
            "delta_tco2e": round(delta_ghg, 3),
            "delta_pct": round(delta_pct_ghg, 2),
            "scope1_a": ghg_a["scope1_tco2e"],
            "scope1_b": ghg_b["scope1_tco2e"],
            "scope2_a": ghg_a["scope2_tco2e"],
            "scope2_b": ghg_b["scope2_tco2e"],
        }

    # ── Month labels ──────────────────────────────────────────────────────
    import calendar
    def month_label(y: int, m: int) -> str:
        return f"{calendar.month_abbr[m]} {y}"

    return {
        "month_a": {"label": month_label(month_a_year, month_a_month), "year": month_a_year, "month": month_a_month},
        "month_b": {"label": month_label(month_b_year, month_b_month), "year": month_b_year, "month": month_b_month},
        "rows": compare_rows,
        "summary": {
            "total_elements_compared": len(compare_rows),
            "improvements": improvements,
            "regressions": regressions,
            "no_change": no_change,
        },
        "ghg": ghg_result,
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /dashboard/completeness
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/completeness")
async def get_completeness(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    site_id: Optional[int] = Query(None),
    framework: Optional[str] = Query(None),
) -> Any:
    """
    Data completeness tracker for the current month.
    """
    import calendar
    from sqlalchemy import func as sqlfunc
    
    today = datetime.date.today()
    year = today.year
    month = today.month
    
    company_id = current_user.profile.company_id if current_user.profile else None
    if not company_id:
        raise HTTPException(status_code=400, detail="User not assigned to a company.")
    effective_site_id = await resolve_site_id(current_user, site_id, db, required=False)

    el_query = select(DataElement.category, sqlfunc.count(DataElement.id)).group_by(DataElement.category)
    if framework:
        fw_abbr = _resolve_framework(framework)
        el_query = el_query.where(DataElement.frameworks.ilike(f"%{fw_abbr}%"))
    el_res = await db.execute(el_query)
    total_by_cat = dict(el_res.all())
    
    sub_filters = [
        DataSubmission.company_id == company_id,
        DataSubmission.value.isnot(None),
        DataSubmission.year == year,
        DataSubmission.month == month
    ]
    if effective_site_id is not None:
        sub_filters.append(DataSubmission.site_id == effective_site_id)
    if framework:
        fw_abbr = _resolve_framework(framework)
        sub_filters.append(DataElement.frameworks.ilike(f"%{fw_abbr}%"))
        
    sub_query = (
        select(DataElement.category, sqlfunc.count(DataSubmission.data_element_id.distinct()))
        .join(DataElement, DataSubmission.data_element_id == DataElement.id)
        .where(*sub_filters)
        .group_by(DataElement.category)
    )
    sub_res = await db.execute(sub_query)
    sub_by_cat = dict(sub_res.all())
    
    total_e = total_by_cat.get("E", 0)
    total_s = total_by_cat.get("S", 0)
    total_g = total_by_cat.get("G", 0)
    total_elements = total_e + total_s + total_g
    
    sub_e = sub_by_cat.get("E", 0)
    sub_s = sub_by_cat.get("S", 0)
    sub_g = sub_by_cat.get("G", 0)
    submitted = sub_e + sub_s + sub_g
    
    return {
        "period": f"{calendar.month_name[month]} {year}",
        "year": year,
        "month": month,
        "total_elements": total_elements,
        "submitted": submitted,
        "by_pillar": {
            "E": {"total": total_e, "submitted": sub_e},
            "S": {"total": total_s, "submitted": sub_s},
            "G": {"total": total_g, "submitted": sub_g}
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /dashboard/score
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/score")
async def get_esg_score(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    site_id: Optional[int] = Query(None),
) -> Any:
    """
    Computes a composite ESG score (0-100).
    Only allowed for admins and super users.
    """
    if not current_user.profile or current_user.profile.role not in ("admin", "super_user"):
        raise HTTPException(status_code=403, detail="Not authorized to view ESG score.")
        
    # Get Completeness for S score
    comp_res = await get_completeness(db, current_user, site_id, framework=None)
    s_total = comp_res["by_pillar"]["S"]["total"]
    s_sub = comp_res["by_pillar"]["S"]["submitted"]
    s_score = (s_sub / s_total * 100) if s_total > 0 else 0
    
    # Get E trends for E score
    metrics_res = await get_dashboard_metrics(db, current_user, site_id, pillar="E", framework=None, target_year=None, target_month=None)
    e_stats = metrics_res.get("stats", [])
    
    e_cats_count = 0
    e_score_raw = 0
    
    for stat in e_stats:
        if stat.get("name") in ("Total Energy", "Total Water", "Total Waste", "Total Fuel", "Total GHG Emissions"):
            e_cats_count += 1
            trend = stat.get("trend")
            if trend == "down":
                e_score_raw += 25
            elif trend == "neutral":
                e_score_raw += 12.5
    
    e_score = (e_score_raw / (e_cats_count * 25) * 100) if e_cats_count > 0 else 0
    
    # Get G policies for G score
    elems_res = await get_pillar_elements(db, current_user, site_id, pillar="G", framework=None, target_year=None, target_month=None)
    g_elements = elems_res.get("elements", [])
    
    BOOLEAN_CODES = {
        'HOSP-S-012', 'HOSP-G-013', 'HOSP-G-014', 'HOSP-G-035', 'HOSP-G-037',
        'HOSP-G-038', 'HOSP-G-039', 'HOSP-G-040', 'HOSP-G-041', 'HOSP-S-044',
        'HOSP-S-045', 'HOSP-S-046', 'HOSP-S-047', 'HOSP-S-058', 'HOSP-G-059',
        'HOSP-G-070', 'HOSP-G-079', 'HOSP-G-080'
    }
    
    g_bools = [e for e in g_elements if e["code"] in BOOLEAN_CODES or e["unit"] == "boolean"]
    g_total = len(g_bools)
    g_yes = sum(1 for e in g_bools if e["value"] == 1)
    
    g_score = (g_yes / g_total * 100) if g_total > 0 else 0
    
    # Total
    overall = (e_score * 0.4) + (s_score * 0.3) + (g_score * 0.3)
    
    def get_grade(score):
        if score >= 90: return "A+"
        if score >= 80: return "A"
        if score >= 70: return "B+"
        if score >= 60: return "B"
        if score >= 50: return "C"
        return "D"
        
    return {
        "overall": round(overall),
        "grade": get_grade(overall),
        "e_score": round(e_score),
        "s_score": round(s_score),
        "g_score": round(g_score),
        "trend": "neutral",
        "delta": 0.0
    }