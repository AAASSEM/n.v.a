"""add_missing_columns

Revision ID: 03845ab2ce6f
Revises: de33973c150e
Create Date: 2026-03-19 22:42:30.153955

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '03845ab2ce6f'
down_revision: Union[str, Sequence[str], None] = 'de33973c150e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    if bind.engine.name == 'postgresql':
        op.execute("ALTER TABLE profiling_questions ADD COLUMN IF NOT EXISTS frameworks VARCHAR(255)")
        op.execute("ALTER TABLE data_elements ADD COLUMN IF NOT EXISTS condition_logic VARCHAR(255)")
        op.execute("ALTER TABLE data_elements ADD COLUMN IF NOT EXISTS unit VARCHAR(50)")
        op.execute("ALTER TABLE data_elements ADD COLUMN IF NOT EXISTS collection_frequency VARCHAR(50)")
        op.execute("ALTER TABLE data_elements ADD COLUMN IF NOT EXISTS frameworks VARCHAR(255)")
        op.execute("ALTER TABLE data_elements ADD COLUMN IF NOT EXISTS is_metered BOOLEAN")
        op.execute("ALTER TABLE data_elements ADD COLUMN IF NOT EXISTS meter_type VARCHAR(100)")
        op.execute("ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB")
        op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100)")
        op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS trade_license_number VARCHAR(100)")
        op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_code VARCHAR(50)")
        op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS has_green_key BOOLEAN")


def downgrade() -> None:
    """Downgrade schema."""
    pass
