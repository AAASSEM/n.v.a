import datetime
from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.session import Base

class CompanyChecklist(Base):
    __tablename__ = "company_checklists"
    __table_args__ = (UniqueConstraint('company_id', 'data_element_id', name='uq_company_data_element'),)

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    data_element_id = Column(Integer, ForeignKey("data_elements.id", ondelete="CASCADE"), nullable=False)
    framework_id = Column(Integer, ForeignKey("frameworks.id", ondelete="CASCADE"), nullable=True)
    frequency = Column(String(20), nullable=False) # 'Monthly', 'Quarterly', 'Annually'
    is_required = Column(Boolean(), default=True)
    assigned_to = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    added_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    company = relationship("Company")
    data_element = relationship("DataElement")
    framework = relationship("Framework")
    user = relationship("User", foreign_keys=[assigned_to])
