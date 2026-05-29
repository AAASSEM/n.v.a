from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query, Request
from app.services.audit_service import audit_service
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core import security
from app.core.permissions import Role, Permission, has_permission, can_manage_role
from app.api.deps import get_db, get_current_active_user, resolve_site_id
from app.models.user import User, UserProfile
from app.schemas.user import User as UserSchema, UserCreate, UserUpdate
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from app.models.checklist import CompanyChecklist
from app.models.submission import DataSubmission
from app.models.meter import Meter

from app.services.email_service import email_service
from app.models.token import EmailVerificationToken, TokenType

class UserInvite(BaseModel):
    email: str
    first_name: str
    last_name: str
    role: str
    site_id: int | None = None

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
    site_id: int | None = None,
) -> Any:
    """
    Retrieve users belonging to the current user's company.

    Scoping:
    - Site-pinned callers: only their site's users + company-wide admins.
    - Company-wide caller (admin) with ?site_id=: only that site + admins.
    - Company-wide caller without ?site_id=: all users in the company.
    """
    if not current_user.profile or not current_user.profile.company_id:
        return [current_user]

    pinned = current_user.profile.site_id
    effective_site = pinned if pinned is not None else site_id

    stmt = (
        select(User)
        .join(UserProfile, User.id == UserProfile.user_id)
        .where(UserProfile.company_id == current_user.profile.company_id)
        .options(selectinload(User.profile))
    )

    if effective_site is not None:
        # Users pinned to this site, plus company-wide admins (site_id IS NULL)
        from sqlalchemy import or_
        stmt = stmt.where(
            or_(UserProfile.site_id == effective_site, UserProfile.site_id.is_(None))
        )

    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/invite", response_model=UserSchema)
