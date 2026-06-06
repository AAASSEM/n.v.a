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

from app.api.deps import get_db, get_current_active_user, resolve_site_id
from app.models.user import User
from app.models.submission import DataSubmission
from app.models.data_element import DataElement
from app.models.company import Company
from app.services.carbon_accounting import (
    build_emissions_breakdown,
    ELEMENT_EF_MAP,
    get_electricity_ef,
)

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _display_category(name: str, db_cat: str) -> str:
    """Map an element to a chart/stat bucket."""
    n = name.lower()
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


def _trend(this_val: float, prev_val: float) -> tuple[str, str]:
    """Return (direction, label) comparing two monthly totals."""
    if prev_val == 0:
        return "neutral", "No prior data"
    pct = ((this_val - prev_val) / prev_val) * 100
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


async def _get_company_emirate(db: AsyncSession, company_id: int) -> Optional[str]:
    result = await db.execute(select(Company.emirate).where(Company.id == company_id))
    return result.scalar_one_or_none()


async def _base_filters(
    current_user: User,
    site_id: Optional[int],
    db: AsyncSession,
    pillar: Optional[str] = None,
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
) -> Any:
    """
    Main dashboard KPI cards and 7-month chart data.

    When pillar is set, stat cards and chart series are scoped to that pillar.
    Carbon GHG cards are always Pillar E and are suppressed for S / G.
    """
    company_id, effective_site_id, filters = await _base_filters(
        current_user, site_id, db, pillar
    )
    emirate = await _get_company_emirate(db, company_id)

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

    # ── 7-month skeleton ──────────────────────────────────────────────────
    months_series = []
    for i in range(6, -1, -1):
        d = today - relativedelta(months=i)
        months_series.append({"year": d.year, "month": d.month, "name": d.strftime("%b")})
    month_index = {(m["year"], m["month"]): m for m in months_series}

    stats_map: dict[str, float] = {}
    carbon_inputs: list[tuple] = []
    found_categories: set[str] = set()

    for year, month, value, db_cat, el_name, el_code, el_unit in rows:
        if value is None:
            continue
        fval = float(value)
        disp = _display_category(el_name, db_cat)
        found_categories.add(disp)
        stats_map[disp] = stats_map.get(disp, 0) + fval

        if (year, month) in month_index:
            slot = month_index[(year, month)]
            slot[disp] = slot.get(disp, 0) + fval

        carbon_inputs.append((el_code, fval, year, month))

    # ── GHG engine ────────────────────────────────────────────────────────
    show_ghg = pillar in (None, "E")
    ghg = build_emissions_breakdown(carbon_inputs, emirate=emirate) if show_ghg else None

    # Inject monthly emissions into chart slots
    if ghg:
        for em in ghg["monthly_emissions"]:
            key = (em["year"], em["month"])
            if key in month_index:
                slot = month_index[key]
                slot["Scope 1"] = round(em["scope1"], 3)
                slot["Scope 2"] = round(em["scope2"], 3)
                slot["Emissions"] = round(em["total"], 3)

    # ── Month-over-month trend helpers ────────────────────────────────────
    this_m  = (today.year, today.month)
    prev_m  = ((today - relativedelta(months=1)).year,
               (today - relativedelta(months=1)).month)

    def cat_trend(cat: str):
        a = month_index.get(this_m, {}).get(cat, 0)
        b = month_index.get(prev_m, {}).get(cat, 0)
        return _trend(a, b)

    # ── Build stat cards ──────────────────────────────────────────────────
    UNIT_MAP = {"Energy": " kWh", "Water": " m³", "Waste": " kg", "Fuel": " L"}
    formatted_stats = []

    for cat, total in stats_map.items():
        if cat in ("Social", "Governance"):
            continue   # S and G shown via /elements, not aggregate cards
        trend, change = cat_trend(cat)
        formatted_stats.append({
            "name": f"Total {cat}",
            "value": f"{total:,.0f}{UNIT_MAP.get(cat, '')}",
            "change": change,
            "trend": trend,
            "pillar": "E" if cat not in ("Social", "Governance") else ("S" if cat == "Social" else "G"),
        })

    # GHG scope cards
    if ghg and show_ghg:
        em_this  = month_index.get(this_m, {}).get("Emissions", 0)
        em_prev  = month_index.get(prev_m, {}).get("Emissions", 0)
        em_trend, em_change = _trend(em_this, em_prev)

        formatted_stats += [
            {
                "name": "Scope 1 Emissions",
                "value": f"{ghg['scope1_tco2e']:,.2f} tCO₂e",
                "change": "Direct combustion + fugitive",
                "trend": "neutral",
                "pillar": "E",
                "scope": 1,
            },
            {
                "name": "Scope 2 Emissions",
                "value": f"{ghg['scope2_tco2e']:,.2f} tCO₂e",
                "change": f"Grid: {emirate or 'UAE'} location-based",
                "trend": "neutral",
                "pillar": "E",
                "scope": 2,
            },
            {
                "name": "Total GHG Emissions",
                "value": f"{ghg['total_tco2e']:,.2f} tCO₂e",
                "change": em_change,
                "trend": em_trend,
                "pillar": "E",
                "methodology": ghg["methodology"],
                "breakdown": [
                    {
                        "label": v["label"],
                        "scope": v["scope"],
                        "tco2e": round(v["tco2e"], 3),
                        "ef_used": v["ef_used"],
                        "unit": v["unit"],
                    }
                    for v in ghg["breakdown_by_source"].values()
                    if abs(v["tco2e"]) > 0
                ],
            },
        ]

    # ── Chart category list ───────────────────────────────────────────────
    ORDER = ["Energy", "Water", "Waste", "Fuel", "Environment Other", "Emissions"]
    chart_categories = sorted(
        [c for c in found_categories if c not in ("Social", "Governance", "Other")],
        key=lambda x: ORDER.index(x) if x in ORDER else 99,
    )

    return {
        "stats": formatted_stats,
        "chartData": months_series,
        "categories": chart_categories,
        "pillar": pillar,
        "ghg_visible": show_ghg,
        "emirate": emirate,
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
        current_user, site_id, db, pillar
    )

    # Get the latest submission per element (max year+month combination)
    from sqlalchemy import func as sqlfunc

    # Subquery: latest (year, month) per element for this company/site
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

    return {"pillar": pillar, "elements": elements, "history": history}


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
    emirate = await _get_company_emirate(db, company_id)

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