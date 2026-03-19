"""update_admin_models_v3

Revision ID: 420c36d11686
Revises: bef3f7a45449
Create Date: 2026-03-17 19:29:12.895141

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import app.models.company

# revision identifiers, used by Alembic.
revision: str = '420c36d11686'
down_revision: Union[str, Sequence[str], None] = 'bef3f7a45449'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema — PostgreSQL compatible."""

    # ── audit_logs ──────────────────────────────────────────────────────
    op.alter_column('audit_logs', 'entity_type', nullable=True)
    op.alter_column('audit_logs', 'entity_id',
                    type_=sa.String(length=50),
                    nullable=True,
                    postgresql_using='entity_id::varchar')
    # Drop 'changes' column if it exists
    try:
        op.drop_column('audit_logs', 'changes')
    except Exception:
        pass

    # ── frameworks ──────────────────────────────────────────────────────
    op.add_column('frameworks', sa.Column('region', sa.String(length=50), nullable=True))
    op.add_column('frameworks', sa.Column('version', sa.String(length=20), nullable=True))
    op.alter_column('frameworks', 'framework_id',
                    type_=sa.String(length=20),
                    existing_type=sa.String(length=10),
                    existing_nullable=False)
    # Create unique index (skip if exists)
    try:
        op.create_index('ix_frameworks_framework_id', 'frameworks', ['framework_id'], unique=True)
    except Exception:
        pass

    # ── meter_types ─────────────────────────────────────────────────────
    op.add_column('meter_types', sa.Column('unit', sa.String(length=20), nullable=True))
    op.add_column('meter_types', sa.Column('category', sa.String(length=50), nullable=True))

    # ── profiling_questions ─────────────────────────────────────────────
    op.add_column('profiling_questions', sa.Column('input_type', sa.String(length=20), nullable=True))
    op.add_column('profiling_questions', sa.Column('is_required', sa.Boolean(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('profiling_questions', 'is_required')
    op.drop_column('profiling_questions', 'input_type')
    op.drop_column('meter_types', 'category')
    op.drop_column('meter_types', 'unit')
    op.drop_index('ix_frameworks_framework_id', table_name='frameworks')
    op.alter_column('frameworks', 'framework_id',
                    type_=sa.String(length=10),
                    existing_type=sa.String(length=20),
                    existing_nullable=False)
    op.drop_column('frameworks', 'version')
    op.drop_column('frameworks', 'region')
    op.add_column('audit_logs', sa.Column('changes', sa.VARCHAR(), nullable=True))
    op.alter_column('audit_logs', 'entity_id',
                    type_=sa.INTEGER(),
                    nullable=False)
    op.alter_column('audit_logs', 'entity_type', nullable=False)
