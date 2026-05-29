from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api.deps import get_db, get_current_active_user, resolve_site_id
from app.models.profiling import ProfilingQuestion, CompanyProfileAnswer
from app.models.checklist import CompanyChecklist
from app.models.data_element import DataElement
from app.models.company import Company
from app.models.user import User
from app.services.profiling_service import ProfilingService
from pydantic import BaseModel
from sqlalchemy.orm import selectinload

# Mapping from shorthand Excel codes (E, D, G) to normalized active frameworks (esg, dst, green key)
FW_MAPPING = {
    "e": "esg",
    "d": "dst",
    "g": "green key"
}

# Display names mapping for short codes
FW_DISPLAY_NAMES = {
    "e": "ESG",
    "d": "DST",
    "g": "Green Key"
}

class ProfilingQuestionSchema(BaseModel):
    id: int
    question_text: str

    class Config:
        from_attributes = True

router = APIRouter()

@router.get("/questions", response_model=List[ProfilingQuestionSchema])
async def read_profiling_questions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    site_id: Optional[int] = Query(None),
) -> Any:
    """
    Retrieve profiling questions for framework onboarding.
    Filters questions based on the user's company active frameworks.
    Questions are global (not site-scoped) — the answers are site-scoped.
    """
    all_questions = (await db.execute(select(ProfilingQuestion).order_by(ProfilingQuestion.question_order))).scalars().all()

    if not current_user.profile or not current_user.profile.company_id:
        return all_questions

    company = await db.get(Company, current_user.profile.company_id)
    if not company:
        return all_questions

    active_frameworks = set()
    if company.active_frameworks:
        for fw in company.active_frameworks:
            active_frameworks.add(fw.strip().lower())

    if getattr(company, 'has_green_key', False):
        active_frameworks.add("green key")

    # If site_id is provided, resolve site and override DST if site is not in Dubai
    if site_id is not None:
        from app.models.company import Site
        effective_site_id = await resolve_site_id(current_user, site_id, db, required=False)
        if effective_site_id:
            site = await db.get(Site, effective_site_id)
            if site and site.location:
                site_loc = site.location.strip().lower()
                if "dubai" not in site_loc:
                    active_frameworks.discard("dst")

    filtered_questions = []
    for q in all_questions:
        if not q.frameworks:
            filtered_questions.append(q)
            continue

        req_frameworks = [f.strip().lower() for f in q.frameworks.split(",") if f.strip()]
        mapped_req = [FW_MAPPING.get(fk, fk) for fk in req_frameworks]
        if any(fk in active_frameworks for fk in mapped_req):
            filtered_questions.append(q)

    return filtered_questions


@router.get("/answers/me", response_model=List[dict])
async def read_my_answers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    site_id: Optional[int] = Query(None),
) -> Any:
    """
    Get current user's profiling answers for a given site.
    """
    if not current_user.profile or not current_user.profile.company_id:
        return []

    effective_site_id = await resolve_site_id(current_user, site_id, db, required=True)

    result = await db.execute(
        select(CompanyProfileAnswer).where(
            CompanyProfileAnswer.company_id == current_user.profile.company_id,
            CompanyProfileAnswer.site_id == effective_site_id,
        )
    )
    answers = result.scalars().all()
    return [{"question_id": a.question_id, "answer": a.answer} for a in answers]


class SubmitAnswersRequest(BaseModel):
    company_id: int
    answers: List[dict]  # [{"question_id": int, "answer": bool}]


