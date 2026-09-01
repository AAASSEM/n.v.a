"""
AI chat "brain" for the natural-language data-query feature — real Claude tool-calling.

This module owns two separate things:
1. The DATA TOOLS (list_data_elements, get_monthly_series, find_extremum, compare_periods,
   get_period_snapshot, get_emissions_breakdown) — real, tenant-scoped SQLAlchemy queries.
2. The tool-calling loop (run_chat_turn) that lets Claude orchestrate those tools and end
   the turn via the terminal `present_answer` tool.

Tenant isolation: every data tool takes company_id/site_id as plain Python arguments the
caller (the endpoint) supplies from current_user/resolve_site_id() — never values the model
can set arbitrarily. company_id is NEVER part of any tool's input schema. Any model-proposed
site_id (in view_directives) is re-validated through the same resolve_site_id() helper every
other endpoint uses — see _validate_view_directives.

Numeric correctness: the model never computes "which month was highest" itself — find_extremum
and compare_periods do that arithmetic in Python. The model's job is narration, not computation.
"""
import calendar
import datetime
import json
import logging
from typing import Any, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.data_element import DataElement
from app.models.submission import DataSubmission
from app.models.user import User

logger = logging.getLogger(__name__)

MONTH_NAMES = [calendar.month_name[i] for i in range(1, 13)]
CURRENT_YEAR = datetime.date.today().year
_YEAR_MIN, _YEAR_MAX = 2019, CURRENT_YEAR + 1


# ─── Data tools (real, tenant-scoped queries) ──────────────────────────────────

async def list_data_elements(db: AsyncSession, category: Optional[str] = None) -> list[DataElement]:
    """Real data elements available — never a hardcoded list, so the model can't
    reference an element_code that doesn't actually exist."""
    stmt = select(DataElement)
    if category:
        stmt = stmt.where(DataElement.category == category)
    return (await db.execute(stmt)).scalars().all()


async def get_monthly_series(
    db: AsyncSession, company_id: int, site_id: Optional[int], element_id: int, year: int
) -> list[dict]:
    """Monthly totals for one data element, summed across meters, for one company/site/year.
    Always 12 entries (Jan-Dec), value=None for months with no submission."""
    stmt = select(DataSubmission.month, func.sum(DataSubmission.value)).where(
        DataSubmission.company_id == company_id,
        DataSubmission.data_element_id == element_id,
        DataSubmission.year == year,
        DataSubmission.value.isnot(None),
    )
    if site_id is not None:
        stmt = stmt.where(DataSubmission.site_id == site_id)
    stmt = stmt.group_by(DataSubmission.month)
    rows = (await db.execute(stmt)).all()
    by_month = {month: float(total) for month, total in rows}
    return [{"month": m, "value": by_month.get(m)} for m in range(1, 13)]


async def find_extremum(
    db: AsyncSession, company_id: int, site_id: Optional[int], element_id: int, year: int, direction: str
) -> Optional[dict]:
    """The single highest/lowest month for an element in a year. Computed in Python, not by
    the model — this is what prevents the model from misreading or miscalculating numeric
    data; its job is only to narrate a value it was handed."""
    series = await get_monthly_series(db, company_id, site_id, element_id, year)
    present = [s for s in series if s["value"] is not None]
    if not present:
        return None
    pick = max if direction == "max" else min
    best = pick(present, key=lambda s: s["value"])
    return {"month": best["month"], "value": best["value"], "series": series}


async def compare_periods(
    db: AsyncSession, company_id: int, site_id: Optional[int], element_id: int,
    year_a: int, month_a: int, year_b: int, month_b: int,
) -> dict:
    async def _value_for(year: int, month: int) -> Optional[float]:
        stmt = select(func.sum(DataSubmission.value)).where(
            DataSubmission.company_id == company_id,
            DataSubmission.data_element_id == element_id,
            DataSubmission.year == year,
            DataSubmission.month == month,
            DataSubmission.value.isnot(None),
        )
        if site_id is not None:
            stmt = stmt.where(DataSubmission.site_id == site_id)
        total = (await db.execute(stmt)).scalar()
        return float(total) if total is not None else None

    val_a = await _value_for(year_a, month_a)
    val_b = await _value_for(year_b, month_b)
    return {
        "a": {"year": year_a, "month": month_a, "value": val_a},
        "b": {"year": year_b, "month": month_b, "value": val_b},
    }


