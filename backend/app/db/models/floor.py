import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.plan import Plan
    from app.db.models.project import Project


class Floor(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A storey of a project ("Planta Baja", "Planta Alta"), ordered by `level`."""

    __tablename__ = "floors"
    # Floors are always read as "all floors of this project, in order".
    __table_args__ = (Index("ix_floors_project_id_level", "project_id", "level"),)

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # 0 = ground floor, 1 = first floor, -1 = basement.
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    project: Mapped["Project"] = relationship(back_populates="floors")
    plans: Mapped[list["Plan"]] = relationship(
        back_populates="floor",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
