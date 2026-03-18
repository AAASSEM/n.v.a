import datetime
from sqlalchemy import Boolean, Column, Integer, String, DateTime, Text

from app.db.session import Base

class DataElement(Base):
    __tablename__ = "data_elements"

    id = Column(Integer, primary_key=True, index=True)
    element_code = Column(String(20), unique=True, index=True, nullable=False) # 'ELEC-001', 'WATER-001'
    name = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False) # 'Energy', 'Water', 'Waste', etc.
    description = Column(Text, nullable=True)
    unit = Column(String(50), nullable=True) # 'kWh', 'm³', 'tonnes'
    collection_frequency = Column(String(20), nullable=False) # 'Monthly', 'Quarterly', 'Annually'
    condition_logic = Column(Text, nullable=True) # E.g., 'Do you have swimming pools?'
    frameworks = Column(Text, nullable=True) # E.g., 'ESG, DST, Green Key'
    is_metered = Column(Boolean(), default=False)
    meter_type = Column(String(50), nullable=True) # Specific meter type if is_metered is true
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships are typically defined in the related tables (e.g., CompanyChecklists, Submissions)
