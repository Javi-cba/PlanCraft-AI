"""create core tables

Revision ID: ab5a092645f0
Revises: 
Create Date: 2026-08-20 18:54:44.347034

Initial schema from init_DER_db.mmd: projects > floors > plans > elements,
plus the AI chat pair projects > conversations > messages. Every child is
ON DELETE CASCADE, so deleting a project takes its whole tree with it.

`gen_random_uuid()` is built into Postgres 13+ (Neon), no extension needed.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'ab5a092645f0'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "projects",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        # Clerk user id: users live in Clerk, so this is not a foreign key.
        sa.Column("external_user_id", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_projects_external_user_id", "projects", ["external_user_id"], unique=False)

    op.create_table(
        "floors",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        # 0 = ground floor, 1 = first floor, -1 = basement.
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    # Floors are always read as "all floors of this project, in order".
    op.create_index("ix_floors_project_id_level", "floors", ["project_id", "level"], unique=False)

    op.create_table(
        "plans",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("floor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        # varchar + CHECK instead of a native enum: adding a type needs no ALTER TYPE.
        sa.Column(
            "installation_type",
            sa.Enum(
                "electrical",
                "sanitary",
                "gas",
                name="installation_type",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "canvas_meta",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["floor_id"], ["floors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_plans_floor_id", "plans", ["floor_id"], unique=False)

    op.create_table(
        "elements",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), nullable=False),
        # Open set (outlet, switch, light, pipe, ...): a new symbol must not
        # require a migration, so this is a plain varchar.
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("x", sa.Double(), nullable=False),
        sa.Column("y", sa.Double(), nullable=False),
        sa.Column("rotation", sa.Double(), server_default=sa.text("0"), nullable=False),
        # Type-specific data: power, circuit, diameter...
        sa.Column(
            "properties",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_elements_plan_id", "elements", ["plan_id"], unique=False)

    op.create_table(
        "conversations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        # Denormalized from the project so "my conversations" needs no join.
        sa.Column("external_user_id", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_conversations_project_id", "conversations", ["project_id"], unique=False)
    op.create_index(
        "ix_conversations_external_user_id", "conversations", ["external_user_id"], unique=False
    )

    op.create_table(
        "messages",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "user",
                "assistant",
                "system",
                name="message_role",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        # Model, token usage, ids of the elements this turn generated...
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        # Append-only table: no updated_at.
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    # Messages are always read as "this thread, oldest first".
    op.create_index(
        "ix_messages_conversation_id_created_at",
        "messages",
        ["conversation_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_messages_conversation_id_created_at", table_name="messages")
    op.drop_table("messages")
    op.drop_index("ix_conversations_external_user_id", table_name="conversations")
    op.drop_index("ix_conversations_project_id", table_name="conversations")
    op.drop_table("conversations")
    op.drop_index("ix_elements_plan_id", table_name="elements")
    op.drop_table("elements")
    op.drop_index("ix_plans_floor_id", table_name="plans")
    op.drop_table("plans")
    op.drop_index("ix_floors_project_id_level", table_name="floors")
    op.drop_table("floors")
    op.drop_index("ix_projects_external_user_id", table_name="projects")
    op.drop_table("projects")
