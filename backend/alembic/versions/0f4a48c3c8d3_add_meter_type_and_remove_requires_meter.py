"""Add meter_type and remove requires_meter

Revision ID: 0f4a48c3c8d3
Revises: 76bc9d219f67
Create Date: 2026-03-06 15:26:59.927234

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0f4a48c3c8d3'
down_revision: Union[str, Sequence[str], None] = '76bc9d219f67'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()

    # Check if 'requires_meter' column exists before trying to drop it
    col_exists = False
    try:
        if conn.dialect.name == 'sqlite':
            from sqlalchemy import inspect
            cols = [c['name'] for c in inspect(conn).get_columns('profiling_questions')]
            col_exists = 'requires_meter' in cols
        else:
            col_exists = conn.execute(sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='profiling_questions' AND column_name='requires_meter'"
            )).fetchone() is not None
    except Exception:
        pass

    if col_exists:
        with op.batch_alter_table('profiling_questions', schema=None) as batch_op:
            batch_op.drop_column('requires_meter')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('profiling_questions', sa.Column('requires_meter', sa.BOOLEAN(), nullable=True))
    op.drop_column('data_elements', 'meter_type')
