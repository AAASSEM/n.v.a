"""add site sector

Revision ID: 3429fa218f4a
Revises: 9a1c7e2d4b10
Create Date: 2026-05-17 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '3429fa218f4a'
down_revision: Union[str, Sequence[str], None] = '9a1c7e2d4b10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Check table and column existence before altering
    table_exists = False
    column_exists = False
    try:
        if conn.dialect.name == 'sqlite':
            from sqlalchemy import inspect
            inspector = inspect(conn)
            table_exists = 'sites' in inspector.get_table_names()
            if table_exists:
                column_exists = 'sector' in [c['name'] for c in inspector.get_columns('sites')]
        else:
            table_exists = conn.execute(sa.text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='sites'"
            )).fetchone() is not None
            if table_exists:
                column_exists = conn.execute(sa.text(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_schema='public' AND table_name='sites' AND column_name='sector'"
                )).fetchone() is not None
    except Exception as e:
        print(f"[migration 3429fa218f4a] introspection error: {e}")

    if table_exists and not column_exists:
        try:
            with op.batch_alter_table('sites', schema=None) as batch_op:
                batch_op.add_column(sa.Column('sector', sa.String(length=50), nullable=True, server_default='hospitality'))
        except Exception as e:
            print(f"[migration 3429fa218f4a] sites batch failed: {e}")


def downgrade() -> None:
    try:
        with op.batch_alter_table('sites', schema=None) as batch_op:
            batch_op.drop_column('sector')
    except Exception as e:
        print(f"[migration 3429fa218f4a] downgrade failed: {e}")
