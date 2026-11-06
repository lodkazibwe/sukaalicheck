"""sukaalicheck_v2_model

Revision ID: a3c91e7d2b54
Revises: def8b82d6b5a
Create Date: 2026-11-06 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3c91e7d2b54'
down_revision: Union[str, Sequence[str], None] = 'def8b82d6b5a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    return column in {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    """Upgrade schema.

    The v2 model no longer uses physical activity or diet quality, so they become
    optional data-only fields. ``model_version`` records which model produced each
    result; existing rows are backfilled as "v1". The "v1" server default stays so
    the old backend, still running while the deploy migrates, can keep inserting.
    ``blood_glucose_entered`` / ``blood_glucose_unit`` keep the reading as the health
    worker typed it (mg/dL or mmol/L); ``blood_glucose`` stays the mg/dL model input.

    Idempotent: the app runs ``Base.metadata.create_all`` on startup, which may
    have already created ``prediction_records`` with ``model_version``.
    """
    op.alter_column('prediction_records', 'physical_activity',
                    existing_type=sa.String(length=20), nullable=True)
    op.alter_column('prediction_records', 'diet_quality',
                    existing_type=sa.Integer(), nullable=True)
    if not _has_column('prediction_records', 'model_version'):
        op.add_column(
            'prediction_records',
            sa.Column('model_version', sa.String(length=20), nullable=False, server_default='v1'),
        )
    if not _has_column('prediction_records', 'blood_glucose_entered'):
        op.add_column(
            'prediction_records', sa.Column('blood_glucose_entered', sa.Float(), nullable=True)
        )
    if not _has_column('prediction_records', 'blood_glucose_unit'):
        op.add_column(
            'prediction_records',
            sa.Column('blood_glucose_unit', sa.String(length=10), nullable=True),
        )


def downgrade() -> None:
    """Downgrade schema.

    Restoring NOT NULL fails if v2 records without physical activity / diet quality exist.
    """
    for column in ('blood_glucose_unit', 'blood_glucose_entered', 'model_version'):
        if _has_column('prediction_records', column):
            op.drop_column('prediction_records', column)
    op.alter_column('prediction_records', 'diet_quality',
                    existing_type=sa.Integer(), nullable=False)
    op.alter_column('prediction_records', 'physical_activity',
                    existing_type=sa.String(length=20), nullable=False)
