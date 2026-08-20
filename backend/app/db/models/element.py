import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import Double, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.plan import Plan


class Element(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One item placed on a plan: an outlet, a switch, a light, a pipe run..."""

    __tablename__ = "elements"

    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Open set (outlet, switch, light, pipe, ...): a new symbol must not require
    # a migration, so this stays a plain varchar.
    type: Mapped[str] = mapped_column(String(64), nullable=False)

    # Canvas coordinates and rotation in degrees.
    x: Mapped[float] = mapped_column(Double, nullable=False)
    y: Mapped[float] = mapped_column(Double, nullable=False)
    rotation: Mapped[float] = mapped_column(Double, nullable=False, default=0.0, server_default=text("0"))

    # Type-specific data: power, circuit, diameter... shape depends on `type`.
    properties: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )

    plan: Mapped["Plan"] = relationship(back_populates="elements")
