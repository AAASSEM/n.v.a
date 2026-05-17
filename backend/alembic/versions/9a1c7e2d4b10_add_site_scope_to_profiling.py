"""add_site_scope_to_profiling_and_checklist

Revision ID: 9a1c7e2d4b10
Revises: 22c5fb7fd136
Create Date: 2026-04-17 00:00:00.000000

Adds site_id FK to company_profile_answers and company_checklists so that
onboarding answers and the derived checklist are scoped per-site, not just
per-company. Drops the old (company_id, question_id) / (company_id,
data_element_id) uniques and replaces them with (company_id, site_id, ...).

Uses ``op.batch_alter_table`` so the constraint swap works on both SQLite
(which needs copy-and-move for ALTER TABLE) and Postgres.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a1c7e2d4b10'
down_revision: Union[str, Sequence[str], None] = '22c5fb7fd136'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _safe(fn, *args, **kwargs):
    try:
        fn(*args, **kwargs)
    except Exception as e:
        print(f"[migration 9a1c7e2d4b10] skipped: {e}")


def upgrade() -> None:
    # --- company_profile_answers ---
    try:
        with op.batch_alter_table('company_profile_answers', schema=None) as batch_op:
            batch_op.add_column(sa.Column('site_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                'fk_profile_answers_site', 'sites',
                ['site_id'], ['id'], ondelete='CASCADE',
            )
            batch_op.create_index('ix_company_profile_answers_site_id', ['site_id'])
            # Replace old (company_id, question_id) unique
            try:
                batch_op.drop_constraint('uq_company_question', type_='unique')
            except Exception as e:
                print(f"[migration 9a1c7e2d4b10] drop uq_company_question skipped: {e}")
            batch_op.create_unique_constraint(
                'uq_company_site_question',
                ['company_id', 'site_id', 'question_id'],
            )
    except Exception as e:
        print(f"[migration 9a1c7e2d4b10] company_profile_answers batch failed: {e}")

    # --- data_submissions: widen the unique constraint to include site_id + meter_id ---
    try:
        with op.batch_alter_table('data_submissions', schema=None) as batch_op:
            try:
                batch_op.drop_constraint('uq_submission', type_='unique')
            except Exception as e:
                print(f"[migration 9a1c7e2d4b10] drop uq_submission skipped: {e}")
            batch_op.create_unique_constraint(
                'uq_submission',
                ['company_id', 'site_id', 'data_element_id', 'meter_id', 'year', 'month'],
            )
    except Exception as e:
        print(f"[migration 9a1c7e2d4b10] data_submissions batch failed: {e}")

    # --- company_checklists ---
    try:
        with op.batch_alter_table('company_checklists', schema=None) as batch_op:
            batch_op.add_column(sa.Column('site_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                'fk_company_checklists_site', 'sites',
                ['site_id'], ['id'], ondelete='CASCADE',
            )
            batch_op.create_index('ix_company_checklists_site_id', ['site_id'])
            try:
                batch_op.drop_constraint('uq_company_data_element', type_='unique')
            except Exception as e:
                print(f"[migration 9a1c7e2d4b10] drop uq_company_data_element skipped: {e}")
            batch_op.create_unique_constraint(
                'uq_company_site_data_element',
                ['company_id', 'site_id', 'data_element_id'],
            )
    except Exception as e:
        print(f"[migration 9a1c7e2d4b10] company_checklists batch failed: {e}")


def downgrade() -> None:
    try:
        with op.batch_alter_table('company_profile_answers', schema=None) as batch_op:
            batch_op.drop_constraint('uq_company_site_question', type_='unique')
            batch_op.create_unique_constraint('uq_company_question', ['company_id', 'question_id'])
            batch_op.drop_index('ix_company_profile_answers_site_id')
            batch_op.drop_constraint('fk_profile_answers_site', type_='foreignkey')
            batch_op.drop_column('site_id')
    except Exception:
        pass
    try:
        with op.batch_alter_table('company_checklists', schema=None) as batch_op:
            batch_op.drop_constraint('uq_company_site_data_element', type_='unique')
            batch_op.create_unique_constraint('uq_company_data_element', ['company_id', 'data_element_id'])
            batch_op.drop_index('ix_company_checklists_site_id')
            batch_op.drop_constraint('fk_company_checklists_site', type_='foreignkey')
            batch_op.drop_column('site_id')
    except Exception:
        pass
