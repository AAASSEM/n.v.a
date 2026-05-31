from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core import security
from app.core.config import settings
from app.db.session import async_session
from app.models.user import User
from app.schemas.user import TokenPayload

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)

async def get_db() -> Generator:
    async with async_session() as session:
        yield session

from app.services.platform_service import platform_service

# In-memory cache for maintenance mode (avoids a DB query on every single request)
_maint_cache: dict = {"value": None, "expires": 0}

async def get_current_user(
    db: AsyncSession = Depends(get_db), token: str = Depends(reusable_oauth2)
) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (jwt.JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    result = await db.execute(select(User).options(selectinload(User.profile)).where(User.id == int(token_data.sub)))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Check maintenance mode (cached for 30s to avoid per-request DB hit)
    import time
    now = time.time()
    if _maint_cache["expires"] < now:
        _maint_cache["value"] = await platform_service.get_system_setting(db, "maintenance_mode")
        _maint_cache["expires"] = now + 30
    
    if _maint_cache["value"] and not getattr(user, 'is_developer', False):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Platform is currently under maintenance. Please try again later."
        )
        
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

from fastapi import Header

async def get_developer_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    if not getattr(current_user, 'is_developer', False):
        raise HTTPException(status_code=403, detail="Developer access only")
    return current_user

async def resolve_site_id(
    current_user: User,
    requested_site_id: Optional[int],
    db: AsyncSession,
    required: bool = True,
) -> Optional[int]:
    """
    Resolve the effective site_id for a request based on the caller's scope:
    - Site-pinned user (profile.site_id set): always their own site_id, the request's
      site_id is ignored/forced to match. If they request a different site, 403.
    - Company-wide user (admin / super_user, profile.site_id IS NULL): must pass a
      site_id via query; we verify it belongs to their company.
    - If required=False and caller is company-wide and no site_id given, returns None
      (used e.g. by endpoints that aggregate across sites for admins).
    """
    from app.models.company import Site

    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not associated with a company")

    pinned = current_user.profile.site_id
    if pinned is not None:
        if requested_site_id is not None and int(requested_site_id) != int(pinned):
            raise HTTPException(status_code=403, detail="You cannot access another site's data")
        return pinned

    # Company-wide caller
    if requested_site_id is None:
        if required:
            raise HTTPException(
                status_code=400,
                detail="site_id query parameter is required for company-wide users",
            )
        return None

    site = await db.get(Site, int(requested_site_id))
    if not site or site.company_id != current_user.profile.company_id:
        raise HTTPException(status_code=404, detail="Site not found")
    if not site.is_active:
        raise HTTPException(status_code=400, detail="Site is not active")
    return site.id


async def verify_developer_secret(
    x_developer_secret: str = Header(..., description="Static Developer Secret Key")
):
    # Strip any hidden whitespaces or newlines from both the header and the settings
    clean_secret = x_developer_secret.strip()
    target_secret = settings.DEVELOPER_ADMIN_SECRET.strip()
    
    if clean_secret != target_secret:
        raise HTTPException(status_code=403, detail="Invalid Developer Secret")
    return True
