"""add_more_missing_columns

Revision ID: e11acf5f2207
Revises: 03845ab2ce6f
Create Date: 2026-03-19 23:03:56.009698

Originally Postgres-only. Rewritten to run portably on both engines via an
idempotent table/column existence check, safe to re-run on already-migrated DBs.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e11acf5f2207'
down_revision: Union[str, Sequence[str], None] = '03845ab2ce6f'
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
            print(f"[migration e11acf5f2207] skipped {table}.{column}: {e}")

    add_if_missing('company_profile_answers', 'answered_by', sa.Integer())
    add_if_missing('company_profile_answers', 'answered_at', sa.DateTime())

    add_if_missing('company_checklists', 'framework_id', sa.Integer())
    add_if_missing('company_checklists', 'frequency', sa.String(length=20))
    add_if_missing('company_checklists', 'is_required', sa.Boolean())
    add_if_missing('company_checklists', 'assigned_to', sa.Integer())
    add_if_missing('company_checklists', 'added_at', sa.DateTime())

    add_if_missing('meters', 'site_id', sa.Integer())
    add_if_missing('meters', 'account_number', sa.String(length=100))
    add_if_missing('meters', 'location', sa.String(length=255))
    add_if_missing('meters', 'is_active', sa.Boolean())
    add_if_missing('meters', 'updated_at', sa.DateTime())


def downgrade() -> None:
    pass
