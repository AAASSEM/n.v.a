"""Add EmailVerificationToken model

Revision ID: 515221d28dce
Revises: 1542fb8669b8
Create Date: 2026-03-11 17:10:51.567766

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '515221d28dce'
down_revision: Union[str, Sequence[str], None] = '1542fb8669b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()

    # Drop existing ENUM in postgres in case of failed partial migration
    if conn.dialect.name == 'postgresql':
        op.execute("DROP TYPE IF EXISTS tokentype CASCADE")

    # Check if table already exists (initial migration may have created it)
    table_exists = False
    try:
        if conn.dialect.name == 'sqlite':
            from sqlalchemy import inspect
            table_exists = 'email_verification_tokens' in inspect(conn).get_table_names()
        else:
            table_exists = conn.execute(sa.text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='email_verification_tokens'"
            )).fetchone() is not None
    except Exception:
        pass

    if not table_exists:
        op.create_table('email_verification_tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=36), nullable=False),
        sa.Column('token_type', sa.Enum('invitation', 'email_verification', name='tokentype'), nullable=False),
        sa.Column('verification_code', sa.String(length=10), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_email_verification_tokens_id'), 'email_verification_tokens', ['id'], unique=False)
        op.create_index(op.f('ix_email_verification_tokens_token'), 'email_verification_tokens', ['token'], unique=True)
    else:
        # Table exists, but make sure the enum type exists for PostgreSQL
        if conn.dialect.name == 'postgresql':
            try:
                op.execute("CREATE TYPE tokentype AS ENUM ('invitation', 'email_verification')")
            except Exception:
                pass


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_email_verification_tokens_token'), table_name='email_verification_tokens')
    op.drop_index(op.f('ix_email_verification_tokens_id'), table_name='email_verification_tokens')
    op.drop_table('email_verification_tokens')
