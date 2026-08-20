from typing import TYPE_CHECKING

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.conversation import Conversation
    from app.db.models.floor import Floor


class Project(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A user's project. Root of the ownership chain: everything hangs off it."""

    __tablename__ = "projects"

    # Clerk user id (`sub` claim). Users live in Clerk, not in this database,
    # so there is no FK here — indexed because every list query filters by it.
    external_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    floors: Mapped[list["Floor"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Floor.level",
    )
    conversations: Mapped[list["Conversation"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
