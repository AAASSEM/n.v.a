"""Add password_reset and login to tokentype enum

Revision ID: a89fa218f4b5
Revises: 3429fa218f4a
Create Date: 2026-05-30 00:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a89fa218f4b5'
down_revision: Union[str, Sequence[str], None] = '3429fa218f4a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if database is postgresql
    bind = op.get_bind()
    if bind.engine.name == 'postgresql':
        with op.get_context().autocommit_block():
            try:
                op.execute("ALTER TYPE tokentype ADD VALUE 'password_reset'")
            except Exception as e:
                print(f"Skipped adding 'password_reset' to tokentype enum: {e}")
            
            try:
                op.execute("ALTER TYPE tokentype ADD VALUE 'login'")
            except Exception as e:
                print(f"Skipped adding 'login' to tokentype enum: {e}")


def downgrade() -> None:
    pass
