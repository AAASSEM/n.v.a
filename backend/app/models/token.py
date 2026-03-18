import datetime
import uuid
import random
import string
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship, backref
import enum

from app.db.session import Base

class TokenType(str, enum.Enum):
    invitation = "invitation"
    email_verification = "email_verification"

def generate_verification_code(length=6):
    """Generate a 6-digit backup verification code"""
    return ''.join(random.choices(string.digits, k=length))

class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(36), default=lambda: str(uuid.uuid4()), unique=True, index=True, nullable=False)
    token_type = Column(SQLEnum(TokenType), nullable=False)
    verification_code = Column(String(10), default=generate_verification_code, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    used_at = Column(DateTime, nullable=True)

    user = relationship("User", backref=backref("verification_tokens", cascade="all, delete-orphan"))