async def get_period_snapshot(
    db: AsyncSession, company_id: int, site_id: Optional[int], year: int, month: int
) -> dict:
    """Totals for ALL tracked data elements at one specific month/year — answers broad
    "show me everything for Aug 2026" style questions, not just a single metric."""
    stmt = select(
        DataElement.element_code, DataElement.name, DataElement.unit, DataElement.category,
        func.sum(DataSubmission.value),
    ).join(DataSubmission, DataSubmission.data_element_id == DataElement.id).where(
        DataSubmission.company_id == company_id,
        DataSubmission.year == year,
        DataSubmission.month == month,
        DataSubmission.value.isnot(None),
    )
    if site_id is not None:
        stmt = stmt.where(DataSubmission.site_id == site_id)
    stmt = stmt.group_by(DataElement.element_code, DataElement.name, DataElement.unit, DataElement.category)
    rows = (await db.execute(stmt)).all()
    return {
        "year": year,
        "month": month,
        "elements": [
            {"element_code": code, "name": name, "unit": unit, "category": category, "value": float(total)}
            for code, name, unit, category, total in rows
        ],
    }


async def get_emissions_breakdown(
    db: AsyncSession, company_id: int, site_id: Optional[int], year: int, month: Optional[int] = None
) -> dict:
    """GHG Scope 1/2 breakdown for a year, optionally narrowed to one month. Thin wrapper
    around carbon_accounting.build_emissions_breakdown, reusing the exact same
    emission-factor methodology the dashboard itself uses."""
    from app.services.carbon_accounting import build_emissions_breakdown, ELEMENT_EF_MAP
    from app.models.company import Company

    codes = list(ELEMENT_EF_MAP.keys())
    stmt = select(
        DataElement.element_code, DataSubmission.value, DataSubmission.year, DataSubmission.month,
    ).join(DataSubmission, DataSubmission.data_element_id == DataElement.id).where(
        DataSubmission.company_id == company_id,
        DataElement.element_code.in_(codes),
        DataSubmission.year == year,
        DataSubmission.value.isnot(None),
    )
    if month is not None:
        stmt = stmt.where(DataSubmission.month == month)
    if site_id is not None:
        stmt = stmt.where(DataSubmission.site_id == site_id)
    rows = (await db.execute(stmt)).all()
    submissions = [(code, float(value), yr, mo) for code, value, yr, mo in rows]

    company = await db.get(Company, company_id)
    emirate = getattr(company, "emirate", None)
    return build_emissions_breakdown(submissions, emirate=emirate)


async def _get_element_by_code(db: AsyncSession, code: str) -> Optional[DataElement]:
    stmt = select(DataElement).where(DataElement.element_code == code)
    return (await db.execute(stmt)).scalars().first()


def _safe_year(v: Any) -> int:
    try:
        y = int(v)
    except (TypeError, ValueError):
        return CURRENT_YEAR
    return y if _YEAR_MIN <= y <= _YEAR_MAX else CURRENT_YEAR


def _safe_month(v: Any) -> int:
    try:
        m = int(v)
    except (TypeError, ValueError):
        return 1
    return m if 1 <= m <= 12 else 1


# ─── Tool schemas (Anthropic strict tool-use format) ───────────────────────────

_PERIOD_SCHEMA = {
    "type": "object",
    "properties": {"year": {"type": "integer"}, "month": {"type": "integer"}},
    "required": ["year", "month"],
    "additionalProperties": False,
}
_NULLABLE_PERIOD = {"anyOf": [_PERIOD_SCHEMA, {"type": "null"}]}

