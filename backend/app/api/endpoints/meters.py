from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.api.deps import get_db, get_current_active_user
from app.core.permissions import has_permission, Permission, Role
from app.models.user import User
from app.models.meter import Meter
from app.models.data_element import DataElement
from app.models.submission import DataSubmission

router = APIRouter()

class MeterCreateRequest(BaseModel):
    data_element_id: int
    name: str # e.g. 'Sub-meter Tower A'
    account_number: str | None = None
    location: str | None = None

class MeterUpdateRequest(BaseModel):
    name: str
    account_number: str | None = None
    location: str | None = None

@router.get("/me", response_model=List[dict])
async def get_my_meters(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Retrieve all meters assigned to the user's company along with their data element definitions.
    """
    if not current_user.profile or not current_user.profile.company_id:
        return []

    if not has_permission(current_user.profile.role, "meters", Permission.READ):
        raise HTTPException(status_code=403, detail="Not enough permissions to view meters")
        
    result = await db.execute(
        select(Meter)
        .options(selectinload(Meter.data_element))
        .where(Meter.company_id == current_user.profile.company_id)
        .order_by(Meter.id.desc())
    )
    meters = result.scalars().all()
    
    return [
        {
            "id": m.id,
            "data_element_id": m.data_element_id,
            "element_name": m.data_element.name if m.data_element else "Unknown Element",
            "category": m.data_element.category if m.data_element else "E",
            "unit": m.data_element.unit if m.data_element else None,
            "name": m.name,
            "meter_type": (m.data_element.meter_type or m.meter_type) if m.data_element else m.meter_type,
            "account_number": m.account_number,
            "location": m.location,
            "is_active": m.is_active,
            "created_at": m.created_at
        }
        for m in meters
    ]

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_meter(
    *,
    db: AsyncSession = Depends(get_db),
    request_data: MeterCreateRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Create a new custom sub-meter for a specific data element.
    """
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not assigned to a company")

    if not has_permission(current_user.profile.role, "meters", Permission.CREATE):
        raise HTTPException(status_code=403, detail="Not enough permissions to create meters")
        
    # Verify the Data Element exists and allows meters
    element = await db.get(DataElement, request_data.data_element_id)
    if not element:
        raise HTTPException(status_code=404, detail="Data Element not found")
        
    if not element.is_metered:
        raise HTTPException(status_code=400, detail="This data element does not support meters")
        
    new_meter = Meter(
        company_id=current_user.profile.company_id,
        data_element_id=element.id,
        name=request_data.name,
        meter_type=element.meter_type or element.category, # Specific type e.g. 'Electricity' or fallback to cat
        account_number=request_data.account_number,
        location=request_data.location,
        is_active=True
    )
    
    db.add(new_meter)
    await db.commit()
    await db.refresh(new_meter)
    
    return {"id": new_meter.id, "msg": "Meter created successfully"}

@router.put("/{meter_id}", response_model=dict)
async def update_meter(
    *,
    db: AsyncSession = Depends(get_db),
    meter_id: int,
    request_data: MeterUpdateRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Update meter details (Name, Account, Location).
    """
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not assigned to a company")

    if not has_permission(current_user.profile.role, "meters", Permission.UPDATE):
        raise HTTPException(status_code=403, detail="Not enough permissions to update meters")

    meter = await db.get(Meter, meter_id)
    if not meter or meter.company_id != current_user.profile.company_id:
        raise HTTPException(status_code=404, detail="Meter not found")
        
    meter.name = request_data.name
    meter.account_number = request_data.account_number
    meter.location = request_data.location
    
    await db.commit()
    return {"msg": "Meter updated successfully"}

@router.post("/{meter_id}/toggle-active", response_model=dict)
async def toggle_meter_status(
    *,
    db: AsyncSession = Depends(get_db),
    meter_id: int,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Toggle a meter's active status (Archive / Unarchive).
    """
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not assigned to a company")

    if not has_permission(current_user.profile.role, "meters", Permission.UPDATE):
        raise HTTPException(status_code=403, detail="Not enough permissions to update meters")

    meter = await db.get(Meter, meter_id)
    if not meter or meter.company_id != current_user.profile.company_id:
        raise HTTPException(status_code=404, detail="Meter not found")
        
    meter.is_active = not meter.is_active
    await db.commit()
    return {"msg": f"Meter {'activated' if meter.is_active else 'archived'}", "is_active": meter.is_active}

@router.delete("/{meter_id}", response_model=dict)
async def delete_meter(
    *,
    db: AsyncSession = Depends(get_db),
    meter_id: int,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Delete a meter ONLY IF it has no historical data submissions.
    """
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not assigned to a company")

    if not has_permission(current_user.profile.role, "meters", Permission.DELETE):
        raise HTTPException(status_code=403, detail="Not enough permissions to delete meters")

    meter = await db.get(Meter, meter_id)
    if not meter or meter.company_id != current_user.profile.company_id:
        raise HTTPException(status_code=404, detail="Meter not found")
        
    # Validation: Check for historical Data Submissions tied to this exact meter
    stmt = select(DataSubmission).where(DataSubmission.meter_id == meter.id).limit(1)
    historical_data = (await db.execute(stmt)).scalars().first()
    
    if historical_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Cannot delete meter because it has historical reading data. Please archive (deactivate) it instead."
        )
        
    await db.delete(meter)
    await db.commit()
    return {"msg": "Meter deleted successfully"}
