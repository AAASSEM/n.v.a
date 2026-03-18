import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text

from app.db.session import Base

class MeterType(Base):
    __tablename__ = "meter_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False) # e.g., 'Energy', 'Water', 'Waste'
    unit = Column(String(20), nullable=True) # kWh, m3, kg
    category = Column(String(50), nullable=True) # Direct, Indirect
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
