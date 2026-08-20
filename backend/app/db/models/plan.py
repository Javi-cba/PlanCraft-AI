import uuid
from enum import StrEnum
from typing import TYPE_CHECKING, Any

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.element import Element
    from app.db.models.floor import Floor


class InstallationType(StrEnum):
    """The kind of installation a plan draws. One plan = one installation."""

    ELECTRICAL = "electrical"
    SANITARY = "sanitary"
    GAS = "gas"


class Plan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A single installation drawing over one floor."""

    __tablename__ = "plans"

    floor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("floors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # native_enum=False -> varchar + CHECK: adding a type later needs no ALTER TYPE.
    installation_type: Mapped[InstallationType] = mapped_column(
        SAEnum(
            InstallationType,
            name="installation_type",
            native_enum=False,
            create_constraint=True,
            length=32,
            values_callable=lambda enum: [member.value for member in enum],
        ),
        nullable=False,
    )
    # Canvas state: scale, size, background image. Free-form, only the frontend
    # reads it, so it is not modelled as columns.
    canvas_meta: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )

    floor: Mapped["Floor"] = relationship(back_populates="plans")
    elements: Mapped[list["Element"]] = relationship(
        back_populates="plan",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
