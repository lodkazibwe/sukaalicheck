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


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'app_settings',
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('value', sa.String(length=255), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('key', name=op.f('pk_app_settings')),
    )
    op.add_column('payment_records', sa.Column('failure_reason', sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('payment_records', 'failure_reason')
    op.drop_table('app_settings')
