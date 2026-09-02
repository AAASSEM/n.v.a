from typing import Any, List, Optional
import datetime
import logging
import time

import anthropic
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api.deps import get_db, get_current_active_user, resolve_site_id
from app.core.config import settings
from app.models.user import User
from app.models.system import AuditLog
from app.models.ai_dashboard_item import AIDashboardItem
from app.services import ai_chat_service
from app.services.audit_service import audit_service

logger = logging.getLogger(__name__)

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

AI_CHAT_QUERY_ACTION = "AI_CHAT_QUERY"


class ChartPoint(BaseModel):
    label: str
    value: Optional[float] = None
    unit: Optional[str] = None  # only meaningful for chart_type "metric_grid"


class ChartSeries(BaseModel):
    name: str
    points: List[ChartPoint]


class ChartSpec(BaseModel):
    chart_type: str  # "line" | "bar" | "single_value" | "comparison_bar" | "metric_grid"
    title: str
    unit: str
    x_label: str
    y_label: str
    series: List[ChartSeries]
    highlight_label: Optional[str] = None


class Period(BaseModel):
    year: int
    month: int


class ViewDirectives(BaseModel):
    pillar: Optional[str] = None
    framework: Optional[str] = None
    from_period: Optional[Period] = None
    to_period: Optional[Period] = None
    selected_year: Optional[int] = None
    chart_mode: Optional[str] = None
    compare_mode: Optional[bool] = None
    compare_a: Optional[Period] = None
    compare_b: Optional[Period] = None
    site_id: Optional[int] = None


class ChatQueryRequest(BaseModel):
    message: str
    context: str = "dashboard"  # "dashboard" | "reports" — informational only for now


class QuotaInfo(BaseModel):
    used: int
    limit: int


class ChatQueryResponse(BaseModel):
    answer_text: str
    charts: List[ChartSpec]
    view_directives: Optional[ViewDirectives] = None
    is_fallback: bool = False
    quota: QuotaInfo


def _is_demo_user(user: User) -> bool:
    return (user.email or "").endswith("@apex.demo")


def _daily_quota_limit(user: User) -> int:
    return settings.AI_CHAT_DAILY_QUOTA_DEMO if _is_demo_user(user) else settings.AI_CHAT_DAILY_QUOTA_PER_COMPANY


def _today_start() -> datetime.datetime:
    today = datetime.date.today()
    return datetime.datetime.combine(today, datetime.time.min)


def _resets_at() -> str:
    tomorrow = datetime.date.today() + datetime.timedelta(days=1)
    return datetime.datetime.combine(tomorrow, datetime.time.min).isoformat()


async def _quota_used_today(db: AsyncSession, company_id: int) -> int:
    stmt = select(func.count()).select_from(AuditLog).where(
        AuditLog.company_id == company_id,
        AuditLog.action == AI_CHAT_QUERY_ACTION,
        AuditLog.created_at >= _today_start(),
    )
    return (await db.execute(stmt)).scalar() or 0


