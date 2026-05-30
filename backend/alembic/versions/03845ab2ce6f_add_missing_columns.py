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


def upgrade() -> None:
    conn = op.get_bind()

    def add_if_missing(table, column, col_type):
        try:
            if conn.dialect.name == 'sqlite':
                from sqlalchemy import inspect
                inspector = inspect(conn)
                if table in inspector.get_table_names():
                    columns = [c['name'] for c in inspector.get_columns(table)]
                    if column not in columns:
                        op.add_column(table, sa.Column(column, col_type))
            else:
                table_exists = conn.execute(sa.text(
                    f"SELECT 1 FROM information_schema.tables "
                    f"WHERE table_schema='public' AND table_name='{table}'"
                )).fetchone()
                if table_exists:
                    exists = conn.execute(sa.text(
                        f"SELECT 1 FROM information_schema.columns "
                        f"WHERE table_schema='public' AND table_name='{table}' AND column_name='{column}'"
                    )).fetchone()
                    if not exists:
                        op.add_column(table, sa.Column(column, col_type))
        except Exception as e:
            print(f"[migration] skipped {table}.{column}: {e}")

    add_if_missing('profiling_questions', 'frameworks', sa.String(255))
    add_if_missing('data_elements', 'condition_logic', sa.String(255))
    add_if_missing('data_elements', 'unit', sa.String(50))
    add_if_missing('data_elements', 'collection_frequency', sa.String(50))
    add_if_missing('data_elements', 'frameworks', sa.String(255))
    add_if_missing('data_elements', 'is_metered', sa.Boolean())
    add_if_missing('data_elements', 'meter_type', sa.String(100))
    add_if_missing('audit_logs', 'details', sa.JSON())
    add_if_missing('companies', 'registration_number', sa.String(100))
    add_if_missing('companies', 'trade_license_number', sa.String(100))
    add_if_missing('companies', 'company_code', sa.String(50))
    add_if_missing('companies', 'has_green_key', sa.Boolean())


def downgrade() -> None:
    pass
