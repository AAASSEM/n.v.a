"""
carbon_accounting.py
====================
Production-grade GHG calculation engine for UAE hospitality.

Methodology: GHG Protocol Corporate Accounting and Reporting Standard
  - Scope 1: Direct combustion emissions (fuel, LPG, refrigerant leakage)
  - Scope 2: Indirect emissions from purchased electricity and district cooling
             (location-based method using UAE/emirate grid factors)

Emission Factors (EF) Sources:
  - UAE Electricity Grid: IEA Electricity/Heat 2023 data, DEWA/ADEWA published factors
    Dubai (DEWA): 0.4564 kg CO2e/kWh  (DEWA Sustainability Report 2023)
    Abu Dhabi (ADDC/ADWEA): 0.4192 kg CO2e/kWh  (ADWEA 2023)
    Sharjah / Other UAE: 0.4600 kg CO2e/kWh  (UAE national avg, IEA 2023)
    Egypt: 0.4595 kg CO2e/kWh  (IEA 2023)
    Default/Unknown: 0.4564 kg CO2e/kWh  (conservative UAE estimate)

  - District Cooling (UAE): 0.0928 kg CO2e/RT-h  (Tabreed/district cooling avg)
    Converted: 1 RT = 3.517 kWh thermal, system COP ~3.8, so EF ≈ grid_ef/COP

  - Diesel (road/generator): IPCC 2006 + UK DEFRA 2023
    Combustion only (tank-to-wheel): 2.6840 kg CO2e/liter
    Well-to-tank (upstream): 0.5360 kg CO2e/liter
    Total well-to-wheel: 3.2200 kg CO2e/liter
    Dashboard uses combustion-only (Scope 1) by default.

  - Petrol/Gasoline: IPCC 2006 + UK DEFRA 2023
    Combustion only: 2.3120 kg CO2e/liter

  - LPG (Propane/Butane mix):
    Combustion (kg-based): 2.9430 kg CO2e/kg LPG

  - Refrigerant leakage (Scope 1, per kg leaked):
    R-410A: 2088 kg CO2e/kg  (GWP100, IPCC AR5)
    R-22:   1810 kg CO2e/kg  (GWP100, IPCC AR4 – still common in UAE)
    R-32:    675 kg CO2e/kg  (GWP100, IPCC AR5)
    R-134a: 1430 kg CO2e/kg  (GWP100, IPCC AR5)
    Default (unknown blend): 2088 kg CO2e/kg  (R-410A, most common UAE HVAC)

All factors are in kg CO2e. Final outputs are converted to metric tonnes CO2e (÷1000).

Element code → calculation role mapping:
  HOSP-E-001  Electricity Consumption (kWh)              → Scope 2 electricity
  HOSP-E-003  District Cooling Consumption (RT-h)        → Scope 2 cooling
  HOSP-E-004  LPG Fuel Consumption (kg)                  → Scope 1 combustion
  HOSP-E-007  Vehicle Fuel – Petrol (liters)             → Scope 1 combustion
  HOSP-E-008  Vehicle Fuel – Diesel (liters)             → Scope 1 combustion
  HOSP-E-009  Diesel Generator Fuel (liters)             → Scope 1 combustion
  HOSP-E-010  Refrigerant Leakage (kg)                   → Scope 1 fugitive
  HOSP-E-023  On-site Renewable Generation (kWh)         → Scope 2 offset (subtracted)
  HOSP-E-042  Diesel – Owned Vehicles/Generators (liters)→ Scope 1 combustion (DST)
"""

from typing import Dict, Optional

# ---------------------------------------------------------------------------
# EMISSION FACTORS
# ---------------------------------------------------------------------------

# Scope 2: Electricity grid factors by UAE emirate (kg CO2e / kWh)
# Source: DEWA Sustainability Report 2023, ADWEA 2023, IEA 2023
ELECTRICITY_EF: Dict[str, float] = {
    "dubai":       0.4564,   # DEWA published factor
    "abu dhabi":   0.4192,   # ADWEA/ADDC
    "sharjah":     0.4600,   # Sharjah Electricity & Water Authority (SEWA) est.
    "ajman":       0.4600,   # UAE national avg
    "umm al quwain": 0.4600,
    "ras al khaimah": 0.4600,
    "fujairah":    0.4600,
    # Non-UAE
    "cairo":       0.4595,   # IEA Egypt 2023
    "egypt":       0.4595,
    "default":     0.4564,   # Conservative fallback
}

# Scope 2: District cooling factor (kg CO2e / RT-h)
# Based on UAE chilled-water district cooling avg (Tabreed / EMPOWER benchmarks)
# Derivation: grid_ef_dubai / system_COP → 0.4564 / 4.92 ≈ 0.0928
DISTRICT_COOLING_EF: float = 0.0928  # kg CO2e / RT-h

