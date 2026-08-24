"""add floors.layout

Revision ID: b7c1d4e93a20
Revises: ab5a092645f0
Create Date: 2026-08-24

The architectural drawing of a storey — walls, openings and rooms, in
centimetres. It hangs off the floor and not off the plan: the electrical,
sanitary and gas plans of the same storey are traced over the same walls.

Existing rows get `{}`, which `app/schemas/layout.py` reads as an empty layout.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "b7c1d4e93a20"
down_revision: Union[str, Sequence[str], None] = "ab5a092645f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "floors",
        sa.Column(
            "layout",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("floors", "layout")