_CHART_SCHEMA = {
    "type": "object",
    "properties": {
        "chart_type": {"type": "string", "enum": ["line", "bar", "single_value", "comparison_bar", "metric_grid"]},
        "title": {"type": "string"},
        "unit": {"type": "string"},
        "x_label": {"type": "string"},
        "y_label": {"type": "string"},
        "series": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "points": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": {"type": "string"},
                                "value": {"anyOf": [{"type": "number"}, {"type": "null"}]},
                                "unit": {
                                    "anyOf": [{"type": "string"}, {"type": "null"}],
                                    "description": "Only for chart_type metric_grid: this point's own unit, since a metric_grid mixes incompatible units.",
                                },
                            },
                            "required": ["label", "value", "unit"],
                            "additionalProperties": False,
                        },
                    },
                },
                "required": ["name", "points"],
                "additionalProperties": False,
            },
        },
        "highlight_label": {"anyOf": [{"type": "string"}, {"type": "null"}]},
    },
    "required": ["chart_type", "title", "unit", "x_label", "y_label", "series", "highlight_label"],
    "additionalProperties": False,
}

_VIEW_DIRECTIVES_SCHEMA = {
    "type": "object",
    "properties": {
        "pillar": {"anyOf": [{"type": "string", "enum": ["E", "S", "G"]}, {"type": "null"}]},
        "framework": {"anyOf": [{"type": "string"}, {"type": "null"}]},
        "from_period": _NULLABLE_PERIOD,
        "to_period": _NULLABLE_PERIOD,
        "selected_year": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
        "chart_mode": {"anyOf": [{"type": "string", "enum": ["indexed", "actual", "logarithmic"]}, {"type": "null"}]},
        "compare_mode": {"anyOf": [{"type": "boolean"}, {"type": "null"}]},
        "compare_a": _NULLABLE_PERIOD,
        "compare_b": _NULLABLE_PERIOD,
        "site_id": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
    },
    "required": [
        "pillar", "framework", "from_period", "to_period", "selected_year",
        "chart_mode", "compare_mode", "compare_a", "compare_b", "site_id",
    ],
    "additionalProperties": False,
}

