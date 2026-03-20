from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core import security
from app.core.config import settings
from app.api.deps import get_db, get_current_user
from app.models.user import User, UserProfile
from app.schemas.user import Token, User as UserSchema, UserCreate
from app.core.permissions import Role
import logging
from app.services.email_service import email_service
from app.models.token import EmailVerificationToken, TokenType

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/login", response_model=Token)
async def login_access_token(
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()
    
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

from datetime import datetime
from app.models.token import EmailVerificationToken

@router.post("/magic-link/{token}", response_model=Token)
async def verify_magic_link(
    token: str,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Verify magic link token and log the user in.
    """
    result = await db.execute(select(EmailVerificationToken).where(EmailVerificationToken.token == token))
    db_token = result.scalars().first()
    
    if not db_token:
        raise HTTPException(status_code=400, detail="Invalid token")
        
    if db_token.used_at is not None:
        raise HTTPException(status_code=400, detail="Token already used")
        
    # Check expiry (7 days)
    expiry_date = db_token.created_at + timedelta(days=7)
    if datetime.utcnow() > expiry_date:
        raise HTTPException(status_code=400, detail="Token has expired")
        
    # Get user
    result = await db.execute(select(User).where(User.id == db_token.user_id))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Update state
    user.is_active = True
    user.email_verified = True
    db_token.used_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(user)

    # Issue login token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserSchema)
async def read_users_me(
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Get current user.
    """
    return current_user

from app.services.platform_service import platform_service

@router.post("/register", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def register_user(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: UserCreate,
    background_tasks: BackgroundTasks,
) -> Any:
    """
    Public registration endpoint for new users.
    """
    logger.info(f"REGISTRATION START: New user signup attempt for email: {user_in.email}")
    
    # Check registration toggle
    if await platform_service.get_system_setting(db, "disable_registration"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public registration is currently disabled."
        )
        
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalars().first():
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
        
    user = User(
        email=user_in.email,
        password_hash=security.get_password_hash(user_in.password),
        first_name=user_in.first_name,
        last_name=user_in.last_name,
        is_active=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Needs a profile 
    profile = UserProfile(
        user_id=user.id,
        role=Role.SUPER_USER.value # Default to super_user for company creator
    )
    db.add(profile)
    
    # Generate Verification Token
    token_obj = EmailVerificationToken(
        user_id=user.id,
        token_type=TokenType.email_verification
    )
    db.add(token_obj)
    await db.commit()
    await db.refresh(token_obj)
    
    # Send verification email via background task
    background_tasks.add_task(
        email_service.send_magic_link_email,
        email=user.email,
        token=token_obj,
        context={
            "name": user.first_name,
            "company_name": "ESG Portal"
        }
    )
    
    # Refresh user with eager loaded relationships for Pydantic serialization
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(User).where(User.id == user.id).options(selectinload(User.profile))
    )
    user_with_profile = result.scalars().first()
    
    return user_with_profile
