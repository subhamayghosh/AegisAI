"""add inspections.input_id

Revision ID: 3f2a9c7d1e84
Revises: 6531dd70b139
Create Date: 2026-09-26 03:00:00.000000+00:00

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import promptshield.db.base


# revision identifiers, used by Alembic.
revision: str = '3f2a9c7d1e84'
down_revision: Union[str, None] = '6531dd70b139'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable so the column can be added to a populated table; every row the
    # pipeline writes sets it from FirewallRequest.input_id.
    with op.batch_alter_table('inspections', schema=None) as batch_op:
        batch_op.add_column(sa.Column('input_id', promptshield.db.base.GUID(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('inspections', schema=None) as batch_op:
        batch_op.drop_column('input_id')
