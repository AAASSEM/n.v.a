from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core import security
from app.core.permissions import Role, Permission, has_permission
from app.api.deps import get_db, get_current_active_user
from app.models.company import Company
from app.models.user import User
from pydantic import BaseModel
from typing import Optional

# Temporary Schemas for Company
class CompanyBase(BaseModel):
    name: str
    registration_number: Optional[str] = None
    trade_license_number: Optional[str] = None
    emirate: str
    sector: str
    has_green_key: bool = False
    active_frameworks: List[str] = []

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(CompanyBase):
    pass

class CompanySchema(CompanyBase):
    id: int
    company_code: str
    active_frameworks: list
    
    class Config:
        from_attributes = True

router = APIRouter()

@router.post("/", response_model=CompanySchema, status_code=status.HTTP_201_CREATED)
async def create_company(
    *,
    db: AsyncSession = Depends(get_db),
    company_in: CompanyCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Create a new company. Typically done by super_user during onboarding.
    """
    # Generate a unique company code
    import secrets
    import string
    
    # Simple loop to ensure uniqueness (in a real app, use a more robust strategy or UUIDs)
    while True:
        generated_code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
        exists = await db.execute(select(Company).where(Company.company_code == generated_code))
        if not exists.scalars().first():
            break
    company = Company(
        owner_id=current_user.id,
        name=company_in.name,
        registration_number=company_in.registration_number,
        trade_license_number=company_in.trade_license_number,
        company_code=generated_code,
        emirate=company_in.emirate.lower(),
        sector=company_in.sector.lower(),
        has_green_key=company_in.has_green_key,
        active_frameworks=company_in.active_frameworks
    )
    db.add(company)
    await db.commit()
    await db.refresh(company)
    
    # Assign the creator to this new company
    if current_user.profile:
        current_user.profile.company_id = company.id
        db.add(current_user.profile)
        await db.commit()
        
    return company

@router.get("/me", response_model=CompanySchema)
async def read_my_company(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Get current user's company
    """
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=404, detail="Company not found")
        
    company = await db.get(Company, current_user.profile.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company

@router.put("/{company_id}", response_model=CompanySchema)
async def update_company(
    company_id: int,
    company_in: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Update a company.
    """
    # RBAC check
    if not has_permission(current_user.profile.role, "companies", Permission.UPDATE):
        raise HTTPException(status_code=403, detail="Not enough permissions to update company profile")
        
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Update logic
    company.name = company_in.name
    company.registration_number = company_in.registration_number
    company.trade_license_number = company_in.trade_license_number
    company.emirate = company_in.emirate.lower()
    company.sector = company_in.sector.lower()
    company.has_green_key = company_in.has_green_key
    company.active_frameworks = company_in.active_frameworks

    db.add(company)
    await db.commit()
    await db.refresh(company)
    return company

@router.get("/", response_model=List[CompanySchema])
async def read_companies(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Retrieve companies.
    """
    # Simplification: return all companies for dev user, normally scope to user profile
    result = await db.execute(select(Company).offset(skip).limit(limit))
    return result.scalars().all()
