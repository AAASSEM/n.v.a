from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class SiteBase(BaseModel):
    name: str
    location: Optional[str] = None
    sector: Optional[str] = "hospitality"
    is_active: Optional[bool] = True


class SiteCreate(SiteBase):
    pass


class SiteUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    sector: Optional[str] = None
    is_active: Optional[bool] = None


class Site(SiteBase):
    id: int
    company_id: int
    created_at: datetime

    class Config:
        from_attributes = True