# Scope 1: Stationary & mobile combustion (kg CO2e / liter)
# Source: IPCC 2006 Guidelines Vol.2 Table 2.2, DEFRA 2023
DIESEL_EF_PER_LITER: float = 2.6840    # combustion-only (Scope 1)
PETROL_EF_PER_LITER: float = 2.3120    # combustion-only (Scope 1)

# Scope 1: LPG (kg CO2e / kg LPG)
# Source: IPCC 2006 Table 1.4 (propane-dominant blend)
LPG_EF_PER_KG: float = 2.9430

# Scope 1: Refrigerant leakage (kg CO2e / kg refrigerant)
# Default = R-410A (most common UAE HVAC), IPCC AR5 GWP100
REFRIGERANT_EF_DEFAULT: float = 2088.0


# ---------------------------------------------------------------------------
# ELEMENT CODE REGISTRY
# Maps element_code → (scope, emission factor, unit label for tooltip)
# ---------------------------------------------------------------------------

ELEMENT_EF_MAP: Dict[str, Dict] = {
    # --- Scope 2: Electricity ---
    "HOSP-E-001": {
        "scope": 2,
        "category": "electricity",
        "factor_key": "electricity",   # resolved at runtime using emirate
        "unit": "kWh",
        "label": "Electricity (Scope 2)",
    },
    # --- Scope 2: District Cooling ---
    "HOSP-E-003": {
        "scope": 2,
        "category": "cooling",
        "factor_value": DISTRICT_COOLING_EF,
        "unit": "RT-h",
        "label": "District Cooling (Scope 2)",
    },
    # --- Scope 1: LPG ---
    "HOSP-E-004": {
        "scope": 1,
        "category": "combustion",
        "factor_value": LPG_EF_PER_KG,
        "unit": "kg",
        "label": "LPG (Scope 1)",
    },
    # --- Scope 1: Petrol vehicles ---
    "HOSP-E-007": {
        "scope": 1,
        "category": "combustion",
        "factor_value": PETROL_EF_PER_LITER,
        "unit": "liters",
        "label": "Petrol Vehicles (Scope 1)",
    },
    # --- Scope 1: Diesel vehicles ---
    "HOSP-E-008": {
        "scope": 1,
        "category": "combustion",
        "factor_value": DIESEL_EF_PER_LITER,
        "unit": "liters",
        "label": "Diesel Vehicles (Scope 1)",
    },
    # --- Scope 1: Diesel generators ---
    "HOSP-E-009": {
        "scope": 1,
        "category": "combustion",
        "factor_value": DIESEL_EF_PER_LITER,
        "unit": "liters",
        "label": "Diesel Generators (Scope 1)",
    },
    # --- Scope 1: Refrigerant leakage (fugitive) ---
    "HOSP-E-010": {
        "scope": 1,
        "category": "fugitive",
        "factor_value": REFRIGERANT_EF_DEFAULT,
        "unit": "kg",
        "label": "Refrigerant Leakage (Scope 1 Fugitive)",
    },
    # --- Scope 2 negative: On-site renewable offsets purchased electricity ---
    "HOSP-E-023": {
        "scope": 2,
        "category": "renewable_offset",
        "factor_key": "electricity",   # same grid factor, but subtracted
        "unit": "kWh",
        "label": "Renewable Generation (Scope 2 offset)",
        "is_offset": True,
    },
    # --- Scope 1: DST-specific diesel (covers both vehicles and generators) ---
    "HOSP-E-042": {
        "scope": 1,
        "category": "combustion",
        "factor_value": DIESEL_EF_PER_LITER,
        "unit": "liters",
        "label": "Diesel – Vehicles/Generators (Scope 1, DST)",
    },
}


# ---------------------------------------------------------------------------
# CORE CALCULATION FUNCTION
# ---------------------------------------------------------------------------

def get_electricity_ef(emirate: Optional[str]) -> float:
    """Return the grid emission factor for the given emirate/location."""
    if not emirate:
        return ELECTRICITY_EF["default"]
    key = emirate.lower().strip()
    return ELECTRICITY_EF.get(key, ELECTRICITY_EF["default"])

def get_electricity_ef_source(emirate: Optional[str]) -> str:
    """Human-readable source label for the grid emission factor."""
    if not emirate:
        return "DEWA Sustainability Report 2023"
    e = emirate.lower().strip()
    sources = {
        "dubai":           "DEWA Sustainability Report 2023",
        "abu dhabi":       "ADWEA Annual Report 2023",
        "sharjah":         "SEWA / IEA UAE National Average 2023",
        "ajman":           "IEA UAE National Average 2023",
        "umm al quwain":   "IEA UAE National Average 2023",
        "ras al khaimah":  "IEA UAE National Average 2023",
        "fujairah":        "IEA UAE National Average 2023",
        "cairo":           "IEA Egypt National Average 2023",
        "egypt":           "IEA Egypt National Average 2023",
    }
    return sources.get(e, "IEA UAE National Average 2023")


