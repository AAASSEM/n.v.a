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
        
    # Check maintenance mode
    is_maint = await platform_service.get_system_setting(db, "maintenance_mode")
    if is_maint and not getattr(user, 'is_developer', False):
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

async def verify_developer_secret(
    x_developer_secret: str = Header(..., description="Static Developer Secret Key")
):
    # Strip any hidden whitespaces or newlines from both the header and the settings
    clean_secret = x_developer_secret.strip()
    target_secret = settings.DEVELOPER_ADMIN_SECRET.strip()
    
    if clean_secret != target_secret:
        raise HTTPException(status_code=403, detail="Invalid Developer Secret")
    return True
