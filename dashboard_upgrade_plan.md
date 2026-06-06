# Dashboard Advanced Upgrade Plan
## ESGravity — E / S / G Filter + Month Comparison Engine

**Scope:** Backend + Frontend  
**Estimated effort:** 3–4 focused dev sessions  
**Depends on:** `carbon_accounting.py` and the new `dashboard.py` already in place

---

## 1. What We're Building

Two independent but complementary features:

1. **ESG Pillar Filter** — Switch the entire dashboard between Environmental (E), Social (S), Governance (G), or All. Every stat card, chart, and number responds to the active pillar.

2. **Month Comparison Engine** — Pick any two months and compare them side-by-side: absolute values, percentage change, delta bars, and a winner/loser verdict per metric.

---

## 2. Backend Changes

### 2.1 New Query Parameter: `pillar`

**File:** `backend/app/api/endpoints/dashboard.py`

Add `pillar: Optional[str] = Query(None)` to `get_dashboard_metrics`.

```python
# Valid values: "E", "S", "G", None (= all)
pillar: Optional[str] = Query(None)
```

When `pillar` is set, filter the query so only `DataElement.category == pillar` rows are included.

```python
if pillar in ("E", "S", "G"):
    filters.append(DataElement.category == pillar)
```

**Note:** Carbon emissions are always Pillar E. If `pillar="S"` or `pillar="G"`, suppress the GHG stat cards entirely and return `ghg_visible: false` in the response.

---

### 2.2 New Endpoint: `GET /dashboard/compare`

**File:** `backend/app/api/endpoints/dashboard.py` — add a second route

This endpoint accepts two month/year pairs and returns a structured comparison object.

```
GET /dashboard/compare
  ?month_a_year=2025&month_a_month=10
  &month_b_year=2025&month_b_month=11
  &pillar=E          (optional)
  &site_id=...       (auto-injected by frontend interceptor)
```

**Response shape:**

```json
{
  "month_a": { "label": "Oct 2025", "year": 2025, "month": 10 },
  "month_b": { "label": "Nov 2025", "year": 2025, "month": 11 },
  "rows": [
    {
      "element_code": "HOSP-E-001",
      "name": "Electricity Consumption",
      "category": "E",
      "unit": "kWh",
      "value_a": 150000,
      "value_b": 148000,
      "delta": -2000,
      "delta_pct": -1.33,
      "direction": "down",
      "is_improvement": true
    },
    ...
  ],
  "summary": {
    "total_elements_compared": 8,
    "improvements": 5,
    "regressions": 2,
    "no_change": 1
  },
  "ghg": {
    "month_a_tco2e": 81.984,
    "month_b_tco2e": 68.614,
    "delta_tco2e": -13.370,
    "delta_pct": -16.30
  }
}
```

**Logic:**
- Pull all submissions for both months in one query (no N+1)
- Join `DataElement` to get name, unit, category
- For each element: compute delta = `value_b - value_a`, delta_pct = `(delta / value_a) * 100`
- `is_improvement`: for Environmental metrics, down = good. For Social (training hours, workforce), up = good. Use a lookup table per element_code.
- Pass relevant element codes to `carbon_accounting.build_emissions_breakdown()` for GHG delta
- Return only elements that have data in at least one of the two months

**Improvement direction table** (hardcode in backend, a simple dict):

```python
# True = higher is better, False = lower is better
IMPROVEMENT_DIRECTION = {
    "HOSP-E-001": False,  # Electricity - lower is better
    "HOSP-E-002": False,  # Water - lower is better
    "HOSP-E-003": False,  # Cooling - lower is better
    "HOSP-E-004": False,  # LPG - lower is better
    "HOSP-E-005": False,  # Waste - lower is better
    "HOSP-E-006": True,   # Waste Recycled - higher is better
    "HOSP-E-007": False,  # Petrol - lower is better
    "HOSP-E-008": False,  # Diesel - lower is better
    "HOSP-E-009": False,  # Generator diesel - lower is better
    "HOSP-E-023": True,   # Renewable generation - higher is better
    "HOSP-E-072": True,   # Recycling rate % - higher is better
    "HOSP-S-024": True,   # Workforce size - higher is better
    "HOSP-S-028": True,   # Training hours - higher is better
    # default for unlisted: False (lower = better)
}
```

