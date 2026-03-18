import datetime
from sqlalchemy import Boolean, Column, Integer, Text, DateTime, ForeignKey, UniqueConstraint, String
from sqlalchemy.orm import relationship

from app.db.session import Base

class ProfilingQuestion(Base):
    __tablename__ = "profiling_questions"

    id = Column(Integer, primary_key=True, index=True)
    framework_id = Column(Integer, ForeignKey("frameworks.id", ondelete="CASCADE"), nullable=True) # Optional link to specific framework
    question_text = Column(Text, nullable=False)
    question_order = Column(Integer, nullable=False)
    input_type = Column(String(20), default="boolean") # boolean, text, select
    is_required = Column(Boolean(), default=True)
    frameworks = Column(Text, nullable=True) # Comma separated list of frameworks e.g., 'ESG,DST,Green Key'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    framework = relationship("Framework")
    answers = relationship("CompanyProfileAnswer", back_populates="question", cascade="all, delete-orphan")


class CompanyProfileAnswer(Base):
    __tablename__ = "company_profile_answers"
    __table_args__ = (UniqueConstraint('company_id', 'question_id', name='uq_company_question'),)

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(Integer, ForeignKey("profiling_questions.id", ondelete="CASCADE"), nullable=False)
    answer = Column(Boolean(), nullable=False) # Yes/No mapped to True/False
    answered_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    answered_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    company = relationship("Company")
    question = relationship("ProfilingQuestion", back_populates="answers")
    user = relationship("User")
