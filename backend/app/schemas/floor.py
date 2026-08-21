"""
Pydantic schemas for the floors API. Same shape as `schemas/project.py`:
`project_id` is never read from the body — it comes from the URL, and the
service checks the project belongs to the signed-in user before using it.
"""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

FLOOR_NAME_MAX_LENGTH = 120
# Guardrails, not a product rule: a basement is negative, a tower is not 10⁹
# floors tall. Widen them here if a project ever needs it.
FLOOR_MIN_LEVEL = -10
FLOOR_MAX_LEVEL = 200

FloorName = Annotated[
    str,
    Field(
        min_length=1,
        max_length=FLOOR_NAME_MAX_LENGTH,
        description="Floor name, as shown in the UI.",
        examples=["Planta Baja"],
    ),
]

FloorLevel = Annotated[
    int,
    Field(
        ge=FLOOR_MIN_LEVEL,
        le=FLOOR_MAX_LEVEL,
        description="Order of the floor: 0 = ground, 1 = first floor, -1 = basement.",
        examples=[0],
    ),
]


class FloorCreate(BaseModel):
    """Body of `POST /projects/{project_id}/floors`."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: FloorName
    # Defaults to the ground floor, like the column does.
    level: FloorLevel = 0


class FloorRead(BaseModel):
    """A floor as the API returns it."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    name: str
    level: int
    created_at: datetime
    updated_at: datetime