---

### 2.3 Response Changes to Existing `/metrics`

Add two new fields to the existing response:

```json
{
  "pillar": "E",
  "ghg_visible": true,
  "stats": [...],
  "chartData": [...],
  ...
}
```

Also tag every stat card with its `pillar` so the frontend can filter on the client side as a fallback:

```json
{
  "name": "Total Water",
  "value": "45,200 m³",
  "pillar": "E",
  "trend": "down",
  "change": "3.2% vs last month"
}
```

---

## 3. Frontend Changes

### 3.1 State Management

In `Dashboard.tsx`, add three pieces of state:

```typescript
// Pillar filter
const [activePillar, setActivePillar] = useState<'ALL' | 'E' | 'S' | 'G'>('ALL');

// Comparison mode toggle
const [compareMode, setCompareMode] = useState(false);

// The two months being compared (default: current and previous)
const today = new Date();
const [monthA, setMonthA] = useState({ year: today.getFullYear(), month: today.getMonth() }); 
const [monthB, setMonthB] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });
```

Update the `useQuery` for dashboard metrics to include pillar:

```typescript
const { data: dashboardData } = useQuery({
    queryKey: ['dashboard', 'metrics', currentSiteId, activePillar],
    queryFn: async () => {
        const params = activePillar !== 'ALL' ? `?pillar=${activePillar}` : '';
        const res = await api.get(`/dashboard/metrics${params}`);
        return res.data;
    }
});
```

Add a second query for comparison (only fires when `compareMode` is true):

```typescript
const { data: compareData, isLoading: compareLoading } = useQuery({
    queryKey: ['dashboard', 'compare', currentSiteId, monthA, monthB, activePillar],
    queryFn: async () => {
        const res = await api.get(
            `/dashboard/compare?month_a_year=${monthA.year}&month_a_month=${monthA.month}` +
            `&month_b_year=${monthB.year}&month_b_month=${monthB.month}` +
            (activePillar !== 'ALL' ? `&pillar=${activePillar}` : '')
        );
        return res.data;
    },
    enabled: compareMode,
});
```

---

### 3.2 Pillar Filter Bar UI

Replace or augment the current page header with a pill-tab bar:

```
[ ALL ]  [ 🌿 Environmental ]  [ 👥 Social ]  [ 🏛️ Governance ]
```

Each pill is a button. Active pill has a highlighted border + background glow. When a pillar is selected:
- The stat cards grid re-renders showing only that pillar's cards
- The chart series filter to only that pillar's data keys
- The compare panel (if open) filters to that pillar's elements

**Visual design:**
- ALL → default white/neutral
- E → `#10b981` green accent
- S → `#6366f1` indigo accent  
- G → `#8b5cf6` purple accent

---

### 3.3 Stat Cards — Pillar-Filtered

When a pillar is active, the stat card grid only shows cards tagged with that pillar. Use the `pillar` field returned by the updated `/metrics` endpoint.

For Pillar E, show:
- Total Energy, Total Water, Total Waste, Total Fuel, Scope 1, Scope 2, Total GHG

For Pillar S, show:
- Total Workforce, Training Hours, Turnover Rate, Grievances Reported/Resolved (if data exists)
- Hide all GHG cards

For Pillar G, show:
- Policies in place (count), Sustainability Committee (yes/no), Annual Action Plan progress
- These are boolean/count elements — display as badge cards, not numeric charts

---

### 3.4 Compare Mode Panel

A toggle button in the page header: **"Compare Months"**.

When toggled on, a panel slides down below the filter bar with two month pickers side by side:

```
┌─────────────────────────────────────────────────────┐
│  Compare:  [ Oct 2025 ▼ ]   vs   [ Nov 2025 ▼ ]     │
│                                              [Close] │
└─────────────────────────────────────────────────────┘
```