@router.get("/quota")
async def get_quota(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not assigned to a company")
    limit = _daily_quota_limit(current_user)
    used = await _quota_used_today(db, current_user.profile.company_id)
    return {"used_today": used, "limit": limit, "resets_at": _resets_at()}


@router.post("/query", response_model=ChatQueryResponse)
@limiter.limit(settings.AI_CHAT_RATE_LIMIT)
async def query(
    request: Request,
    payload: ChatQueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    site_id: Optional[int] = Query(None),
) -> Any:
    """
    Natural-language question about the caller's own ESG data, answered by a real
    Claude tool-calling loop (app.services.ai_chat_service.run_chat_turn).

    Cost control: quota is checked BEFORE calling Anthropic at all, so a rejected
    request incurs zero API cost. Demo (@apex.demo) accounts get a much stricter
    daily cap than real companies, since that traffic is effectively public/anonymous.
    """
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not assigned to a company")

    company_id = current_user.profile.company_id
    limit = _daily_quota_limit(current_user)
    used = await _quota_used_today(db, company_id)
    if used >= limit:
        raise HTTPException(
            status_code=429,
            detail={
                "detail": "Daily AI chat quota reached. Try again tomorrow.",
                "resets_at": _resets_at(),
            },
        )

    effective_site_id = await resolve_site_id(current_user, site_id, db, required=False)

    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI chat is not configured on this server.")

    # print(flush=True) rather than logger.* here — logger output was not
    # reliably showing up in Render's log viewer for this request path (verified:
    # a request that demonstrably executed this code, confirmed by its own JSON
    # error response, produced zero logger output), while main.py's startup
    # print(flush=True) lines always show up. Using the proven-working mechanism
    # until the logging-visibility mystery itself is resolved.
    print(
        f"[AI-CHAT] query starting: company_id={company_id} user_id={current_user.id} "
        f"message_len={len(payload.message)}", flush=True,
    )
    _t0 = time.monotonic()
    try:
        result = await ai_chat_service.run_chat_turn(db, current_user, effective_site_id, payload.message)
    except anthropic.RateLimitError as e:
        print(f"[AI-CHAT] RateLimitError: {e!r}", flush=True)
        raise HTTPException(status_code=503, detail="AI assistant is busy right now — please try again shortly.")
    except anthropic.APIStatusError as e:
        print(f"[AI-CHAT] APIStatusError: status={e.status_code} message={e!r}", flush=True)
        raise HTTPException(status_code=502, detail="AI assistant is temporarily unavailable.")
    except anthropic.APIConnectionError as e:
        print(f"[AI-CHAT] APIConnectionError: {e!r}", flush=True)
        raise HTTPException(status_code=502, detail="AI assistant is temporarily unavailable.")
    except Exception as e:
        import traceback
        print(f"[AI-CHAT] UNEXPECTED EXCEPTION: {e!r}", flush=True)
        traceback.print_exc()
        import sys as _sys
        _sys.stdout.flush()
        _sys.stderr.flush()
        raise HTTPException(status_code=502, detail="AI assistant is temporarily unavailable.")
    print(f"[AI-CHAT] query finished in {time.monotonic() - _t0:.1f}s: company_id={company_id}", flush=True)

    # Only successful answers count against quota.
    await audit_service.log_action(
        db, action=AI_CHAT_QUERY_ACTION, user_id=current_user.id, company_id=company_id,
        entity_type="ai_chat", details={"message": payload.message[:500], "context": payload.context},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return {
        **result,
        "is_fallback": False,
        "quota": {"used": used + 1, "limit": limit},
    }


# --- Pinned "My Dashboard" items ---

class DashboardItemCreate(BaseModel):
    title: str
    chart: ChartSpec
    source_question: Optional[str] = None


class DashboardItemSchema(BaseModel):
    id: int
    title: str
    chart: dict
    source_question: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True


@router.post("/dashboard-items", response_model=DashboardItemSchema)
async def pin_dashboard_item(
    *,
    payload: DashboardItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not assigned to a company")

    item = AIDashboardItem(
        company_id=current_user.profile.company_id,
        site_id=current_user.profile.site_id,
        created_by=current_user.id,
        title=payload.title,
        chart=payload.chart.model_dump(),
        source_question=payload.source_question,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.get("/dashboard-items", response_model=List[DashboardItemSchema])
async def list_dashboard_items(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    if not current_user.profile or not current_user.profile.company_id:
        return []

    stmt = select(AIDashboardItem).where(
        AIDashboardItem.company_id == current_user.profile.company_id
    ).order_by(AIDashboardItem.created_at.desc())
    return (await db.execute(stmt)).scalars().all()


@router.delete("/dashboard-items/{item_id}")
async def delete_dashboard_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not assigned to a company")

    stmt = select(AIDashboardItem).where(
        AIDashboardItem.id == item_id,
        AIDashboardItem.company_id == current_user.profile.company_id,
    )
    item = (await db.execute(stmt)).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Dashboard item not found")

    await db.delete(item)
    await db.commit()
    return {"msg": "Dashboard item removed"}
