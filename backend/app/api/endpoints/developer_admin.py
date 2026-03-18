from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, desc

from app.api.deps import get_db, verify_developer_secret
from app.models.user import User, UserProfile
from app.models.company import Company
from app.models.data_element import DataElement
from app.models.profiling import ProfilingQuestion
from app.models.framework import Framework
from app.models.meter_type import MeterType
from app.models.system import SystemSetting, AuditLog
from app.services.platform_service import platform_service
from app.services.audit_service import audit_service
from app.core import security

from pydantic import BaseModel
import datetime

router = APIRouter()

# --- Schemas ---

class DataElementCreate(BaseModel):
    element_code: str
    name: str
    category: str
    description: Optional[str] = None
    unit: Optional[str] = None
    collection_frequency: str
    condition_logic: Optional[str] = None
    frameworks: Optional[str] = None
    is_metered: bool = False
    meter_type: Optional[str] = None

class DataElementUpdate(DataElementCreate):
    pass

class FrameworkCreate(BaseModel):
    framework_id: str
    name: str
    type: str # 'mandatory', 'voluntary', 'conditional'
    region: Optional[str] = "UAE"
    version: Optional[str] = "1.0"
    description: Optional[str] = None

class FrameworkUpdate(FrameworkCreate):
    pass

class ProfilingQuestionCreate(BaseModel):
    framework_id: Optional[int] = None
    question_text: str
    question_order: int
    input_type: Optional[str] = "boolean"
    is_required: Optional[bool] = True
    frameworks: Optional[str] = None

class ProfilingQuestionUpdate(ProfilingQuestionCreate):
    pass

class MeterTypeCreate(BaseModel):
    name: str
    unit: Optional[str] = "Unit"
    category: Optional[str] = "General"
    description: Optional[str] = None

class MeterTypeUpdate(MeterTypeCreate):
    pass

class SystemSettingUpdate(BaseModel):
    value: Any
    description: Optional[str] = None

# --- System Health & Diagnostics ---