async def invite_user(
    *,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_in: UserInvite,
    background_tasks: BackgroundTasks,
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
    
    # Determine target site_id for the invitee.
    # - Company-wide admins (ADMIN/SUPER_USER) can pass site_id (or None for company-wide role).
    # - Site-pinned inviters (e.g. SITE_MANAGER) force their own site_id onto invitees.
    from app.core.permissions import Role
    admin_roles = {Role.ADMIN.value, Role.SUPER_USER.value}
    target_site_id: int | None
    if current_user.profile.site_id is not None:
        # Site-pinned inviter — ignore request and use their site
        target_site_id = current_user.profile.site_id
    else:
        # Company-wide inviter
        if user_in.role in admin_roles:
            # Creating another company-wide admin — no site
            target_site_id = None
        else:
            if user_in.site_id is None:
                raise HTTPException(
                    status_code=400,
                    detail="site_id is required when inviting a non-admin user",
                )
            # Verify site belongs to inviter's company
            from app.models.company import Site
            target_site = await db.get(Site, user_in.site_id)
            if not target_site or target_site.company_id != current_user.profile.company_id:
                raise HTTPException(status_code=404, detail="Site not found")
            target_site_id = target_site.id

    # Needs to reset password on first login via magic link
    profile = UserProfile(
        user_id=user.id,
        role=user_in.role,
        company_id=current_user.profile.company_id,
        site_id=target_site_id,
        must_reset_password=False
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
    
    # Send email via background task
    background_tasks.add_task(
        email_service.send_magic_link_email,
        email=user.email,
        token=token_obj,
        context={
            "name": user.first_name,
            "inviter_name": f"{current_user.first_name} {current_user.last_name}",
            "company_name": company.name if company else "Your Company"
        }
    )
    
    await audit_service.log_action(
        db,
        action="INVITE_USER",
        user_id=current_user.id,
        company_id=current_user.profile.company_id,
        entity_type="USER",
        entity_id=str(user.id),
        details={"email": user.email, "role": user_in.role, "site_id": target_site_id},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
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



@router.put("/{user_id}/role", response_model=UserSchema)
async def update_user_role(
    user_id: int,
    role_in: RoleUpdate,
    request: Request,
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

    old_role = target_user.profile.role
    target_user.profile.role = role_in.role
    await db.commit()
    
    await audit_service.log_action(
        db,
        action="UPDATE_ROLE",
        user_id=current_user.id,
        company_id=current_user.profile.company_id,
        entity_type="USER",
        entity_id=str(target_user.id),
        details={"email": target_user.email, "old_role": old_role, "new_role": role_in.role},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    result = await db.execute(select(User).where(User.id == user_id).options(selectinload(User.profile)))
    return result.scalars().first()

@router.delete("/{user_id}", response_model=dict)
async def delete_user(
    user_id: int,
    request: Request,
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
        
    email = target_user.email
    await db.delete(target_user)
    await db.commit()
    
    await audit_service.log_action(
        db,
        action="DELETE_USER",
        user_id=current_user.id,
        company_id=current_user.profile.company_id,
        entity_type="USER",
        entity_id=str(user_id),
        details={"email": email},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return {"msg": "User successfully removed"}


@router.get("/{user_id}/activity", response_model=dict)
async def get_user_activity(
    user_id: int,
    year: int = Query(...),
    month: int = Query(...),
    scope: str = Query("month"),  # "month" or "year"
    site_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Retrieve user activity / task completion statistics and status.
    Supports scoping by 'month' (specific month/year) or 'year' (entire year).
    """
    if not current_user.profile or not current_user.profile.company_id:
        raise HTTPException(status_code=403, detail="Not assigned to a company")

    if not has_permission(current_user.profile.role, "users", Permission.READ):
        raise HTTPException(status_code=403, detail="Not enough permissions to view user activity")

    # Verify target user is in the same company
    result = await db.execute(
        select(User)
        .join(UserProfile, User.id == UserProfile.user_id)
        .where(User.id == user_id, UserProfile.company_id == current_user.profile.company_id)
        .options(selectinload(User.profile))
    )
    target_user = result.scalars().first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found in your company")

    effective_site_id = await resolve_site_id(current_user, site_id, db, required=True)

    # Fetch checklist items assigned to the target user at this site
    stmt_checklist = (
        select(CompanyChecklist)
        .options(selectinload(CompanyChecklist.data_element))
        .where(
            CompanyChecklist.company_id == current_user.profile.company_id,
            CompanyChecklist.site_id == effective_site_id,
            CompanyChecklist.assigned_to == user_id,
        )
    )
    checklist_records = (await db.execute(stmt_checklist)).scalars().all()

    # Fetch active meters for the site
    stmt_meters = select(Meter).where(
        Meter.company_id == current_user.profile.company_id,
        Meter.site_id == effective_site_id,
        Meter.is_active == True
    )
    meters_records = (await db.execute(stmt_meters)).scalars().all()

    # Group meters by data_element_id
    meters_by_element = {}
    for m in meters_records:
        if m.data_element_id not in meters_by_element:
            meters_by_element[m.data_element_id] = []
        meters_by_element[m.data_element_id].append(m)

    # Fetch submissions for this site, company, and year
    submission_filter = [
        DataSubmission.company_id == current_user.profile.company_id,
        DataSubmission.site_id == effective_site_id,
        DataSubmission.year == year,
    ]
    if scope == "month":
        submission_filter.append(DataSubmission.month.in_([month, 12]))

    stmt_subs = (
        select(DataSubmission)
        .options(selectinload(DataSubmission.user))
        .where(*submission_filter)
    )
    subs_records = (await db.execute(stmt_subs)).scalars().all()

    # Build index of submissions: (data_element_id, meter_id, month) -> submission
    subs_by_key = {}
    for s in subs_records:
        subs_by_key[(s.data_element_id, s.meter_id, s.month)] = s

    # Construct response tasks
    tasks = []
    total_tasks = 0
    completed_tasks = 0
    pending_tasks = 0
    partial_tasks = 0

    for item in checklist_records:
        element = item.data_element
        if not element:
            continue

        freq = element.collection_frequency.lower()
        is_persistent = freq not in ["monthly", "daily"]

        element_meters = meters_by_element.get(element.id, [])

        # If element is metered and has active meters, track completion for each meter separately.
        # Otherwise, track for the element itself.
        sub_items = []
        if element_meters and element.is_metered:
            for m in element_meters:
                sub_items.append({"meter_id": m.id, "name": f"{element.name} - {m.name}", "is_meter": True})
        else:
            sub_items.append({"meter_id": None, "name": element.name, "is_meter": False})

        for sub_item in sub_items:
            total_tasks += 1
            m_id = sub_item["meter_id"]
            task_name = sub_item["name"]
            is_m = sub_item["is_meter"]

            if scope == "month":
                target_month = 12 if is_persistent else month
                sub = subs_by_key.get((element.id, m_id, target_month))

                status = "pending"
                latest_sub = None
                if sub and sub.value is not None:
                    status = "complete"
                    latest_sub = {
                        "year": sub.year,
                        "month": sub.month,
                        "value": float(sub.value),
                        "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
                        "submitted_by": f"{sub.user.first_name} {sub.user.last_name}" if sub.user else None,
                        "notes": sub.notes
                    }

                if status == "complete":
                    completed_tasks += 1
                else:
                    pending_tasks += 1

                tasks.append({
                    "name": task_name,
                    "category": element.category,
                    "frequency": element.collection_frequency,
                    "is_meter": is_m,
                    "status": status,
                    "details": f"Month {month}" if not is_persistent else "Annual",
                    "latest_submission": latest_sub
                })
            else:
                # scope == "year"
                if is_persistent:
                    sub = subs_by_key.get((element.id, m_id, 12))
                    status = "complete" if (sub and sub.value is not None) else "pending"
                    latest_sub = None
                    if sub and sub.value is not None:
                        latest_sub = {
                            "year": sub.year,
                            "month": sub.month,
                            "value": float(sub.value),
                            "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
                            "submitted_by": f"{sub.user.first_name} {sub.user.last_name}" if sub.user else None,
                            "notes": sub.notes
                        }

                    if status == "complete":
                        completed_tasks += 1
                    else:
                        pending_tasks += 1

                    tasks.append({
                        "name": task_name,
                        "category": element.category,
                        "frequency": element.collection_frequency,
                        "is_meter": is_m,
                        "status": status,
                        "details": "Annual",
                        "latest_submission": latest_sub
                    })
                else:
                    completed_months = []
                    latest_sub = None
                    for m in range(1, 13):
                        sub = subs_by_key.get((element.id, m_id, m))
                        if sub and sub.value is not None:
                            completed_months.append(m)
                            if not latest_sub or (sub.year > latest_sub["year"] or (sub.year == latest_sub["year"] and sub.month > latest_sub["month"])):
                                latest_sub = {
                                    "year": sub.year,
                                    "month": sub.month,
                                    "value": float(sub.value),
                                    "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
                                    "submitted_by": f"{sub.user.first_name} {sub.user.last_name}" if sub.user else None,
                                    "notes": sub.notes
                                }

                    num_completed = len(completed_months)
                    if num_completed == 12:
                        status = "complete"
                        completed_tasks += 1
                    elif num_completed > 0:
                        status = "partial"
                        partial_tasks += 1
                    else:
                        status = "pending"
                        pending_tasks += 1

                    tasks.append({
                        "name": task_name,
                        "category": element.category,
                        "frequency": element.collection_frequency,
                        "is_meter": is_m,
                        "status": status,
                        "details": f"{num_completed}/12 months completed",
                        "latest_submission": latest_sub
                    })

    completion_rate = int((completed_tasks + 0.5 * partial_tasks) / total_tasks * 100) if total_tasks > 0 else 100

    return {
        "user_id": user_id,
        "user_name": f"{target_user.first_name} {target_user.last_name}",
        "summary": {
            "total_assigned": total_tasks,
            "completed": completed_tasks,
            "partial": partial_tasks,
            "pending": pending_tasks,
            "completion_rate": completion_rate
        },
        "tasks": tasks
    }
