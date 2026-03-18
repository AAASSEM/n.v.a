import datetime
from sqlalchemy import Boolean, Numeric, Column, Integer, String, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models.company import JSONEncodedDict # Reusing the custom JSON type for local SQLite

class DataSubmission(Base):
    __tablename__ = "data_submissions"
    __table_args__ = (UniqueConstraint('company_id', 'data_element_id', 'meter_id', 'year', 'month', name='uq_submission'),)

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="SET NULL"), nullable=True)
    data_element_id = Column(Integer, ForeignKey("data_elements.id", ondelete="CASCADE"), nullable=False)
    meter_id = Column(Integer, ForeignKey("meters.id", ondelete="SET NULL"), nullable=True)
    
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False) # 1-12
    
    value = Column(Numeric(20, 4), nullable=True)
    unit = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    evidence_files = Column(JSONEncodedDict, default=list) # ['s3://bucket/path/to/file.pdf']
    
    submitted_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    submitted_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    company = relationship("Company")
    site = relationship("Site")
    data_element = relationship("DataElement")
    meter = relationship("Meter")
    user = relationship("User")


# (End of file)
