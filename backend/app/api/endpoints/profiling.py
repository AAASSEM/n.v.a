from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api.deps import get_db, get_current_active_user
from app.models.profiling import ProfilingQuestion, CompanyProfileAnswer
from app.models.checklist import CompanyChecklist
from app.models.data_element import DataElement
from app.models.company import Company
from app.models.user import User
from app.services.profiling_service import ProfilingService
from pydantic import BaseModel
from sqlalchemy.orm import selectinload

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
) -> Any:
    """
    Retrieve profiling questions for framework onboarding.
    Filters questions based on the user's company active frameworks.
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

    filtered_questions = []
    for q in all_questions:
        if not q.frameworks:
            filtered_questions.append(q)
            continue
            
        req_frameworks = [f.strip().lower() for f in q.frameworks.split(",") if f.strip()]
        
        # If the question overlaps with any active user framework
        if any(fk in active_frameworks for fk in req_frameworks):
            filtered_questions.append(q)

    return filtered_questions

@router.get("/answers/me", response_model=List[dict])
async def read_my_answers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Get current user's profiling answers.
    """
    if not current_user.profile or not current_user.profile.company_id:
        return []
        
    result = await db.execute(
        select(CompanyProfileAnswer)
        .where(CompanyProfileAnswer.company_id == current_user.profile.company_id)
    )
    answers = result.scalars().all()
    return [{"question_id": a.question_id, "answer": a.answer} for a in answers]

class SubmitAnswersRequest(BaseModel):
    company_id: int
    answers: List[dict] # Expected: [{"question_id": int, "answer": bool}]

@router.post("/answers", status_code=status.HTTP_200_OK)
async def submit_profiling_answers(
    *,
    db: AsyncSession = Depends(get_db),
    request_data: SubmitAnswersRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Submit profiling answers to generate company checklist and meters.
    """
    try:
        await ProfilingService.generate_checklist(
            company_id=request_data.company_id,
            answers=request_data.answers,
            db=db
        )
        return {"msg": "Checklist and meters generated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# -- Checklist Endpoints --

@router.get("/checklist/me", response_model=List[dict])
async def get_my_checklist(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Retrieve the personalized checklist generated for the user's company.
    Includes the actual data elements and assigned users.
    """
    if not current_user.profile or not current_user.profile.company_id:
        return []
        
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
            selectinload(CompanyChecklist.user)
        )
        .where(CompanyChecklist.company_id == current_user.profile.company_id)
    )
    checklists = result.scalars().all()
    
    response = []
    for c in checklists:
        display_fws = []
        if c.data_element and c.data_element.frameworks:
            for f in c.data_element.frameworks.split(','):
                f_clean = f.strip().lower()
                if f_clean in active_frameworks:
                    display_fws.append(f.strip())
                    
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
            "frameworks": ", ".join(display_fws) if display_fws else None
        })
        
    return response

class AssignElementRequest(BaseModel):
    checklist_id: int
    user_id: int | None

class BulkAssignCategoryRequest(BaseModel):
    category: str # 'E', 'S', or 'G'
    user_id: int | None

@router.post("/checklist/assign", status_code=status.HTTP_200_OK)
async def assign_checklist_item(
    *,
    db: AsyncSession = Depends(get_db),
    assign_req: AssignElementRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Assign a specific checklist item to a user in the company.
    """
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not associated with a company")
        
    checklist_item = await db.get(CompanyChecklist, assign_req.checklist_id)
    if not checklist_item or checklist_item.company_id != current_user.profile.company_id:
        raise HTTPException(status_code=404, detail="Checklist item not found")
        
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
) -> Any:
    """
    Bulk assign all checklist items in a specific category to a user.
    """
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not associated with a company")
        
    from sqlalchemy import update
    
    # Perform a true bulk UPDATE directly in the database without moving rows to server memory
    stmt = (
        update(CompanyChecklist)
        .where(
            CompanyChecklist.company_id == current_user.profile.company_id,
            CompanyChecklist.data_element_id.in_(
                select(DataElement.id).where(DataElement.category == bulk_req.category)
            )
        )
        .values(assigned_to=bulk_req.user_id)
    )
    result = await db.execute(stmt)
    await db.commit()
    
    return {"msg": f"Bulk assignment completed successfully", "updated": result.rowcount}
