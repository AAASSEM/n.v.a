"""add_missing_columns

Revision ID: 03845ab2ce6f
Revises: de33973c150e
Create Date: 2026-03-19 22:42:30.153955

Originally Postgres-only — but the SQLAlchemy models depend on these columns
(e.g. ``profiling_questions.frameworks``), so SQLite dev DBs ended up broken.
Rewritten to run portably on both engines via an idempotent try/except wrapper,
safe to re-run on already-migrated Postgres.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '03845ab2ce6f'
down_revision: Union[str, Sequence[str], None] = 'de33973c150e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _safe_add_column(table: str, column: sa.Column):
    try:
        op.add_column(table, column)
    except Exception as e:
        print(f"[migration 03845ab2ce6f] skipped add_column {table}.{column.name}: {e}")


def upgrade() -> None:
    """Upgrade schema — portable across Postgres and SQLite."""
    _safe_add_column('profiling_questions', sa.Column('frameworks', sa.String(length=255), nullable=True))

    _safe_add_column('data_elements', sa.Column('condition_logic', sa.String(length=255), nullable=True))
    _safe_add_column('data_elements', sa.Column('unit', sa.String(length=50), nullable=True))
    _safe_add_column('data_elements', sa.Column('collection_frequency', sa.String(length=50), nullable=True))
    _safe_add_column('data_elements', sa.Column('frameworks', sa.String(length=255), nullable=True))
    _safe_add_column('data_elements', sa.Column('is_metered', sa.Boolean(), nullable=True))
    _safe_add_column('data_elements', sa.Column('meter_type', sa.String(length=100), nullable=True))

    _safe_add_column('audit_logs', sa.Column('details', sa.JSON(), nullable=True))

    _safe_add_column('companies', sa.Column('registration_number', sa.String(length=100), nullable=True))
    _safe_add_column('companies', sa.Column('trade_license_number', sa.String(length=100), nullable=True))
    _safe_add_column('companies', sa.Column('company_code', sa.String(length=50), nullable=True))
    _safe_add_column('companies', sa.Column('has_green_key', sa.Boolean(), nullable=True))


def downgrade() -> None:
    pass
