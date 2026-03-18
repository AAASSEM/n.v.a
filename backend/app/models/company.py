import datetime
from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB

from app.db.session import Base
import json
from sqlalchemy.types import TypeDecorator, VARCHAR

# Custom Type for JSON storage compatible with SQLite (for local dev)
class JSONEncodedDict(TypeDecorator):
    impl = VARCHAR
    def process_bind_param(self, value, dialect):
        if value is not None:
            value = json.dumps(value)
        return value
    def process_result_value(self, value, dialect):
        if value is not None:
            value = json.loads(value)
        return value

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    registration_number = Column(String(100), nullable=True)
    trade_license_number = Column(String(100), nullable=True)
    company_code = Column(String(10), unique=True, index=True, nullable=False)
    emirate = Column(String(50), nullable=False)
    sector = Column(String(50), nullable=False)
    active_frameworks = Column(JSONEncodedDict, default=list) # e.g. ["ESG", "DST"]
    has_green_key = Column(Boolean(), default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="companies_owned", foreign_keys=[owner_id])
    users = relationship("UserProfile", back_populates="company", cascade="all, delete-orphan")
    sites = relationship("Site", back_populates="company", cascade="all, delete-orphan")
    company_frameworks = relationship("CompanyFramework", back_populates="company", cascade="all, delete-orphan")

class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"))
    name = Column(String(255), nullable=False)
    location = Column(String(255), nullable=True)
    is_active = Column(Boolean(), default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="sites")
