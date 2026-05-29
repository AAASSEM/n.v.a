from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
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
from app.services.audit_service import audit_service

logger = logging.getLogger(__name__)

router = APIRouter()



from datetime import datetime
from app.models.token import EmailVerificationToken

@router.post("/magic-link/{token}", response_model=Token)
async def verify_magic_link(
    token: str,
    request: Request,
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
        
    # Check expiry (7 days for invitation/email_verification, 1 hour for login/password_reset)
    if db_token.token_type in (TokenType.password_reset, TokenType.login):
        expiry_date = db_token.created_at + timedelta(hours=1)
    else:
        expiry_date = db_token.created_at + timedelta(days=7)
        
    if datetime.utcnow() > expiry_date:
        raise HTTPException(status_code=400, detail="Token has expired")
        
    # Get user
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(User)
        .where(User.id == db_token.user_id)
        .options(selectinload(User.profile))
    )
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Update state
    user.is_active = True
    user.email_verified = True
    db_token.used_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(user)

    await audit_service.log_action(
        db,
        action="LOGIN",
        user_id=user.id,
        company_id=user.profile.company_id if user.profile else None,
        entity_type="USER",
        entity_id=str(user.id),
        details={"email": user.email, "method": "magic_link"},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )

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
    request: Request,
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
        password_hash=security.get_password_hash(user_in.password or "UNUSABLE_PASSWORD_MAGIC_LINK"),
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

    await audit_service.log_action(
        db,
        action="REGISTER",
        user_id=user.id,
        entity_type="USER",
        entity_id=str(user.id),
        details={"email": user.email},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    # Refresh user with eager loaded relationships for Pydantic serialization
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(User).where(User.id == user.id).options(selectinload(User.profile))
    )
    user_with_profile = result.scalars().first()
    
    return user_with_profile

from pydantic import BaseModel, EmailStr

class LoginLinkRequest(BaseModel):
    email: EmailStr

@router.post("/request-login-link")
async def request_login_link(
    request: LoginLinkRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Send a login magic link to the user's email if they exist.
    """
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalars().first()
    
    if user and user.is_active:
        # Create token
        token_obj = EmailVerificationToken(
            user_id=user.id,
            token_type=TokenType.login
        )
        db.add(token_obj)
        await db.commit()
        await db.refresh(token_obj)
        
        # Send login magic link email
        background_tasks.add_task(
            email_service.send_magic_link_email,
            email=user.email,
            token=token_obj,
            context={
                "name": user.first_name,
                "company_name": "ESG Compass"
            }
        )
    
    # Always return 200/success to avoid email enumeration
    return {"detail": "If the email is registered in our system, you will receive a login link shortly."}

class DemoLoginRequest(BaseModel):
    email: EmailStr

@router.post("/demo-login", response_model=Token)
async def demo_login(
    request: DemoLoginRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Direct login endpoint for pre-seeded demo personas.
    Only allows emails ending in @apex.demo.
    """
    if not request.email.endswith("@apex.demo"):
        raise HTTPException(
            status_code=400,
            detail="Demo login is only available for @apex.demo accounts."
        )
        
    # Get user with profile loaded
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(User)
        .where(User.email == request.email)
        .options(selectinload(User.profile))
    )
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Demo user not found.")
        
    if not user.is_active:
        user.is_active = True
        await db.commit()
        await db.refresh(user)

    await audit_service.log_action(
        db,
        action="LOGIN",
        user_id=user.id,
        company_id=user.profile.company_id if user.profile else None,
        entity_type="USER",
        entity_id=str(user.id),
        details={"email": user.email, "method": "demo_login"},
    )

    # Issue access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

class ResetPasswordRequest(BaseModel):
    token: str
    password: str

@router.post("/reset-password", response_model=Token)
async def reset_password(
    request_data: ResetPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Reset a user's password using a verification/reset token.
    """
    result = await db.execute(select(EmailVerificationToken).where(EmailVerificationToken.token == request_data.token))
    db_token = result.scalars().first()
    
    if not db_token:
        raise HTTPException(status_code=400, detail="Invalid token")
        
    if db_token.used_at is not None:
        raise HTTPException(status_code=400, detail="Token already used")
        
    # Check expiry (7 days for invitation/email_verification, 1 hour for login/password_reset)
    if db_token.token_type in (TokenType.password_reset, TokenType.login):
        expiry_date = db_token.created_at + timedelta(hours=1)
    else:
        expiry_date = db_token.created_at + timedelta(days=7)
        
    if datetime.utcnow() > expiry_date:
        raise HTTPException(status_code=400, detail="Token has expired")
        
    # Get user
    result = await db.execute(select(User).where(User.id == db_token.user_id))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Update password
    user.password_hash = security.get_password_hash(request_data.password)
    user.is_active = True
    user.email_verified = True
    
    # Mark token as used
    db_token.used_at = datetime.utcnow()
    
    # If the user profile has must_reset_password, clear it
    from sqlalchemy.orm import selectinload
    result_profile = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = result_profile.scalars().first()
    if profile:
        profile.must_reset_password = False
        db.add(profile)
        
    db.add(user)
    db.add(db_token)
    await db.commit()
    await db.refresh(user)
    
    await audit_service.log_action(
        db,
        action="RESET_PASSWORD",
        user_id=user.id,
        entity_type="USER",
        entity_id=str(user.id),
        details={"email": user.email},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    # Issue login token on success
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }
