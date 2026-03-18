from typing import Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_db, get_current_active_user
from app.core.permissions import has_permission, Permission
from app.models.framework import Framework
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=List[dict])
async def list_available_frameworks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Retrieve all available frameworks for company onboarding/selection.
    """
    if not has_permission(current_user.profile.role, "frameworks", Permission.READ):
        return []

    result = await db.execute(select(Framework).order_by(Framework.type, Framework.name))
    frameworks = result.scalars().all()
    
    return [{
        "id": f.id,
        "framework_id": f.framework_id,
        "name": f.name,
        "type": f.type,
        "description": f.description
    } for f in frameworks]