@router.get("/diagnostics")
async def get_system_diagnostics(
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    """Return top-level system health metrics."""
    stats = await platform_service.get_platform_stats(db)
    return {
        "status": "healthy",
        **stats
    }

# --- System Settings ---

@router.get("/settings")
async def list_settings(
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    result = await db.execute(select(SystemSetting))
    return result.scalars().all()

@router.put("/settings/{key}")
async def update_setting(
    key: str,
    data: SystemSettingUpdate,
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    setting = await platform_service.set_system_setting(db, key, data.value, data.description)
    await audit_service.log_action(db, user_id=None, action="UPDATE_SETTING", entity_type="SYSTEM", entity_id=key, details={"value": data.value})
    return setting

# --- Audit Logs ---

@router.get("/logs")
async def list_audit_logs(
    limit: int = Query(50, le=500),
    offset: int = 0,
    action: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    query = select(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit).offset(offset)
    if action:
        query = query.where(AuditLog.action == action.upper())
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    total_result = await db.execute(select(func.count()).select_from(AuditLog))
    total = total_result.scalar()
    
    return {
        "logs": logs,
        "total": total,
        "limit": limit,
        "offset": offset
    }

# --- Platform Operations ---

@router.post("/impersonate/{user_id}")
async def impersonate_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    await audit_service.log_action(db, user_id=None, action="IMPERSONATE", entity_type="USER", entity_id=str(user_id))
    
    access_token_expires = datetime.timedelta(minutes=15)
    token = security.create_access_token(user.id, expires_delta=access_token_expires)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_email": user.email
    }

@router.post("/seed-demo")
async def seed_demo(
    name: str = "Demo Site Alpha",
    email: str = "demo.alpha@esg-compass.com",
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    await audit_service.log_action(db, user_id=None, action="SEED_DEMO", entity_type="SYSTEM", entity_id=name)
    return await platform_service.seed_demo_property(db, name, email)

@router.post("/seed-system-defaults")
async def seed_system_defaults(
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    """Populate Frameworks, MeterTypes, and ProfilingQuestions with initial required data."""
    # 1. Seed Core Frameworks
    fws = [
        {"framework_id": "DST", "name": "Department of Economy & Tourism", "type": "mandatory", "region": "Dubai", "version": "V1.0"},
        {"framework_id": "ESG", "name": "Global ESG Reporting Base", "type": "voluntary", "region": "Global", "version": "2024"},
        {"framework_id": "G-KEY", "name": "Green Key Certification", "type": "voluntary", "region": "Global", "version": "V6"}
    ]
    for f in fws:
        res = await db.execute(select(Framework).where(Framework.framework_id == f["framework_id"]))
        if not res.scalars().first():
            db.add(Framework(**f))

    # 2. Seed Meter Types
    mts = [
        {"name": "Electricity", "unit": "kWh", "category": "Energy", "description": "Electric power from grid"},
        {"name": "LPG / Gas", "unit": "kg", "category": "Energy", "description": "Cooking and heating gas"},
        {"name": "Potable Water", "unit": "m3", "category": "Water", "description": "Municipal water supply"},
        {"name": "Diesel", "unit": "Litres", "category": "Energy", "description": "Generator and transport fuel"}
    ]
    for m in mts:
        res = await db.execute(select(MeterType).where(MeterType.name == m["name"]))
        if not res.scalars().first():
            db.add(MeterType(**m))

    # 3. Seed Profiling Questions
    pqs = [
        {"question_text": "Do you have local water recycling?", "question_order": 1, "input_type": "boolean", "is_required": True, "frameworks": "DST,G-KEY"},
        {"question_text": "Is the property more than 100 rooms?", "question_order": 2, "input_type": "boolean", "is_required": True, "frameworks": "DST,ESG"},
        {"question_text": "Do you use a building BMS?", "question_order": 3, "input_type": "boolean", "is_required": False, "frameworks": "ESG"}
    ]
    for p in pqs:
        res = await db.execute(select(ProfilingQuestion).where(ProfilingQuestion.question_text == p["question_text"]))
        if not res.scalars().first():
            db.add(ProfilingQuestion(**p))

    await db.commit()
    return {"msg": "System defaults seeded successfully"}

# --- User & Company Management ---

@router.get("/companies")
async def list_companies(
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    result = await db.execute(select(Company))
    companies = result.scalars().all()
    return [{"id": c.id, "name": c.name, "created_at": c.created_at, "sector": c.sector, "emirate": c.emirate} for c in companies]

@router.delete("/companies/{company_id}")
async def delete_company(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalars().first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    await audit_service.log_action(db, user_id=None, action="DELETE_COMPANY", entity_type="COMPANY", entity_id=str(company_id), details={"name": company.name})
    await db.delete(company)
    await db.commit()
    return {"msg": "Company deleted successfully"}

@router.get("/users")
async def list_users(
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    result = await db.execute(select(User).options(selectinload(User.profile)))
    users = result.scalars().all()
    return [{
        "id": u.id, 
        "email": u.email, 
        "first_name": u.first_name,
        "last_name": u.last_name,
        "is_developer": getattr(u, 'is_developer', False),
        "is_active": u.is_active,
        "profile": {
            "role": u.profile.role,
            "company_id": u.profile.company_id
        } if u.profile else None
    } for u in users]

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    result = await db.execute(select(User).where(User.id == user_id))
    local_user = result.scalars().first()
    if not local_user:
        raise HTTPException(status_code=404, detail="User not found")
    if getattr(local_user, 'is_developer', False):
        raise HTTPException(status_code=400, detail="Cannot delete a developer account via this API")
    await audit_service.log_action(db, user_id=None, action="DELETE_USER", entity_type="USER", entity_id=str(user_id), details={"email": local_user.email})
    await db.delete(local_user)
    await db.commit()
    return {"msg": "User deleted successfully"}

# --- Data Elements Management (STAY THE SAME) ---

@router.get("/data-elements")
async def list_data_elements(
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    result = await db.execute(select(DataElement))
    elements = result.scalars().all()
    return [{
        "id": e.id,
        "element_code": e.element_code,
        "name": e.name,
        "category": e.category,
        "description": e.description,
        "unit": e.unit,
        "collection_frequency": e.collection_frequency,
        "condition_logic": e.condition_logic,
        "frameworks": e.frameworks,
        "is_metered": e.is_metered,
        "meter_type": e.meter_type,
        "created_at": e.created_at
    } for e in elements]

@router.post("/data-elements")
async def create_data_element(
    data: DataElementCreate,
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    new_el = DataElement(**data.dict())
    db.add(new_el)
    await db.commit()
    await db.refresh(new_el)
    await audit_service.log_action(db, user_id=None, action="CREATE_ELEMENT", entity_type="DATA_ELEMENT", entity_id=str(new_el.id))
    return new_el

@router.delete("/data-elements/{element_id}")
async def delete_data_element(
    element_id: int,
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    result = await db.execute(select(DataElement).where(DataElement.id == element_id))
    element = result.scalars().first()
    if not element:
        raise HTTPException(status_code=404, detail="Data Element not found")
    await audit_service.log_action(db, user_id=None, action="DELETE_ELEMENT", entity_type="DATA_ELEMENT", entity_id=str(element_id))
    await db.delete(element)
    await db.commit()
    return {"msg": "Data Element deleted successfully"}

# --- Frameworks Management (MATCH UI) ---

@router.get("/frameworks")
async def list_frameworks(
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    # Check for columns to avoid crash if migration is pending
    from sqlalchemy import text
    try:
        res = await db.execute(text("PRAGMA table_info(frameworks)"))
        cols = [r[1] for r in res.fetchall()]
        has_region = "region" in cols
        has_version = "version" in cols
        
        result = await db.execute(select(Framework))
        frameworks = result.scalars().all()
        return [{
            "id": f.id,
            "code": f.framework_id,
            "name": f.name,
            "type": f.type,
            "region": getattr(f, "region", "Global") if has_region else "Global",
            "version": getattr(f, "version", "1.0") if has_version else "1.0",
            "description": f.description
        } for f in frameworks]
    except Exception:
        # Extreme fallback
        result = await db.execute(select(Framework))
        frameworks = result.scalars().all()
        return [{"id": f.id, "code": f.framework_id, "name": f.name, "type": f.type} for f in frameworks]

@router.post("/frameworks")
async def create_framework(
    data: FrameworkCreate,
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    new_fw = Framework(**data.dict())
    db.add(new_fw)
    await db.commit()
    await db.refresh(new_fw)
    return new_fw

@router.delete("/frameworks/{fw_id}")
async def delete_framework(
    fw_id: int,
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    result = await db.execute(select(Framework).where(Framework.id == fw_id))
    fw = result.scalars().first()
    if not fw:
        raise HTTPException(status_code=404, detail="Framework not found")
    await db.delete(fw)
    await db.commit()
    return {"msg": "Framework deleted successfully"}

# --- Profiling Questions Management (MATCH UI) ---

@router.get("/profiling-questions")
async def list_profiling_questions(
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    from sqlalchemy import text
    res = await db.execute(text("PRAGMA table_info(profiling_questions)"))
    cols = [r[1] for r in res.fetchall()]
    has_input = "input_type" in cols
    
    result = await db.execute(select(ProfilingQuestion).order_by(ProfilingQuestion.question_order))
    questions = result.scalars().all()
    return [{
        "id": q.id,
        "question": q.question_text,
        "order": q.question_order,
        "input_type": getattr(q, "input_type", "boolean") if has_input else "boolean",
        "is_required": getattr(q, "is_required", True) if "is_required" in cols else True,
        "frameworks": q.frameworks
    } for q in questions]

@router.post("/profiling-questions")
async def create_profiling_question(
    data: ProfilingQuestionCreate,
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    new_pq = ProfilingQuestion(**data.dict())
    db.add(new_pq)
    await db.commit()
    await db.refresh(new_pq)
    return new_pq

@router.delete("/profiling-questions/{pq_id}")
async def delete_profiling_question(
    pq_id: int,
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    result = await db.execute(select(ProfilingQuestion).where(ProfilingQuestion.id == pq_id))
    pq = result.scalars().first()
    if not pq:
        raise HTTPException(status_code=404, detail="Profiling Question not found")
    await db.delete(pq)
    await db.commit()
    return {"msg": "Profiling Question deleted successfully"}

# --- Meter Types Management (MATCH UI) ---

@router.get("/meter-types")
async def list_meter_types(
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    from sqlalchemy import text
    res = await db.execute(text("PRAGMA table_info(meter_types)"))
    cols = [r[1] for r in res.fetchall()]
    
    result = await db.execute(select(MeterType))
    types = result.scalars().all()
    return [{
        "id": m.id,
        "name": m.name,
        "unit": getattr(m, "unit", "Units") if "unit" in cols else "Units",
        "category": getattr(m, "category", "General") if "category" in cols else "General",
        "description": m.description
    } for m in types]

@router.post("/meter-types")
async def create_meter_type(
    data: MeterTypeCreate,
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    new_mt = MeterType(**data.dict())
    db.add(new_mt)
    await db.commit()
    await db.refresh(new_mt)
    return new_mt

@router.delete("/meter-types/{mt_id}")
async def delete_meter_type(
    mt_id: int,
    db: AsyncSession = Depends(get_db),
    _secret: bool = Depends(verify_developer_secret),
) -> Any:
    result = await db.execute(select(MeterType).where(MeterType.id == mt_id))
    mt = result.scalars().first()
    if not mt:
        raise HTTPException(status_code=404, detail="Meter Type not found")
    await db.delete(mt)
    await db.commit()
    return {"msg": "Meter Type deleted successfully"}