@router.post("/answers", status_code=status.HTTP_200_OK)
async def submit_profiling_answers(
    *,
    db: AsyncSession = Depends(get_db),
    request_data: SubmitAnswersRequest,
    current_user: User = Depends(get_current_active_user),
    site_id: Optional[int] = Query(None),
) -> Any:
    """
    Submit profiling answers to generate the site-scoped checklist and meters.
    """
    effective_site_id = await resolve_site_id(current_user, site_id, db, required=True)
    if request_data.company_id != current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Cannot submit answers for a different company")

    try:
        await ProfilingService.generate_checklist(
            company_id=request_data.company_id,
            site_id=effective_site_id,
            answers=request_data.answers,
            db=db,
        )
        return {"msg": "Checklist and meters generated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# -- Checklist Endpoints --

@router.get("/checklist/me", response_model=List[dict])
async def get_my_checklist(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    site_id: Optional[int] = Query(None),
) -> Any:
    """
    Retrieve the personalized checklist generated for the current site.
    """
    if not current_user.profile or not current_user.profile.company_id:
        return []

    effective_site_id = await resolve_site_id(current_user, site_id, db, required=True)

    company = await db.get(Company, current_user.profile.company_id)
    active_frameworks = []
    if company.active_frameworks:
        active_frameworks = [f.strip().lower() for f in company.active_frameworks]
    if getattr(company, 'has_green_key', False):
        active_frameworks.append('green key')

    result = await db.execute(
        select(CompanyChecklist)
        .options(
            selectinload(CompanyChecklist.data_element),
            selectinload(CompanyChecklist.user),
        )
        .where(
            CompanyChecklist.company_id == current_user.profile.company_id,
            CompanyChecklist.site_id == effective_site_id,
        )
    )
    checklists = result.scalars().all()

    response = []
    for c in checklists:
        display_fws = []
        if c.data_element and c.data_element.frameworks:
            for f in c.data_element.frameworks.split(','):
                f_clean = f.strip().lower()
                mapped_fw = FW_MAPPING.get(f_clean, f_clean)
                if mapped_fw in active_frameworks:
                    display_fws.append(FW_DISPLAY_NAMES.get(f_clean, f.strip()))

        response.append({
            "id": c.id,
            "data_element_id": c.data_element.id if c.data_element else None,
            "element_name": c.data_element.name if c.data_element else "Unknown",
            "category": c.data_element.category if c.data_element else "E",
            "frequency": c.frequency,
            "unit": c.data_element.unit if c.data_element else None,
            "is_required": c.is_required,
            "assigned_to": c.assigned_to,
            "assigned_user_name": f"{c.user.first_name} {c.user.last_name}".strip() if c.user else None,
            "frameworks": ", ".join(display_fws) if display_fws else None,
        })

    return response


class AssignElementRequest(BaseModel):
    checklist_id: int
    user_id: int | None


class BulkAssignCategoryRequest(BaseModel):
    category: str  # 'E', 'S', or 'G'
    user_id: int | None


@router.post("/checklist/assign", status_code=status.HTTP_200_OK)
async def assign_checklist_item(
    *,
    db: AsyncSession = Depends(get_db),
    assign_req: AssignElementRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not associated with a company")

    checklist_item = await db.get(CompanyChecklist, assign_req.checklist_id)
    if not checklist_item or checklist_item.company_id != current_user.profile.company_id:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    # Site-pinned users can only modify their own site
    pinned = current_user.profile.site_id
    if pinned is not None and checklist_item.site_id != pinned:
        raise HTTPException(status_code=403, detail="Cannot modify another site's checklist")

    checklist_item.assigned_to = assign_req.user_id
    db.add(checklist_item)
    await db.commit()
    return {"msg": "Assigned successfully"}


@router.post("/checklist/assign/bulk", status_code=status.HTTP_200_OK)
async def bulk_assign_category(
    *,
    db: AsyncSession = Depends(get_db),
    bulk_req: BulkAssignCategoryRequest,
    current_user: User = Depends(get_current_active_user),
    site_id: Optional[int] = Query(None),
) -> Any:
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not associated with a company")

    effective_site_id = await resolve_site_id(current_user, site_id, db, required=True)

    from sqlalchemy import update
    stmt = (
        update(CompanyChecklist)
        .where(
            CompanyChecklist.company_id == current_user.profile.company_id,
            CompanyChecklist.site_id == effective_site_id,
            CompanyChecklist.data_element_id.in_(
                select(DataElement.id).where(DataElement.category == bulk_req.category)
            ),
        )
        .values(assigned_to=bulk_req.user_id)
    )
    result = await db.execute(stmt)
    await db.commit()

    return {"msg": "Bulk assignment completed successfully", "updated": result.rowcount}
