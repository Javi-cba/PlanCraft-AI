"""
Pydantic schemas for the plans API. `floor_id` comes from the URL, never from
the body, and the service verifies the chain floor → project → owner first.
"""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# The enum is a domain value, not a table: reusing the ORM's one keeps the API
# validation and the column's CHECK constraint from ever drifting apart.
from app.db.models.plan import InstallationType

PLAN_NAME_MAX_LENGTH = 120

PlanName = Annotated[
    str,
    Field(
        min_length=1,
        max_length=PLAN_NAME_MAX_LENGTH,
        description="Plan name, as shown in the UI.",
        examples=["Eléctrica planta baja"],
    ),
]

CanvasMeta = Annotated[
    dict[str, Any],
    Field(
        default_factory=dict,
        description=(
            "Canvas state (scale, size, background). Free-form on purpose: only "
            "the editor reads it, so it is stored as jsonb and not validated here."
        ),
        examples=[{"scale": 50, "width": 1200, "height": 800}],
    ),
]


class PlanCreate(BaseModel):
    """Body of `POST /floors/{floor_id}/plans`."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: PlanName
    # An unknown value fails here as a 422 VALIDATION_ERROR listing the field.
    installation_type: InstallationType
    canvas_meta: CanvasMeta


class PlanRead(BaseModel):
    """A plan as the API returns it."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    floor_id: UUID
    name: str
    installation_type: InstallationType
    canvas_meta: dict[str, Any]
    created_at: datetime
    updated_at: datetime
