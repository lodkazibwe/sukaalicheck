"""app_settings table and payment failure_reason

Revision ID: 4f0109586844
Revises: c7e9a2b4f108
Create Date: 2026-07-02 05:50:27.345278

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4f0109586844'
down_revision: Union[str, Sequence[str], None] = 'c7e9a2b4f108'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def _has_column(table: str, column: str) -> bool:
    return column in {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    """Upgrade schema.

    Idempotent: the app runs ``Base.metadata.create_all`` on startup, which may
    have already created ``app_settings``. Only create/alter what is missing.
    """
    if not _has_table('app_settings'):
        op.create_table(
            'app_settings',
            sa.Column('key', sa.String(length=100), nullable=False),
            sa.Column('value', sa.String(length=255), nullable=False),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
            sa.PrimaryKeyConstraint('key', name=op.f('pk_app_settings')),
        )
    if not _has_column('payment_records', 'failure_reason'):
        op.add_column(
            'payment_records', sa.Column('failure_reason', sa.String(length=255), nullable=True)
        )


def downgrade() -> None:
    """Downgrade schema."""
    if _has_column('payment_records', 'failure_reason'):
        op.drop_column('payment_records', 'failure_reason')
    if _has_table('app_settings'):
        op.drop_table('app_settings')
