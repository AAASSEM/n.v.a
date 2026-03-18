import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.db.session import Base

class GeneratedReport(Base):
    __tablename__ = "generated_reports"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    name = Column(String(255), nullable=False)
    year = Column(Integer, nullable=False)
    category = Column(String(50), nullable=True) # e.g. 'Environmental', 'Full ESG'
    format = Column(String(10), nullable=False) # 'PDF', 'XLSX'
    size = Column(String(20), nullable=True) # '2.4 MB'
    status = Column(String(20), default="Completed") # 'Processing', 'Completed', 'Failed'
    
    download_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    company = relationship("Company")
    user = relationship("User")