Each picker is a dropdown showing the last 24 months (derived from today's date — no hardcoding).

Below the picker, render the **Comparison Table**:

```
┌────────────────────────────┬──────────┬──────────┬──────────┬────────┐
│ Metric                     │ Oct 2025 │ Nov 2025 │ Change   │ Status │
├────────────────────────────┼──────────┼──────────┼──────────┼────────┤
│ ⚡ Electricity Consumption  │ 150,000  │ 148,000  │ ▼ 1.3%  │  ✅    │
│ 💧 Water Consumption        │ 45,200   │ 47,100   │ ▲ 4.2%  │  ⚠️    │
│ 🌿 Total GHG Emissions      │ 82.0 t   │ 68.6 t   │ ▼ 16.3% │  ✅    │
└────────────────────────────┴──────────┴──────────┴──────────┴────────┘
```

Color rules for the Change column:
- Green ▼ = decrease in a "lower is better" metric → improvement
- Red ▲ = increase in a "lower is better" metric → regression
- Green ▲ = increase in a "higher is better" metric → improvement
- Red ▼ = decrease in a "higher is better" metric → regression

Below the table, render a **Delta Bar Chart** using Recharts:

- X-axis: metric names (abbreviated)
- Y-axis: percentage change
- Bars colored green (improvement) or red (regression)
- Zero line clearly marked
- Tooltip shows full metric name + absolute values for both months

Below that, a **Summary Banner**:

```
┌───────────────────────────────────────────────────────────────┐
│  Oct → Nov 2025:  ✅ 5 improved   ⚠️ 2 regressed   → 1 flat  │
│  GHG: 82.0 → 68.6 tCO2e  (▼ 16.3% — great progress)         │
└───────────────────────────────────────────────────────────────┘
```

---

### 3.5 Chart Updates

When pillar filter is active, update the "Sustainability Dynamics" area chart to only render `<Area>` series matching the active pillar:

```typescript
const pillarCategoryMap = {
    'E': ['Energy', 'Water', 'Waste', 'Fuel', 'Emissions', 'Environment Other'],
    'S': ['Social'],
    'G': ['Governance'],
    'ALL': categories, // everything
};

const visibleCategories = pillarCategoryMap[activePillar] || categories;
```

When `compareMode` is on and both months are selected, add a **vertical reference line** on the chart marking each of the two selected months using Recharts `<ReferenceLine>`.

---

## 4. File Manifest

### Backend (new/changed)

| File | Action |
|---|---|
| `app/api/endpoints/dashboard.py` | Add `pillar` param to `/metrics` + new `/compare` route |
| `app/services/carbon_accounting.py` | Already done — no changes needed |

### Frontend (new/changed)

| File | Action | Notes |
|---|---|---|
| `pages/Dashboard/Dashboard.tsx` | Major rewrite | Pillar tabs, compare mode toggle, state wiring |
| `pages/Dashboard/PillarFilter.tsx` | New component | The E/S/G pill tabs |
| `pages/Dashboard/ComparePanel.tsx` | New component | Month pickers + comparison table + delta bar |
| `pages/Dashboard/CompareTable.tsx` | New component | Table rows with color-coded delta + status icon |
| `pages/Dashboard/DeltaBarChart.tsx` | New component | Recharts BarChart showing % change per metric |

Keeping the compare logic in its own components keeps `Dashboard.tsx` from becoming a 1,000-line file.

---

## 5. Build Order

Do these in order — each step is independently testable.

### Step 1 — Backend: pillar filter on `/metrics` (30 min)
Add `pillar` query param, filter the DB query, tag stat cards with `pillar` in the response. Test with Postman/curl. No frontend work needed yet.

### Step 2 — Frontend: Pillar Filter Bar + stat card filtering (1 hr)
Build `PillarFilter.tsx`. Wire `activePillar` state to the metrics query. Stat cards filter client-side on the `pillar` tag. Chart series filter by `pillarCategoryMap`. Done when clicking E/S/G visibly changes the cards and chart.

### Step 3 — Backend: `/compare` endpoint (1.5 hrs)
Write the compare query, the improvement direction lookup, and the GHG delta via `build_emissions_breakdown`. Return the full comparison object. Test with two months that have real data. Watch the `is_improvement` logic carefully — get the direction table right.

### Step 4 — Frontend: Compare Panel scaffolding (1 hr)
Build `ComparePanel.tsx` with the month pickers. Wire the `compareMode` toggle and the second `useQuery`. Display raw JSON to verify data is flowing. No styling yet.

### Step 5 — Frontend: Comparison Table + DeltaBarChart (2 hrs)
Build `CompareTable.tsx` with color-coded deltas, status icons, and the summary banner. Build `DeltaBarChart.tsx`. Wire both into `ComparePanel`. Style to match the existing dark theme.

### Step 6 — Reference lines on main chart (30 min)
Add `<ReferenceLine>` to the Sustainability Dynamics area chart when `compareMode` is on, marking the two selected months.

### Step 7 — QA pass (1 hr)
- Empty states (no data for one or both months)
- Single-month data (only one month has submissions)
- Pillar switching while compare mode is open
- RBAC: `viewer` role should see everything; `uploader` should not see the compare toggle (compare is analytical, not data-entry)

---

## 6. Edge Cases to Handle

| Scenario | Behaviour |
|---|---|
| Month A has data, Month B doesn't | Show Month A value, Month B = "No data", no delta rendered |
| Element only exists in one framework | Still show it — filter is by pillar (E/S/G), not framework |
| `pillar=S` or `pillar=G` selected | Suppress all GHG/Emissions stat cards and Emissions chart series |
| Compare mode + pillar filter both active | Compare table only shows elements in the active pillar |
| User picks same month for A and B | Disable the compare button / show validation message |
| No data at all | Show empty state with a prompt to go to Data Entry |
| Refrigerant or LPG not applicable | Element simply won't appear in compare table (no submission = not in response) |

---

## 7. What This Looks Like When Done

**Default view (ALL pillar, no compare):**
Same as today but with the pillar tabs at the top and a "Compare Months" button.

**E pillar selected:**
Only energy/water/waste/fuel/GHG cards. Chart shows only environmental series. Clean and focused — this is what a DST or LEED auditor wants to see.

**S pillar selected:**
Workforce, training, and safety metrics front and center. No charts (most S data is annual counts, not time-series). Cards with badges and simple counts instead.

**G pillar selected:**
Governance policy checklist cards — boolean indicators (Policy: ✅, Board Oversight: ✅, Ethics Policy: ❌). Progress ring showing G completion percentage.

**Compare mode on, E pillar, Oct vs Nov:**
Month pickers, comparison table with green/red deltas, delta bar chart, summary banner showing "5 improved, 2 regressed, GHG down 16.3%."

---

## 8. Notes on Carbon Accounting Integration

The compare endpoint must call `build_emissions_breakdown()` twice — once for Month A submissions and once for Month B — and then diff the results. Do not re-derive emissions from the old mock formula.

```python
ghg_a = build_emissions_breakdown(submissions_month_a, emirate=emirate)
ghg_b = build_emissions_breakdown(submissions_month_b, emirate=emirate)

ghg_delta = {
    "month_a_tco2e": ghg_a["total_tco2e"],
    "month_b_tco2e": ghg_b["total_tco2e"],
    "delta_tco2e": ghg_b["total_tco2e"] - ghg_a["total_tco2e"],
    "delta_pct": ((ghg_b["total_tco2e"] - ghg_a["total_tco2e"]) / ghg_a["total_tco2e"] * 100)
                 if ghg_a["total_tco2e"] > 0 else 0,
    "scope1_a": ghg_a["scope1_tco2e"],
    "scope1_b": ghg_b["scope1_tco2e"],
    "scope2_a": ghg_a["scope2_tco2e"],
    "scope2_b": ghg_b["scope2_tco2e"],
}
```

This ensures the comparison's GHG numbers are consistent with what the main dashboard shows.
