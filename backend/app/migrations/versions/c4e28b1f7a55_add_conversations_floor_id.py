"""add conversations.floor_id

Revision ID: c4e28b1f7a55
Revises: b7c1d4e93a20
Create Date: 2026-09-22

Scopes an AI thread to the storey it is about, so reopening the editor can pick
the conversation back up instead of starting blank.

Nullable on purpose: a thread about the project as a whole belongs to no single
floor, and the existing rows have none. `ON DELETE CASCADE` matches the rest of
the chain — deleting a floor takes its conversation and messages with it.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "c4e28b1f7a55"
down_revision: Union[str, Sequence[str], None] = "b7c1d4e93a20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "conversations",
        sa.Column("floor_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        op.f("ix_conversations_floor_id"), "conversations", ["floor_id"], unique=False
    )
    op.create_foreign_key(
        "fk_conversations_floor_id_floors",
        "conversations",
        "floors",
        ["floor_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "fk_conversations_floor_id_floors", "conversations", type_="foreignkey"
    )
    op.drop_index(op.f("ix_conversations_floor_id"), table_name="conversations")
    op.drop_column("conversations", "floor_id")
