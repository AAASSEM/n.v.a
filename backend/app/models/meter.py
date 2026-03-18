import datetime
from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.db.session import Base

class Meter(Base):
    __tablename__ = "meters"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="SET NULL"), nullable=True)
    data_element_id = Column(Integer, ForeignKey("data_elements.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False) # 'Main Electricity Meter'
    meter_type = Column(String(50), nullable=False) # 'Electricity', 'Water', 'Fuel'
    account_number = Column(String(100), nullable=True)
    location = Column(String(255), nullable=True)
    is_active = Column(Boolean(), default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    company = relationship("Company")
    site = relationship("Site")
    data_element = relationship("DataElement")
