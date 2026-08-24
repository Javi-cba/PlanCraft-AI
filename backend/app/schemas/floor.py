"""
Pydantic schemas for the floors API. Same shape as `schemas/project.py`:
`project_id` is never read from the body — it comes from the URL, and the
service checks the project belongs to the signed-in user before using it.

A floor carries its `layout` (the walls, openings and rooms of the storey, see
`schemas/layout.py`). Lists never ship it: the drawing of a whole house is far
more than a card needs, so `FloorRead` publishes a derived `summary` instead and
only the detail endpoint returns the layout itself.
"""

from datetime import datetime
from typing import Annotated, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from app.schemas.layout import Layout, LayoutSummary, summarize_layout
from app.schemas.plan import PlanRead

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
    """
    Body of `POST /projects/{project_id}/floors`.

    `layout` is how a template is applied: the editor sends the walls of the
    chosen template with the floor, so it is created already drawn instead of
    blank plus a follow-up save.
    """

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: FloorName
    # Defaults to the ground floor, like the column does.
    level: FloorLevel = 0
    layout: Layout = Field(default_factory=Layout)


class FloorUpdate(BaseModel):
    """
    Body of `PATCH /floors/{floor_id}`. Every field is optional and only the
    ones actually sent are written — the layout has its own endpoint, because
    renaming a floor and redrawing it are not the same operation.
    """

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: FloorName | None = None
    level: FloorLevel | None = None

    @model_validator(mode="after")
    def _require_one_field(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("No enviaste ningún campo para actualizar.")
        return self


class FloorLayoutUpdate(BaseModel):
    """
    Body of `PUT /floors/{floor_id}/layout`: the drawing, whole.

    A PUT and not a PATCH on purpose — the editor always holds the complete
    layout in memory, and replacing it outright is what makes a save idempotent
    and free of merge surprises between two open tabs.
    """

    model_config = ConfigDict(extra="forbid")

    layout: Layout


class FloorRead(BaseModel):
    """
    A floor as the API returns it, with the counts and area of its layout.

    `layout` is populated from the ORM (that is where `summary` comes from) but
    excluded from the response; `FloorDetailRead` is the one that publishes it.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    name: str
    level: int
    layout: Layout = Field(exclude=True, repr=False)
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def summary(self) -> LayoutSummary:
        return summarize_layout(self.layout)


class FloorWithPlansRead(FloorRead):
    """A floor plus its plans — what the project page lists, in one request."""

    plans: list[PlanRead] = Field(default_factory=list)


class FloorDetailRead(FloorWithPlansRead):
    """Everything about a floor, layout included. What the editor opens with."""

    # Redeclared without `exclude`, so here the drawing does travel.
    layout: Layout
