from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.permissions import Role, Permission, has_permission
from app.api.deps import get_db, get_current_active_user
from app.models.data_element import DataElement
from app.models.user import User
from pydantic import BaseModel
from typing import Optional

class DataElementBase(BaseModel):
    element_code: str
    name: str
    category: str
    description: Optional[str] = None
    unit: Optional[str] = None
    is_metered: bool = False
    meter_type: Optional[str] = None

class DataElementSchema(DataElementBase):
    id: int
    
    class Config:
        from_attributes = True

router = APIRouter()

@router.get("/", response_model=List[DataElementSchema])
async def read_data_elements(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Retrieve all available data elements.
    """
    result = await db.execute(select(DataElement).offset(skip).limit(limit))
    return result.scalars().all()
