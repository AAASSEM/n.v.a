"""add_more_missing_columns

Revision ID: e11acf5f2207
Revises: 03845ab2ce6f
Create Date: 2026-03-19 23:03:56.009698

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e11acf5f2207'
down_revision: Union[str, Sequence[str], None] = '03845ab2ce6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    if bind.engine.name == 'postgresql':
        op.execute("ALTER TABLE company_profile_answers ADD COLUMN IF NOT EXISTS answered_by INTEGER")
        op.execute("ALTER TABLE company_profile_answers ADD COLUMN IF NOT EXISTS answered_at TIMESTAMP")
        op.execute("ALTER TABLE company_checklists ADD COLUMN IF NOT EXISTS framework_id INTEGER")
        op.execute("ALTER TABLE company_checklists ADD COLUMN IF NOT EXISTS frequency VARCHAR(20) DEFAULT 'Monthly'")
        op.execute("ALTER TABLE company_checklists ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT TRUE")
        op.execute("ALTER TABLE company_checklists ADD COLUMN IF NOT EXISTS assigned_to INTEGER")
        op.execute("ALTER TABLE company_checklists ADD COLUMN IF NOT EXISTS added_at TIMESTAMP")
        op.execute("ALTER TABLE meters ADD COLUMN IF NOT EXISTS site_id INTEGER")
        op.execute("ALTER TABLE meters ADD COLUMN IF NOT EXISTS account_number VARCHAR(100)")
        op.execute("ALTER TABLE meters ADD COLUMN IF NOT EXISTS location VARCHAR(255)")
        op.execute("ALTER TABLE meters ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE")
        op.execute("ALTER TABLE meters ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP")


def downgrade() -> None:
    """Downgrade schema."""
    pass
