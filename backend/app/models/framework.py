import datetime
from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.db.session import Base

class Framework(Base):
    __tablename__ = "frameworks"

    id = Column(Integer, primary_key=True, index=True)
    framework_id = Column(String(20), unique=True, index=True, nullable=False) # e.g. 'ESG', 'DST', 'GREEN_KEY'
    name = Column(String(255), nullable=False)
    type = Column(String(20), nullable=False) # 'mandatory', 'voluntary', 'conditional'
    region = Column(String(50), nullable=True) # UAE, Region, Global
    version = Column(String(20), nullable=True) # 2.0.1, V1
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    company_frameworks = relationship("CompanyFramework", back_populates="framework", cascade="all, delete-orphan")

class CompanyFramework(Base):
    __tablename__ = "company_frameworks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    framework_id = Column(Integer, ForeignKey("frameworks.id", ondelete="CASCADE"), nullable=False)
    is_auto_assigned = Column(Boolean(), default=False)
    assigned_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="company_frameworks")
    framework = relationship("Framework", back_populates="company_frameworks")
