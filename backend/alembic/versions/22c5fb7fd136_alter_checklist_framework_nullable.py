"""alter_checklist_framework_nullable

Revision ID: 22c5fb7fd136
Revises: e11acf5f2207
Create Date: 2026-03-19 23:21:55.064320

Originally Postgres-only. Extended to use ``op.batch_alter_table`` so the
NOT NULL drop also applies on SQLite (dev DBs).
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
    """Make company_checklists.framework_id nullable on both engines."""
    try:
        with op.batch_alter_table('company_checklists', schema=None) as batch_op:
            batch_op.alter_column(
                'framework_id',
                existing_type=sa.Integer(),
                nullable=True,
            )
    except Exception as e:
        print(f"[migration 22c5fb7fd136] skipped alter framework_id nullable: {e}")


def downgrade() -> None:
    pass
