import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.floor import Floor
    from app.db.models.message import Message
    from app.db.models.project import Project


class Conversation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """
    An AI chat thread. Scoped to a project, and — when it is the plan
    assistant — to the floor being drawn.

    The floor is what makes "seguí editando este plano" work: reopening the
    editor finds the thread by `floor_id` and the conversation picks up where it
    was, instead of starting blank every time.
    """

    __tablename__ = "conversations"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Nullable: a thread about the project as a whole belongs to no single
    # storey, and the column was added after the table existed.
    floor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("floors.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    # Denormalized from the project so "my conversations" needs no join, and an
    # ownership check does not have to load the project first.
    external_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    title: Mapped[str | None] = mapped_column(String(255))

    project: Mapped["Project"] = relationship(back_populates="conversations")
    floor: Mapped["Floor | None"] = relationship()
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Message.created_at",
    )
