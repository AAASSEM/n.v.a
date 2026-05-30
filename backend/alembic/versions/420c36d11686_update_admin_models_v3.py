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


def _table_exists(conn, table):
    try:
        if conn.dialect.name == 'sqlite':
            from sqlalchemy import inspect
            return table in inspect(conn).get_table_names()
        else:
            return conn.execute(sa.text(
                f"SELECT 1 FROM information_schema.tables "
                f"WHERE table_schema='public' AND table_name='{table}'"
            )).fetchone() is not None
    except Exception:
        return False


def _column_exists(conn, table, column):
    try:
        if conn.dialect.name == 'sqlite':
            from sqlalchemy import inspect
            return column in [c['name'] for c in inspect(conn).get_columns(table)]
        else:
            return conn.execute(sa.text(
                f"SELECT 1 FROM information_schema.columns "
                f"WHERE table_schema='public' AND table_name='{table}' AND column_name='{column}'"
            )).fetchone() is not None
    except Exception:
        return False


def _get_column_type(conn, table, column):
    """Returns the PostgreSQL data_type string, or None."""
    try:
        if conn.dialect.name != 'postgresql':
            return None
        row = conn.execute(sa.text(
            f"SELECT data_type FROM information_schema.columns "
            f"WHERE table_schema='public' AND table_name='{table}' AND column_name='{column}'"
        )).fetchone()
        return row[0] if row else None
    except Exception:
        return None


def upgrade() -> None:
    """Upgrade schema — portable across Postgres and SQLite."""
    conn = op.get_bind()

    # --- audit_logs: entity_id Integer → String(50), nullable ---
    if _table_exists(conn, 'audit_logs'):
        col_type = _get_column_type(conn, 'audit_logs', 'entity_id')
        if col_type and col_type == 'integer':
            try:
                op.alter_column('audit_logs', 'entity_id',
                                type_=sa.String(50),
                                existing_type=sa.Integer(),
                                nullable=True,
                                postgresql_using='entity_id::varchar')
            except Exception as e:
                print(f"[migration 420c36d11686] skipped alter entity_id: {e}")

        # Also make entity_type nullable
        try:
            op.alter_column('audit_logs', 'entity_type',
                            nullable=True,
                            existing_type=sa.String(50))
        except Exception as e:
            print(f"[migration 420c36d11686] skipped alter entity_type nullable: {e}")

        # Drop old 'changes' column if it exists
        if _column_exists(conn, 'audit_logs', 'changes'):
            try:
                op.drop_column('audit_logs', 'changes')
            except Exception as e:
                print(f"[migration 420c36d11686] skipped drop changes: {e}")

    # --- frameworks: add region and version columns ---
    if _table_exists(conn, 'frameworks'):
        if not _column_exists(conn, 'frameworks', 'region'):
            try:
                op.add_column('frameworks', sa.Column('region', sa.String(length=50), nullable=True))
            except Exception as e:
                print(f"[migration 420c36d11686] skipped add region: {e}")

        if not _column_exists(conn, 'frameworks', 'version'):
            try:
                op.add_column('frameworks', sa.Column('version', sa.String(length=20), nullable=True))
            except Exception as e:
                print(f"[migration 420c36d11686] skipped add version: {e}")

        try:
            op.create_index('ix_frameworks_framework_id', 'frameworks', ['framework_id'], unique=True)
        except Exception as e:
            print(f"[migration 420c36d11686] skipped create index: {e}")

    # --- meter_types: add unit and category columns ---
    if _table_exists(conn, 'meter_types'):
        if not _column_exists(conn, 'meter_types', 'unit'):
            try:
                op.add_column('meter_types', sa.Column('unit', sa.String(length=20), nullable=True))
            except Exception as e:
                print(f"[migration 420c36d11686] skipped add unit: {e}")

        if not _column_exists(conn, 'meter_types', 'category'):
            try:
                op.add_column('meter_types', sa.Column('category', sa.String(length=50), nullable=True))
            except Exception as e:
                print(f"[migration 420c36d11686] skipped add category: {e}")

    # --- profiling_questions: add input_type and is_required ---
    if _table_exists(conn, 'profiling_questions'):
        if not _column_exists(conn, 'profiling_questions', 'input_type'):
            try:
                op.add_column('profiling_questions', sa.Column('input_type', sa.String(length=20), nullable=True))
            except Exception as e:
                print(f"[migration 420c36d11686] skipped add input_type: {e}")

        if not _column_exists(conn, 'profiling_questions', 'is_required'):
            try:
                op.add_column('profiling_questions', sa.Column('is_required', sa.Boolean(), nullable=True))
            except Exception as e:
                print(f"[migration 420c36d11686] skipped add is_required: {e}")


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
