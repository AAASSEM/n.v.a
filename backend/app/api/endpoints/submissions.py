from typing import Any, List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
import os
import shutil
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, get_current_active_user
from app.core.permissions import has_permission, Permission, Role
from app.models.submission import DataSubmission
from app.models.checklist import CompanyChecklist
from app.models.data_element import DataElement
from app.models.meter import Meter
from app.models.user import User
from pydantic import BaseModel

router = APIRouter()

class SubmissionRowData(BaseModel):
    data_element_id: int
    meter_id: Optional[int] = None
    value: Optional[float] = None
    notes: Optional[str] = None
    evidence_files: Optional[str] = None

class BulkSubmissionRequest(BaseModel):
    year: int
    month: int
    entries: List[SubmissionRowData]

@router.get("/grid/{year}/{month}", response_model=List[dict])
async def get_submission_grid(
    year: int,
    month: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Returns the ready-to-render grid of entry rows for a specific month/year.
    This merges actual Data Elements from the checklist + custom Meters, 
    and attaches any previously saved Submissions for that period.
    """
    company_id = current_user.profile.company_id
    if not company_id:
        raise HTTPException(status_code=403, detail="Not assigned to a company")

    if not has_permission(current_user.profile.role, "data_submissions", Permission.READ):
        raise HTTPException(status_code=403, detail="Not enough permissions to view data submissions")

    # 1. Fetch assigned checklist elements
    stmt_checklist = (
        select(CompanyChecklist)
        .options(
            selectinload(CompanyChecklist.data_element),
            selectinload(CompanyChecklist.user)
        )
        .where(CompanyChecklist.company_id == company_id)
    )
    checklist_records = (await db.execute(stmt_checklist)).scalars().all()

    # 2. Fetch active meters for the company
    stmt_meters = select(Meter).where(
        Meter.company_id == company_id,
        Meter.is_active == True
    )
    meters_records = (await db.execute(stmt_meters)).scalars().all()

    # Group meters by data_element_id
    meters_by_element = {}
    for m in meters_records:
        if m.data_element_id not in meters_by_element:
            meters_by_element[m.data_element_id] = []
        meters_by_element[m.data_element_id].append(m)

    # 3. Fetch existing submissions for the year (to handle annual persistence)
    stmt_subs = select(DataSubmission).where(
        DataSubmission.company_id == company_id,
        DataSubmission.year == year,
        DataSubmission.month.in_([month, 12]) # Fetch current month OR the annual master month (12)
    )
    subs_records = (await db.execute(stmt_subs)).scalars().all()

    # Create lookup dicts: 
    # specific_subs: key = (element_id, meter_id) for current month
    # annual_subs: key = (element_id, meter_id) specifically for month 12
    specific_subs = {}
    annual_subs = {}
    for s in subs_records:
        if s.month == month:
            specific_subs[(s.data_element_id, s.meter_id)] = s
        if s.month == 12:
            annual_subs[(s.data_element_id, s.meter_id)] = s

    # 4. Construct response grid rows
    grid_rows = []

    for item in checklist_records:
        element = item.data_element
        if not element:
            continue
            
        freq = element.collection_frequency.lower()
        # Any task that isn't monthly/daily is considered persistent (Annual or Special Event)
        is_persistent = freq not in ["monthly", "daily"]

        # Check if this element has sub-meters assigned
        element_meters = meters_by_element.get(element.id, [])

        if element_meters and element.is_metered:
            # If sub-meters exist, create a row for EACH sub-meter
            for m in element_meters:
                # If persistent, prefer the master record from month 12
                sub = annual_subs.get((element.id, m.id)) if is_persistent else specific_subs.get((element.id, m.id))
                grid_rows.append({
                    "row_id": f"meter_{m.id}",
                    "data_element_id": element.id,
                    "meter_id": m.id,
                    "name": m.name,
                    "category": element.category,
                    "unit": element.unit,
                    "is_meter": True,
                    "value": float(sub.value) if sub and sub.value is not None else "",
                    "notes": sub.notes if sub else "",
                    "evidence_files": sub.evidence_files if sub else "",
                    "collection_frequency": element.collection_frequency,
                    "assigned_to": item.assigned_to,
                    "assigned_user_name": f"{item.user.first_name} {item.user.last_name}" if item.user else None,
                    "checklist_id": item.id
                })
        else:
            # Create a single row for the base element
            sub = annual_subs.get((element.id, None)) if is_persistent else specific_subs.get((element.id, None))
            grid_rows.append({
                "row_id": f"element_{element.id}",
                "data_element_id": element.id,
                "meter_id": None,
                "name": element.name,
                "category": element.category,
                "unit": element.unit,
                "is_meter": False,
                "value": float(sub.value) if sub and sub.value is not None else "",
                "notes": sub.notes if sub else "",
                "evidence_files": sub.evidence_files if sub else "",
                "collection_frequency": element.collection_frequency,
                "assigned_to": item.assigned_to,
                "assigned_user_name": f"{item.user.first_name} {item.user.last_name}" if item.user else None,
                "checklist_id": item.id
            })

    # Sort rows nicely (E, then S, then G)
    category_order = {"E": 1, "S": 2, "G": 3}
    grid_rows.sort(key=lambda r: (category_order.get(r['category'], 4), r['name']))

    return grid_rows

@router.post("/bulk", response_model=dict)
async def bulk_upsert_submissions(
    *,
    db: AsyncSession = Depends(get_db),
    request_data: BulkSubmissionRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Bulk upsert (insert or update) submissions for a specific month/year grid.
    """
    company_id = current_user.profile.company_id
    if not company_id:
        raise HTTPException(status_code=403, detail="Not assigned to a company")

    if not has_permission(current_user.profile.role, "data_submissions", Permission.CREATE) and \
       not has_permission(current_user.profile.role, "data_submissions", Permission.UPDATE):
        raise HTTPException(status_code=403, detail="Not enough permissions to save submissions")

    # 1. Map element IDs to their frequencies/names to detect persistent items
    element_ids = list(set(entry.data_element_id for entry in request_data.entries))
    stmt_elements = select(DataElement).where(DataElement.id.in_(element_ids))
    elements = (await db.execute(stmt_elements)).scalars().all()
    element_info = {e.id: e for e in elements}

    # 2. Fetch existing submissions for THIS month AND month 12 (annual fallback)
    stmt_subs = select(DataSubmission).where(
        DataSubmission.company_id == company_id,
        DataSubmission.year == request_data.year,
        DataSubmission.month.in_([request_data.month, 12])
    )
    existing_records = (await db.execute(stmt_subs)).scalars().all()
    
    subs_lookup = {}
    for s in existing_records:
        subs_lookup[(s.data_element_id, s.meter_id, s.month)] = s

    created_count = 0
    updated_count = 0

    for entry in request_data.entries:
        if entry.value is None and not entry.notes and not entry.evidence_files:
            continue # Skip fully empty rows

        # Determine if this entry belongs to a persistent bucket (Annual or Special Event)
        element = element_info.get(entry.data_element_id)
        if not element: continue

        freq = element.collection_frequency.lower()
        is_persistent = freq not in ["monthly", "daily"]
        
        # Persistent items (Annual/Special) always go to the "Annual Master" month (12)
        target_month = 12 if is_persistent else request_data.month

        existing = subs_lookup.get((entry.data_element_id, entry.meter_id, target_month))

        if existing:
            # Check permissions for update
            if not has_permission(current_user.profile.role, "data_submissions", Permission.UPDATE):
                continue
                
            # Uploader can only edit their own submissions
            if current_user.profile.role == Role.UPLOADER and existing.submitted_by != current_user.id:
                continue
                
            # Meter Manager can only edit metered data
            if current_user.profile.role == Role.METER_MANAGER and not entry.meter_id:
                continue

            # Update
            existing.value = entry.value
            existing.notes = entry.notes
            existing.evidence_files = entry.evidence_files
            existing.submitted_by = current_user.id
            updated_count += 1
        else:
            # Check permissions for create
            if not has_permission(current_user.profile.role, "data_submissions", Permission.CREATE):
                continue
                
            # Meter Manager can only create metered data
            if current_user.profile.role == Role.METER_MANAGER and not entry.meter_id:
                continue

            # Insert
            new_sub = DataSubmission(
                company_id=company_id,
                data_element_id=entry.data_element_id,
                meter_id=entry.meter_id,
                year=request_data.year,
                month=target_month,
                value=entry.value,
                notes=entry.notes,
                evidence_files=entry.evidence_files,
                submitted_by=current_user.id
            )
            db.add(new_sub)
            created_count += 1

    await db.commit()
    return {
        "msg": "Submissions saved successfully", 
        "created": created_count, 
        "updated": updated_count
    }

UPLOAD_DIR = "uploads"

# Ensure the upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/evidence")
async def upload_evidence_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """
    Upload a file (PDF, Image, etc.) and return its local path to be saved as evidence.
    """
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not assigned to a company")
        
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save file Locally
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {str(e)}")
        
    # Return the URL path
    return {"url": f"/uploads/{unique_filename}", "filename": file.filename}
