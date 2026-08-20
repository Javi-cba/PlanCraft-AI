import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum as SAEnum
from sqlalchemy import ForeignKey, Index, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.mixins import UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.conversation import Conversation


class MessageRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class Message(UUIDPrimaryKeyMixin, Base):
    """One turn of a conversation. Append-only: no `updated_at`."""

    __tablename__ = "messages"
    # Messages are always read as "this thread, oldest first".
    __table_args__ = (Index("ix_messages_conversation_id_created_at", "conversation_id", "created_at"),)

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[MessageRole] = mapped_column(
        SAEnum(
            MessageRole,
            name="message_role",
            native_enum=False,
            create_constraint=True,
            length=16,
            values_callable=lambda enum: [member.value for member in enum],
        ),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Model, token usage, ids of the elements this turn generated...
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        # `metadata` is taken by SQLAlchemy's declarative API, so the attribute
        # is renamed while the column keeps the name from the ER diagram.
        "metadata",
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        sort_order=100,
    )

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
