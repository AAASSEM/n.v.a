from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.services.audit_service import audit_service
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_db, get_current_active_user
from app.core.permissions import Role
from app.models.user import User
from app.models.company import Site
from app.schemas.site import Site as SiteSchema, SiteCreate, SiteUpdate

router = APIRouter()


def _is_company_admin(role: str) -> bool:
    return role in (Role.ADMIN.value, Role.SUPER_USER.value)


@router.get("/", response_model=List[SiteSchema])
async def list_sites(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    List sites visible to the current user.
    - Site-pinned users see only their own site.
    - Admin/super_user (site_id=NULL) see all sites in their company.
    """
    if not current_user.profile or not current_user.profile.company_id:
        return []

    stmt = select(Site).where(Site.company_id == current_user.profile.company_id)
    if current_user.profile.site_id is not None:
        stmt = stmt.where(Site.id == current_user.profile.site_id)
    stmt = stmt.order_by(Site.id.asc())

    return (await db.execute(stmt)).scalars().all()


@router.post("/", response_model=SiteSchema, status_code=status.HTTP_201_CREATED)
async def create_site(
    *,
    request: Request,
    db: AsyncSession = Depends(get_db),
    site_in: SiteCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not associated with a company")
    if not _is_company_admin(current_user.profile.role):
        raise HTTPException(status_code=403, detail="Only admins can create sites")

    site = Site(
        company_id=current_user.profile.company_id,
        name=site_in.name,
        location=site_in.location,
        sector=site_in.sector,
        is_active=site_in.is_active if site_in.is_active is not None else True,
    )
    db.add(site)
    await db.commit()
    await db.refresh(site)
    await audit_service.log_action(
        db,
        action="CREATE_SITE",
        user_id=current_user.id,
        company_id=current_user.profile.company_id,
        entity_type="SITE",
        entity_id=str(site.id),
        details={"name": site.name, "location": site.location, "sector": site.sector},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )

    return site


@router.get("/{site_id}", response_model=SiteSchema)
async def get_site(
    site_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not associated with a company")

    site = await db.get(Site, site_id)
    if not site or site.company_id != current_user.profile.company_id:
        raise HTTPException(status_code=404, detail="Site not found")
    if current_user.profile.site_id is not None and current_user.profile.site_id != site.id:
        raise HTTPException(status_code=403, detail="You cannot access this site")
    return site


@router.put("/{site_id}", response_model=SiteSchema)
async def update_site(
    site_id: int,
    site_in: SiteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not associated with a company")
    if not _is_company_admin(current_user.profile.role):
        raise HTTPException(status_code=403, detail="Only admins can update sites")

    site = await db.get(Site, site_id)
    if not site or site.company_id != current_user.profile.company_id:
        raise HTTPException(status_code=404, detail="Site not found")

    if site_in.name is not None:
        site.name = site_in.name
    if site_in.location is not None:
        site.location = site_in.location
    if site_in.sector is not None:
        site.sector = site_in.sector
    if site_in.is_active is not None:
        site.is_active = site_in.is_active

    await db.commit()
    await db.refresh(site)
    return site


@router.delete("/{site_id}", response_model=dict)
async def delete_site(
    site_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Soft-delete: mark the site inactive. Hard delete is avoided because the
    site is referenced by users, meters, submissions, etc."""
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not associated with a company")
    if not _is_company_admin(current_user.profile.role):
        raise HTTPException(status_code=403, detail="Only admins can deactivate sites")

    site = await db.get(Site, site_id)
    if not site or site.company_id != current_user.profile.company_id:
        raise HTTPException(status_code=404, detail="Site not found")

    site.is_active = False
    await db.commit()
    return {"msg": "Site deactivated", "id": site.id, "is_active": site.is_active}