TOOLS = [
    {
        "name": "list_data_elements",
        "description": (
            "List the ESG data elements (metrics) tracked by this company, optionally "
            "filtered by pillar. Call this first if you don't already know the exact "
            "element_code for a metric the user mentioned — never invent one."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {"anyOf": [{"type": "string", "enum": ["E", "S", "G"]}, {"type": "null"}]},
            },
            "required": ["category"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "name": "get_monthly_series",
        "description": "Get the monthly totals (Jan-Dec) for one metric in one year, for the company/site in scope.",
        "input_schema": {
            "type": "object",
            "properties": {
                "element_code": {"type": "string", "description": "Exact element_code from list_data_elements."},
                "year": {"type": "integer"},
            },
            "required": ["element_code", "year"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "name": "find_extremum",
        "description": (
            "Find the single highest or lowest month for one metric in one year. Always use "
            "this for 'highest/lowest/peak/most/least' questions instead of computing it "
            "yourself from get_monthly_series data."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "element_code": {"type": "string"},
                "year": {"type": "integer"},
                "direction": {"type": "string", "enum": ["max", "min"]},
            },
            "required": ["element_code", "year", "direction"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "name": "compare_periods",
        "description": "Compare one metric's value between two specific months.",
        "input_schema": {
            "type": "object",
            "properties": {
                "element_code": {"type": "string"},
                "year_a": {"type": "integer"}, "month_a": {"type": "integer"},
                "year_b": {"type": "integer"}, "month_b": {"type": "integer"},
            },
            "required": ["element_code", "year_a", "month_a", "year_b", "month_b"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "name": "get_period_snapshot",
        "description": (
            "Get totals for ALL tracked metrics in one specific month/year. Use this for "
            "broad 'show me everything for X' style questions, not a single-metric question."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"year": {"type": "integer"}, "month": {"type": "integer"}},
            "required": ["year", "month"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "name": "get_emissions_breakdown",
        "description": "Get the Scope 1 / Scope 2 GHG emissions breakdown (tCO2e) for a year, optionally narrowed to one month.",
        "input_schema": {
            "type": "object",
            "properties": {
                "year": {"type": "integer"},
                "month": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
            },
            "required": ["year", "month"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "name": "present_answer",
        "description": (
            "Present the final answer to the user. Call this exactly once, as your last "
            "action, to end the turn — never end a turn without calling it."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "answer_text": {"type": "string", "description": "1-3 plain-language sentences answering the question."},
                "chart": {"anyOf": [_CHART_SCHEMA, {"type": "null"}]},
                "view_directives": {
                    "anyOf": [_VIEW_DIRECTIVES_SCHEMA, {"type": "null"}],
                    "description": (
                        "Only set fields here the question actually implies a view change for "
                        "(a period, pillar, framework, site, or comparison). Leave null/all-null "
                        "otherwise — do not propose changes speculatively."
                    ),
                },
            },
            "required": ["answer_text", "chart", "view_directives"],
            "additionalProperties": False,
        },
        # Not strict: this schema's nested chart + view_directives union makes the
        # compiled constrained-decoding grammar too large (Anthropic API 400s on it).
        # Safe to relax here specifically because both halves are independently
        # re-validated in Python regardless of what the model sends — view_directives
        # via _validate_view_directives (drops invalid/foreign fields), and chart via
        # the response's Pydantic ChartSpec model (rejects malformed shapes outright).
    },
]

_SYSTEM_PROMPT = (
    "You are an ESG (Environmental, Social, Governance) data assistant embedded in a "
    "sustainability reporting dashboard. You answer questions about a company's tracked "
    "sustainability metrics using the provided tools, and may propose dashboard view changes.\n\n"
    "Rules:\n"
    "- Never compute numeric answers yourself. Use find_extremum for highest/lowest questions "
    "and compare_periods for comparisons — these tools compute exact values from real data.\n"
    "- If you don't already know the exact element_code for a metric the user mentioned, call "
    "list_data_elements first. Never invent an element_code.\n"
    "- Keep answer_text short: 1-3 plain-language sentences.\n"
    "- Only propose view_directives when the question implies a specific view (a period, "
    "pillar, framework, site, or comparison). Leave everything null otherwise.\n"
    "- IMPORTANT: 'implies a specific view' includes plain informational questions that name "
    "a period, not just comparisons — e.g. 'show me the data for August 2026', 'what happened "
    "in Q1', 'how did we do last month' all mean the user wants the dashboard itself to jump "
    "to that period. For these, set to_period (and from_period if a range was named) in "
    "view_directives in addition to answering in answer_text. The same applies to a named "
    "pillar/framework/site: 'show me our social metrics' should set pillar: 'S'.\n"
    "- Whenever your answer is backed by a single metric's monthly series (get_monthly_series, "
    "find_extremum) or a two-period comparison (compare_periods), always include a chart of "
    "type 'bar' or 'line' built from that same data — never leave chart null for these. This "
    "applies equally to 'highest' and 'lowest' questions; be consistent between them. Only "
    "leave chart null for answers with no underlying series (e.g. 'what metrics do we track').\n"
    "- get_period_snapshot answers must ALSO always include a chart — same rule as above, no "
    "exception.\n"
    "- HARD RULE, applies to every chart regardless of which tool produced the data: a 'bar' "
    "or 'line' chart has exactly ONE shared y-axis, so every point in it must be the same real "
    "unit (all kWh, or all m3, etc). Never combine metrics with different units (e.g. kWh with "
    "m3, or kWh with a %) into one 'bar'/'line' chart — the small-scale metrics become invisible "
    "next to the large ones, and the chart-level unit field must always be one real unit, NEVER "
    "a placeholder word like 'Mixed', 'various', or 'multiple'. This applies whether the mixed "
    "metrics come from get_period_snapshot or from combining several tool calls yourself (e.g. "
    "'what happened this quarter' pulling electricity + water + renewable % together). When you "
    "have multiple metrics for ONE period with different units, use chart_type 'metric_grid' "
    "instead: one point per metric, each with its own unit field set (e.g. {label: 'Water', "
    "value: 1152, unit: 'm3'}). When you have multiple different-unit metrics trending across "
    "SEVERAL periods and there's no metric_grid-over-time equivalent, pick the ONE metric your "
    "answer_text is actually about and chart just that one — mention the others in answer_text "
    "only, don't force them onto the same axis.\n"
    "- Chart point labels for months must always be the 3-letter abbreviation (Jan, Feb, Mar, "
    "... Dec) — never the full month name.\n"
    "- You must call present_answer exactly once, as your final action, to end the turn."
)


# ─── Tool dispatch ──────────────────────────────────────────────────────────────

async def _execute_tool(db: AsyncSession, company_id: int, site_id: Optional[int], name: str, raw_input: dict) -> Any:
    if name == "list_data_elements":
        category = raw_input.get("category")
        elements = await list_data_elements(db, category if category in ("E", "S", "G") else None)
        return [{"element_code": e.element_code, "name": e.name, "unit": e.unit, "category": e.category} for e in elements]

    if name in ("get_monthly_series", "find_extremum", "compare_periods"):
        element = await _get_element_by_code(db, str(raw_input.get("element_code", "")))
        if not element:
            return {"error": f"Unknown element_code {raw_input.get('element_code')!r}. Call list_data_elements first."}

        if name == "get_monthly_series":
            return await get_monthly_series(db, company_id, site_id, element.id, _safe_year(raw_input.get("year")))

        if name == "find_extremum":
            direction = raw_input.get("direction") if raw_input.get("direction") in ("max", "min") else "max"
            result = await find_extremum(db, company_id, site_id, element.id, _safe_year(raw_input.get("year")), direction)
            if result is None:
                return {"error": f"No submitted data for {element.name} in that year."}
            return {**result, "element_name": element.name, "unit": element.unit}

        return {
            **await compare_periods(
                db, company_id, site_id, element.id,
                _safe_year(raw_input.get("year_a")), _safe_month(raw_input.get("month_a")),
                _safe_year(raw_input.get("year_b")), _safe_month(raw_input.get("month_b")),
            ),
            "element_name": element.name, "unit": element.unit,
        }

    if name == "get_period_snapshot":
        return await get_period_snapshot(db, company_id, site_id, _safe_year(raw_input.get("year")), _safe_month(raw_input.get("month")))

    if name == "get_emissions_breakdown":
        month = raw_input.get("month")
        return await get_emissions_breakdown(db, company_id, site_id, _safe_year(raw_input.get("year")), _safe_month(month) if month is not None else None)

    return {"error": f"Unknown tool: {name}"}


async def _validate_view_directives(raw: Optional[dict], current_user: User, db: AsyncSession) -> Optional[dict]:
    """Independent server-side validation — the model's JSON schema is not trusted alone.
    Invalid/foreign fields are dropped individually rather than failing the whole answer."""
    if not raw:
        return None

    from app.api.deps import resolve_site_id
    from fastapi import HTTPException

    out: dict = {}

    if raw.get("pillar") in ("E", "S", "G"):
        out["pillar"] = raw["pillar"]

    framework = raw.get("framework")
    if isinstance(framework, str) and framework.strip():
        from app.models.company import Company
        company = await db.get(Company, current_user.profile.company_id)
        active = {f.strip().lower() for f in (getattr(company, "active_frameworks", None) or [])}
        active.add("esg")
        if framework.strip().lower() in active:
            out["framework"] = framework.strip()

    for key in ("from_period", "to_period", "compare_a", "compare_b"):
        period = raw.get(key)
        if isinstance(period, dict):
            year, month = period.get("year"), period.get("month")
            if isinstance(year, int) and isinstance(month, int) and _YEAR_MIN <= year <= _YEAR_MAX and 1 <= month <= 12:
                out[key] = {"year": year, "month": month}

    if out.get("compare_a") is not None and out.get("compare_a") == out.get("compare_b"):
        out.pop("compare_a", None)
        out.pop("compare_b", None)

    selected_year = raw.get("selected_year")
    if isinstance(selected_year, int) and _YEAR_MIN <= selected_year <= _YEAR_MAX:
        out["selected_year"] = selected_year

    if raw.get("chart_mode") in ("indexed", "actual", "logarithmic"):
        out["chart_mode"] = raw["chart_mode"]

    if isinstance(raw.get("compare_mode"), bool):
        out["compare_mode"] = raw["compare_mode"]

    proposed_site = raw.get("site_id")
    if isinstance(proposed_site, int):
        try:
            validated = await resolve_site_id(current_user, proposed_site, db, required=False)
            if validated is not None:
                out["site_id"] = validated
        except HTTPException:
            pass  # foreign/invalid site — drop this field, don't fail the whole answer

    return out or None


# ─── Main entry point ──────────────────────────────────────────────────────────

async def run_chat_turn(
    db: AsyncSession, current_user: User, site_id: Optional[int], message: str,
) -> dict:
    """Runs the bounded Claude tool-calling loop for one chat turn.
    Returns {"answer_text": str, "charts": [ChartSpec-shaped dict], "view_directives": dict|None}.
    """
    if not settings.ANTHROPIC_API_KEY:
        raise RuntimeError("AI chat is not configured (ANTHROPIC_API_KEY unset)")

    import anthropic
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    company_id = current_user.profile.company_id

    today = datetime.date.today()
    messages: list = [{
        "role": "user",
        "content": f"Today's date is {today.isoformat()}.\n\nQuestion: {message}",
    }]

    for _ in range(settings.AI_CHAT_MAX_TOOL_ITERATIONS):
        response = await client.messages.create(
            model=settings.AI_CHAT_MODEL,
            max_tokens=settings.AI_CHAT_MAX_TOKENS,
            system=[{"type": "text", "text": _SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
            tools=TOOLS,
            messages=messages,
        )

        if response.stop_reason != "tool_use":
            text = "".join(b.text for b in response.content if b.type == "text")
            return {"answer_text": text or "I couldn't produce an answer to that.", "charts": [], "view_directives": None}

        messages.append({"role": "assistant", "content": response.content})

        tool_use_blocks = [b for b in response.content if b.type == "tool_use"]
        tool_results = []
        terminal: Optional[dict] = None

        for block in tool_use_blocks:
            if block.name == "present_answer":
                directives = await _validate_view_directives(block.input.get("view_directives"), current_user, db)
                terminal = {
                    "answer_text": block.input.get("answer_text") or "",
                    "charts": [block.input["chart"]] if block.input.get("chart") else [],
                    "view_directives": directives,
                }
                tool_results.append({"type": "tool_result", "tool_use_id": block.id, "content": "OK"})
                continue
            try:
                result = await _execute_tool(db, company_id, site_id, block.name, block.input)
                tool_results.append({
                    "type": "tool_result", "tool_use_id": block.id,
                    "content": json.dumps(result, default=str),
                })
            except Exception as e:
                logger.exception(f"AI chat tool {block.name} failed")
                tool_results.append({
                    "type": "tool_result", "tool_use_id": block.id,
                    "content": f"Tool error: {e}", "is_error": True,
                })

        if terminal is not None:
            return terminal

        messages.append({"role": "user", "content": tool_results})

    return {
        "answer_text": "I wasn't able to finish that within the allotted steps — try a more specific question.",
        "charts": [], "view_directives": None,
    }