def calculate_emissions_tco2e(
    element_code: str,
    quantity: float,
    emirate: Optional[str] = None,
) -> Optional[float]:
    """
    Calculate CO2e emissions (in metric tonnes) for a single data submission.

    Args:
        element_code: e.g. "HOSP-E-001"
        quantity: the submitted value in its native unit
        emirate: the company's emirate field for grid-factor lookup

    Returns:
        float: tCO2e for this submission, or None if element is not in the map
    """
    mapping = ELEMENT_EF_MAP.get(element_code)
    if mapping is None:
        return None

    # Resolve emission factor
    if "factor_key" in mapping:
        if mapping["factor_key"] == "electricity":
            ef = get_electricity_ef(emirate)
        else:
            ef = 0.0
    else:
        ef = mapping["factor_value"]

    kg_co2e = quantity * ef

    # Renewable generation offsets Scope 2 electricity
    if mapping.get("is_offset", False):
        kg_co2e = -abs(kg_co2e)

    return kg_co2e / 1000.0  # convert to metric tonnes


def build_emissions_breakdown(
    submissions: list,   # list of (element_code, quantity, year, month)
    emirate: Optional[str] = None,
) -> Dict:
    """
    Build a full Scope 1 / Scope 2 breakdown from a list of submissions.

    Returns a dict with:
        scope1_tco2e        Total Scope 1 (direct combustion + fugitive)
        scope2_tco2e        Total Scope 2 (purchased energy, location-based)
        total_tco2e         Scope 1 + Scope 2
        methodology         Human-readable methodology note
        breakdown_by_source { "HOSP-E-001": { label, scope, tco2e, ef_used } }
        monthly_emissions   [ { year, month, scope1, scope2, total } ]
    """
    scope1 = 0.0
    scope2 = 0.0
    breakdown: Dict[str, Dict] = {}
    monthly: Dict[tuple, Dict] = {}

    for row in submissions:
        if len(row) >= 4:
            element_code, quantity, year, month = row[:4]
        else:
            continue
        if quantity is None or quantity == 0:
            continue

        mapping = ELEMENT_EF_MAP.get(element_code)
        if mapping is None:
            continue

        tco2e = calculate_emissions_tco2e(element_code, float(quantity), emirate)
        if tco2e is None:
            continue

        # Accumulate by source for breakdown card
        if element_code not in breakdown:
            if "factor_key" in mapping and mapping["factor_key"] == "electricity":
                ef_used = get_electricity_ef(emirate)
            else:
                ef_used = mapping.get("factor_value", 0.0)

            breakdown[element_code] = {
                "label": mapping["label"],
                "scope": mapping["scope"],
                "tco2e": 0.0,
                "ef_used": ef_used,
                "unit": mapping["unit"],
                "is_offset": mapping.get("is_offset", False),
            }
        breakdown[element_code]["tco2e"] += tco2e

        # Scope totals
        if mapping["scope"] == 1:
            scope1 += tco2e
        elif mapping["scope"] == 2:
            scope2 += tco2e

        # Monthly timeseries
        key = (year, month)
        if key not in monthly:
            monthly[key] = {"year": year, "month": month, "scope1": 0.0, "scope2": 0.0}
        if mapping["scope"] == 1:
            monthly[key]["scope1"] += tco2e
        elif mapping["scope"] == 2:
            monthly[key]["scope2"] += tco2e

    # Add totals to monthly entries
    for entry in monthly.values():
        entry["total"] = entry["scope1"] + entry["scope2"]

    # Resolve electricity EF for methodology note
    elec_ef = get_electricity_ef(emirate)
    emirate_label = (emirate or "UAE").title()

    elec_ef_source = get_electricity_ef_source(emirate)

    methodology = (
        f"GHG Protocol Corporate Standard. "
        f"Scope 1: direct combustion (diesel {DIESEL_EF_PER_LITER} kgCO2e/L, "
        f"petrol {PETROL_EF_PER_LITER} kgCO2e/L, LPG {LPG_EF_PER_KG} kgCO2e/kg) "
        f"and fugitive refrigerant (R-410A GWP {int(REFRIGERANT_EF_DEFAULT)}). "
        f"Scope 2: location-based grid factor for {emirate_label} = "
        f"{elec_ef} kgCO2e/kWh ({elec_ef_source}); "
        f"district cooling = {DISTRICT_COOLING_EF} kgCO2e/RT-h (Tabreed benchmark). "
        f"On-site renewable generation offsets Scope 2 at the same grid factor."
    )

    return {
        "scope1_tco2e": round(scope1, 3),
        "scope2_tco2e": round(scope2, 3),
        "total_tco2e": round(scope1 + scope2, 3),
        "methodology": methodology,
        "breakdown_by_source": breakdown,
        "monthly_emissions": sorted(monthly.values(), key=lambda x: (x["year"], x["month"])),
    }

