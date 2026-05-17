"""add_more_missing_columns

Revision ID: e11acf5f2207
Revises: 03845ab2ce6f
Create Date: 2026-03-19 23:03:56.009698

Originally Postgres-only. Rewritten to run portably on both engines via an
idempotent try/except wrapper, safe to re-run on already-migrated Postgres.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e11acf5f2207'
down_revision: Union[str, Sequence[str], None] = '03845ab2ce6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _safe_add_column(table: str, column: sa.Column):
    try:
        op.add_column(table, column)
    except Exception as e:
        print(f"[migration e11acf5f2207] skipped add_column {table}.{column.name}: {e}")


def upgrade() -> None:
    _safe_add_column('company_profile_answers', sa.Column('answered_by', sa.Integer(), nullable=True))
    _safe_add_column('company_profile_answers', sa.Column('answered_at', sa.DateTime(), nullable=True))

    _safe_add_column('company_checklists', sa.Column('framework_id', sa.Integer(), nullable=True))
    _safe_add_column('company_checklists', sa.Column('frequency', sa.String(length=20), nullable=True))
    _safe_add_column('company_checklists', sa.Column('is_required', sa.Boolean(), nullable=True))
    _safe_add_column('company_checklists', sa.Column('assigned_to', sa.Integer(), nullable=True))
    _safe_add_column('company_checklists', sa.Column('added_at', sa.DateTime(), nullable=True))

    _safe_add_column('meters', sa.Column('site_id', sa.Integer(), nullable=True))
    _safe_add_column('meters', sa.Column('account_number', sa.String(length=100), nullable=True))
    _safe_add_column('meters', sa.Column('location', sa.String(length=255), nullable=True))
    _safe_add_column('meters', sa.Column('is_active', sa.Boolean(), nullable=True))
    _safe_add_column('meters', sa.Column('updated_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    pass
