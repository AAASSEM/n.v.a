"""Add is_developer to User

Revision ID: 76bc9d219f67
Revises: 841fd7e5933b
Create Date: 2026-03-05 22:49:44.343626

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '76bc9d219f67'
down_revision: Union[str, Sequence[str], None] = '841fd7e5933b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()

    col_exists = False
    try:
        if conn.dialect.name == 'sqlite':
            from sqlalchemy import inspect
            col_exists = 'is_developer' in [c['name'] for c in inspect(conn).get_columns('users')]
        else:
            col_exists = conn.execute(sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='users' AND column_name='is_developer'"
            )).fetchone() is not None
    except Exception:
        pass

    if not col_exists:
        op.add_column('users', sa.Column('is_developer', sa.Boolean(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'is_developer')