def build_multi_site_emissions_breakdown(
    submissions: list,   # list of (element_code, quantity, year, month, site_id)
    site_emirate_map: Dict[int, str],
) -> Dict:
    """
    Build a full Scope 1 / Scope 2 breakdown from a list of submissions across multiple sites.
    Applies the correct emirate grid factor per site.
    """
    scope1 = 0.0
    scope2 = 0.0
    breakdown: Dict[str, Dict] = {}
    monthly: Dict[tuple, Dict] = {}
    
    # Track which emirates we actually used for Scope 2
    used_emirates = set()

    for row in submissions:
        if len(row) == 5:
            element_code, quantity, year, month, site_id = row
        else:
            element_code, quantity, year, month = row
            site_id = None
            
        if quantity is None or quantity == 0:
            continue

        mapping = ELEMENT_EF_MAP.get(element_code)
        if mapping is None:
            continue

        emirate = site_emirate_map.get(site_id) if site_id else None
        
        tco2e = calculate_emissions_tco2e(element_code, float(quantity), emirate)
        if tco2e is None:
            continue

        # Accumulate by source
        if element_code not in breakdown:
            if "factor_key" in mapping and mapping["factor_key"] == "electricity":
                # For multi-site, the 'ef_used' on the summary level might be mixed, 
                # but we'll store the first one or None, the UI will rely on methodology note.
                ef_used = get_electricity_ef(emirate)
            else:
                ef_used = mapping.get("factor_value", 0.0)

            breakdown[element_code] = {
                "label": mapping["label"],
                "scope": mapping["scope"],
                "tco2e": 0.0,
                "ef_used": ef_used,
                "unit": mapping["unit"],
                "is_offset": mapping.get("is_offset", False),
            }
        breakdown[element_code]["tco2e"] += tco2e
        
        if mapping["scope"] == 2 and "factor_key" in mapping and mapping["factor_key"] == "electricity":
            used_emirates.add(emirate or "default")

        # Scope totals
        if mapping["scope"] == 1:
            scope1 += tco2e
        elif mapping["scope"] == 2:
            scope2 += tco2e

        # Monthly timeseries
        key = (year, month)
        if key not in monthly:
            monthly[key] = {"year": year, "month": month, "scope1": 0.0, "scope2": 0.0}
        if mapping["scope"] == 1:
            monthly[key]["scope1"] += tco2e
        elif mapping["scope"] == 2:
            monthly[key]["scope2"] += tco2e

    # Add totals to monthly entries
    for entry in monthly.values():
        entry["total"] = entry["scope1"] + entry["scope2"]

    # Build multi-site methodology string
    ef_strings = []
    for em in sorted(list(used_emirates)):
        e_label = "UAE" if em == "default" else em.title()
        ef = get_electricity_ef(em)
        src = get_electricity_ef_source(em)
        ef_strings.append(f"{e_label}: {ef} kgCO2e/kWh ({src})")
        
    ef_note = "; ".join(ef_strings) if ef_strings else "Location-based grid factors applied per site."

    methodology = (
        f"GHG Protocol Corporate Standard (Multi-Site). "
        f"Scope 1: direct combustion (diesel {DIESEL_EF_PER_LITER} kgCO2e/L, "
        f"petrol {PETROL_EF_PER_LITER} kgCO2e/L, LPG {LPG_EF_PER_KG} kgCO2e/kg) "
        f"and fugitive refrigerant (R-410A GWP {int(REFRIGERANT_EF_DEFAULT)}). "
        f"Scope 2 Electricity: {ef_note} "
        f"District cooling: {DISTRICT_COOLING_EF} kgCO2e/RT-h (Tabreed benchmark). "
        f"On-site renewable generation offsets Scope 2 at the same grid factor."
    )

    return {
        "scope1_tco2e": round(scope1, 3),
        "scope2_tco2e": round(scope2, 3),
        "total_tco2e": round(scope1 + scope2, 3),
        "methodology": methodology,
        "breakdown_by_source": breakdown,
        "monthly_emissions": sorted(monthly.values(), key=lambda x: (x["year"], x["month"])),
    }