"""Column groups shared by every table, so they stay identical across models."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class UUIDPrimaryKeyMixin:
    """`id uuid PK`. Defaulted on both sides so raw SQL inserts also work."""

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
        # Keeps `id` first and the timestamps last in the generated DDL.
        sort_order=-100,
    )


class TimestampMixin:
    """`created_at` / `updated_at`, always timezone-aware (timestamptz)."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        sort_order=100,
    )
    # Postgres does not touch this by itself; SQLAlchemy sets it on every UPDATE.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        sort_order=100,
    )
