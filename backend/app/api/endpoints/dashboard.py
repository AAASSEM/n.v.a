from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, case
import datetime
from dateutil.relativedelta import relativedelta

from app.api.deps import get_db, get_current_active_user
from app.models.user import User
from app.models.submission import DataSubmission
from app.models.data_element import DataElement

router = APIRouter()

def get_synthetic_category(name: str, db_cat: str) -> str:
    n = name.lower()
    if 'water' in n: return 'Water'
    if 'waste' in n or 'recycling' in n or 'compost' in n: return 'Waste'
    if 'fuel' in n or 'diesel' in n or 'petrol' in n or 'vehicles' in n: return 'Fuel'
    if 'energy' in n or 'electricity' in n or 'lighting' in n or 'carbon' in n: return 'Energy'
    
    # If we couldn't derive it from the name, fallback to the base ESG category string
    if db_cat == 'E': return 'Environment Other'
    if db_cat == 'S': return 'Social'
    if db_cat == 'G': return 'Governance'
    return 'Other'

@router.get("/metrics")
async def get_dashboard_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Get aggregated dashboard metrics for the current user's company dynamically covering all active metric categories.
    """
    company_id = current_user.profile.company_id if current_user.profile else None
    if not company_id:
        raise HTTPException(status_code=400, detail="User not assigned to a company.")

    # 1. Base query for all submissions joining data elements
    query = (
        select(
            DataSubmission.year,
            DataSubmission.month,
            DataElement.category,
            DataElement.name,
            func.sum(DataSubmission.value).label("total_value")
        )
        .join(DataElement, DataSubmission.data_element_id == DataElement.id)
        .where(
            DataSubmission.company_id == company_id,
            DataSubmission.value != None
        )
        .group_by(DataSubmission.year, DataSubmission.month, DataElement.category, DataElement.name)
    )

    result = await db.execute(query)
    rows = result.all()

    # 2. Organize data into a timeseries format (last 7 months)
    today = datetime.date.today()
    months_series = []
    
    # Pre-populate the last 7 months
    for i in range(6, -1, -1):
        target_date = today - relativedelta(months=i)
        month_name = target_date.strftime("%b") # e.g., 'Jan'
        months_series.append({
            "year": target_date.year,
            "month": target_date.month,
            "name": month_name,
            # We will populate categories dynamically below
        })

    # Track all unique categories we encounter
    found_categories = set()

    for row in rows:
        y, m, db_cat, el_name, total = row
        cat = get_synthetic_category(el_name, db_cat)
        found_categories.add(cat)
        
        # Find the matching month in our series
        for item in months_series:
            if item["year"] == y and item["month"] == m:
                # Add to the dictionary. It becomes { "name": "Jan", "Energy": 4000 }
                item[cat] = item.get(cat, 0) + float(total)
                break

    # Calculate Top-Level Stats (All Time)
    stats_map = {}
    for cat in found_categories:
        stats_map[cat] = sum(item.get(cat, 0) for item in months_series)

    formatted_stats = []
    for cat, total in stats_map.items():
        # Determine basic units or icons based on category string
        icon = "📊"
        unit = ""
        if "energy" in cat.lower():
            icon = "⚡"
            unit = " kWh"
        elif "water" in cat.lower():
            icon = "💧"
            unit = " L"
        elif "waste" in cat.lower():
            icon = "♻️"
            unit = " kg"
        elif "fuel" in cat.lower():
            icon = "⛽"
            unit = " L"

        formatted_stats.append({
            "name": f"Total {cat}",
            "value": f"{total:,.0f}{unit}",
            "change": "Active",
            "trend": "neutral",
            "icon": icon
        })

    # Add mock Carbon Emissions derived from Energy & Fuel
    total_energy = stats_map.get('Energy', 0)
    total_fuel = stats_map.get('Fuel', 0)
    
    # Simple arbitrary conversion formula for demo purposes
    mock_carbon = (total_energy * 0.4) / 1000 + (total_fuel * 2.3) / 1000
    
    # Inject it into the chart data too.
    for item in months_series:
        en = item.get('Energy', 0)
        fu = item.get('Fuel', 0)
        item['Emissions'] = (en * 0.4) / 1000 + (fu * 2.3) / 1000

    formatted_stats.append({
        "name": "Carbon Emissions (tCO2e)",
        "value": f"{mock_carbon:,.1f}",
        "change": "Derived",
        "trend": "neutral",
        "icon": "🌿"
    })

    return {
        "stats": formatted_stats,
        "chartData": months_series,
        "categories": list(found_categories)
    }
