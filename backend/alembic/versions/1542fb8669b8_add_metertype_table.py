"""Add MeterType table

Revision ID: 1542fb8669b8
Revises: 0f4a48c3c8d3
Create Date: 2026-03-06 15:41:11.616957

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1542fb8669b8'
down_revision: Union[str, Sequence[str], None] = '0f4a48c3c8d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()

    # Check if table already exists
    table_exists = False
    try:
        if conn.dialect.name == 'sqlite':
            from sqlalchemy import inspect
            table_exists = 'meter_types' in inspect(conn).get_table_names()
        else:
            table_exists = conn.execute(sa.text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='meter_types'"
            )).fetchone() is not None
    except Exception:
        pass

    if not table_exists:
        op.create_table('meter_types',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_meter_types_id'), 'meter_types', ['id'], unique=False)
        op.create_index(op.f('ix_meter_types_name'), 'meter_types', ['name'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_meter_types_name'), table_name='meter_types')
    op.drop_index(op.f('ix_meter_types_id'), table_name='meter_types')
    op.drop_table('meter_types')
