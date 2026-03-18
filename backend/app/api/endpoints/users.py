from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core import security
from app.core.permissions import Role, Permission, has_permission, can_manage_role
from app.api.deps import get_db, get_current_active_user
from app.models.user import User, UserProfile
from app.schemas.user import User as UserSchema, UserCreate, UserUpdate
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.services.email_service import email_service
from app.models.token import EmailVerificationToken, TokenType

class UserInvite(BaseModel):
    email: str
    first_name: str
    last_name: str
    role: str

class RoleUpdate(BaseModel):
    role: str

class PasswordUpdate(BaseModel):
    password: str

router = APIRouter()

@router.post("/", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def create_user(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: UserCreate,
    current_user: User = Depends(get_current_active_user),
    # For a real implementation, you'd get the specific role assigned from the request
    # Here we default to needing Super User generic create privileges for demonstration
) -> Any:
    """
    Create new user.
    """
    if not current_user.profile or not has_permission(current_user.profile.role, "users", Permission.CREATE):
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
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
        is_active=user_in.is_active,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.get("/", response_model=List[UserSchema])
async def read_users(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Retrieve users.
    """
    if not current_user.profile or not has_permission(current_user.profile.role, "users", Permission.READ):
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    # In a real app we'd scope this down to the company, omitted for brevity
    result = await db.execute(select(User).offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/company/me", response_model=List[UserSchema])
async def read_company_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Retrieve all users that belong to the current user's company.
    Used for checklists and assignments.
    """
    if not current_user.profile or not current_user.profile.company_id:
        # Return just the current user if no company yet
        return [current_user]
        
    result = await db.execute(
        select(User)
        .join(UserProfile, User.id == UserProfile.user_id)
        .where(UserProfile.company_id == current_user.profile.company_id)
        .options(selectinload(User.profile))
    )
    return result.scalars().all()

@router.post("/invite", response_model=UserSchema)
async def invite_user(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: UserInvite,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Invite a new user to the company and assign a valid role hierarchy.
    """
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not assigned to a company")
        
    if not has_permission(current_user.profile.role, "users", Permission.CREATE):
        raise HTTPException(status_code=403, detail="Not enough permissions to invite users")
        
    if not can_manage_role(current_user.profile.role, user_in.role):
        raise HTTPException(status_code=403, detail=f"You do not have clearance to assign the role: {user_in.role}")
        
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="The user with this email already exists.")
        
    # Create user with mostly inactive flags, waiting for magic link click
    user = User(
        email=user_in.email,
        password_hash=security.get_password_hash("UNUSABLE_PASSWORD_MAGIC_LINK"), # Unusable password until they set one
        first_name=user_in.first_name,
        last_name=user_in.last_name,
        is_active=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Needs to reset password on first login via magic link
    profile = UserProfile(
        user_id=user.id,
        role=user_in.role,
        company_id=current_user.profile.company_id,
        must_reset_password=True
    )
    db.add(profile)
    
    # Generate Magic Link Token
    token_obj = EmailVerificationToken(
        user_id=user.id,
        token_type=TokenType.invitation
    )
    db.add(token_obj)
    await db.commit()
    await db.refresh(token_obj)
    
    # Fetch company info for email
    from app.models.company import Company
    result = await db.execute(select(Company).where(Company.id == current_user.profile.company_id))
    company = result.scalars().first()
    
    # Send mock email
    await email_service.send_magic_link_email(
        email=user.email,
        token=token_obj,
        context={
            "name": user.first_name,
            "inviter_name": f"{current_user.first_name} {current_user.last_name}",
            "company_name": company.name if company else "Your Company"
        }
    )
    
    result = await db.execute(select(User).where(User.id == user.id).options(selectinload(User.profile)))
    return result.scalars().first()

@router.put("/me", response_model=UserSchema)
async def update_user_me(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: UserUpdate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Update own user profile.
    """
    if user_in.email != current_user.email:
        result = await db.execute(select(User).where(User.email == user_in.email))
        if result.scalars().first():
            raise HTTPException(status_code=400, detail="The user with this email already exists.")
        current_user.email = user_in.email
    
    current_user.first_name = user_in.first_name
    current_user.last_name = user_in.last_name
    
    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.put("/me/password", response_model=UserSchema)
async def update_user_password(
    password_in: PasswordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Update own password. Clears the must_reset_password flag.
    """
    current_user.password_hash = security.get_password_hash(password_in.password)
    
    # Needs to be explicitly fetched with profile to update relation correctly
    result = await db.execute(select(User).where(User.id == current_user.id).options(selectinload(User.profile)))
    user_with_profile = result.scalars().first()
    
    if user_with_profile.profile and user_with_profile.profile.must_reset_password:
        user_with_profile.profile.must_reset_password = False
        
    await db.commit()
    await db.refresh(user_with_profile)
    return user_with_profile

@router.put("/{user_id}/role", response_model=UserSchema)
async def update_user_role(
    user_id: int,
    role_in: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Change a user's role within the same company.
    """
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not assigned to a company")
        
    if not has_permission(current_user.profile.role, "users", Permission.UPDATE):
        raise HTTPException(status_code=403, detail="Not enough permissions to update users")
        
    if not can_manage_role(current_user.profile.role, role_in.role):
        raise HTTPException(status_code=403, detail=f"You do not have clearance to assign the role: {role_in.role}")
        
    result = await db.execute(select(User).where(User.id == user_id).options(selectinload(User.profile)))
    target_user = result.scalars().first()
    
    if not target_user or not target_user.profile or target_user.profile.company_id != current_user.profile.company_id:
        raise HTTPException(status_code=404, detail="User not found in your company")
        
    if not can_manage_role(current_user.profile.role, target_user.profile.role):
        raise HTTPException(status_code=403, detail="You cannot modify this user's role because they have equal or higher privileges")

    target_user.profile.role = role_in.role
    await db.commit()
    
    result = await db.execute(select(User).where(User.id == user_id).options(selectinload(User.profile)))
    return result.scalars().first()

@router.delete("/{user_id}", response_model=dict)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Remove a user from the system.
    """
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not assigned to a company")
        
    if not has_permission(current_user.profile.role, "users", Permission.DELETE):
        raise HTTPException(status_code=403, detail="Not enough permissions to delete users")
        
    result = await db.execute(select(User).where(User.id == user_id).options(selectinload(User.profile)))
    target_user = result.scalars().first()
    
    if not target_user or not target_user.profile or target_user.profile.company_id != current_user.profile.company_id:
        raise HTTPException(status_code=404, detail="User not found in your company")
        
    if not can_manage_role(current_user.profile.role, target_user.profile.role):
        raise HTTPException(status_code=403, detail="You cannot delete this user because they have equal or higher privileges")
        
    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete yourself.")
        
    await db.delete(target_user)
    await db.commit()
    return {"msg": "User successfully removed"}
