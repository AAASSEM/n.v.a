from typing import Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.system import AuditLog

class AuditService:
    @staticmethod
    async def log_action(
        db: AsyncSession,
        action: str,
        user_id: Optional[int] = None,
        company_id: Optional[int] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        details: Optional[Any] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuditLog:
        """Centralized logging utility for platform-wide actions."""
        log = AuditLog(
            user_id=user_id,
            company_id=company_id,
            action=action.upper(),
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id else None,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)
        return log

audit_service = AuditService()
