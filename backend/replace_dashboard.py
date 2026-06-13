import os

file_path = r"c:\Users\20100\thefinal\n.v.a\backend\app\api\endpoints\dashboard.py"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    "from app.services.carbon_accounting import (\n    build_emissions_breakdown,\n    ELEMENT_EF_MAP,\n    get_electricity_ef,\n)",
    "from app.services.carbon_accounting import (\n    build_emissions_breakdown,\n    ELEMENT_EF_MAP,\n    get_electricity_ef,\n    get_electricity_ef_source,\n)"
)

content = content.replace("_grid_ef_source(", "get_electricity_ef_source(")

# Remove the old _grid_ef_source definition to clean it up
old_func = '''def _grid_ef_source(emirate: Optional[str]) -> str:
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
    return sources.get(e, "IEA UAE National Average 2023")'''

content = content.replace(old_func, "")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Dashboard replaced successfully.")
