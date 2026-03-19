"""alter_checklist_framework_nullable

Revision ID: 22c5fb7fd136
Revises: e11acf5f2207
Create Date: 2026-03-19 23:21:55.064320

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '22c5fb7fd136'
down_revision: Union[str, Sequence[str], None] = 'e11acf5f2207'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    if bind.engine.name == 'postgresql':
        op.execute("ALTER TABLE company_checklists ALTER COLUMN framework_id DROP NOT NULL")


def downgrade() -> None:
    """Downgrade schema."""
    pass
