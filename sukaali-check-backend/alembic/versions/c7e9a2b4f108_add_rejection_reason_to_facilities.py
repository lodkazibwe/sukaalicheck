"""add rejection_reason to facilities

Revision ID: c7e9a2b4f108
Revises: f5debed2a308
Create Date: 2026-06-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7e9a2b4f108'
down_revision: Union[str, Sequence[str], None] = 'f5debed2a308'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('facilities', sa.Column('rejection_reason', sa.String(length=1000), nullable=True))


def downgrade() -> None:
    op.drop_column('facilities', 'rejection_reason')
