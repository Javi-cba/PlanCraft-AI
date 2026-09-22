"""
What the model is allowed to answer.

The LLM never hands back a drawing: it hands back a **list of operations** over
the drawing the user already has. That is the whole reason partial edits work.
Asking for a full layout on "movéme la puerta del baño" would make the model
re-emit every wall of the house — slow, expensive, and the untouched geometry
would drift a little on every turn. An operation list is a handful of tokens and
cannot damage what it does not mention.

Creating a plan from scratch is the same protocol with a `reset` in front.

Every field reuses the bounds of `app/schemas/layout.py`, so an answer that
would not fit in a `Layout` fails here first and `instructor` re-asks the model
with the validation error instead of letting it reach the database.
"""

from enum import StrEnum
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.floor import (
    FLOOR_MAX_LEVEL,
    FLOOR_MIN_LEVEL,
    FLOOR_NAME_MAX_LENGTH,
)
from app.schemas.layout import (
    COORDINATE_LIMIT,
    ID_MAX_LENGTH,
    MAX_ROOM_POINTS,
    ROOM_NAME_MAX_LENGTH,
    Point,
)

# One turn cannot do more than this. A house is tens of operations; hundreds
# means the model is looping, and applying them would hit the layout's own caps
# anyway (`MAX_WALLS` and friends).
MAX_OPERATIONS = 400

SUMMARY_MAX_LENGTH = 400

# One turn can add a storey or two ("planta alta y ático"), never a tower.
MAX_NEW_FLOORS = 4


class OperationKind(StrEnum):
    """
    The verbs the assistant can use. Deliberately small: anything the editor
    can do by hand, nothing it cannot.
    """

    # Wipes the floor before drawing. How "creá una casa de cero" is expressed.
    RESET = "reset"

    ADD_WALL = "add_wall"
    UPDATE_WALL = "update_wall"
    REMOVE_WALL = "remove_wall"

    ADD_OPENING = "add_opening"
    UPDATE_OPENING = "update_opening"
    REMOVE_OPENING = "remove_opening"

    ADD_ROOM = "add_room"
    UPDATE_ROOM = "update_room"
    REMOVE_ROOM = "remove_room"


# Which fields each verb needs. Checked below so a malformed operation is a
# validation error the model gets to fix, not a `KeyError` at apply time.
_REQUIRED_FIELDS: dict[OperationKind, tuple[str, ...]] = {
    OperationKind.RESET: (),
    OperationKind.ADD_WALL: ("a", "b"),
    OperationKind.UPDATE_WALL: ("id",),
    OperationKind.REMOVE_WALL: ("id",),
    OperationKind.ADD_OPENING: ("wall_id", "kind", "position"),
    OperationKind.UPDATE_OPENING: ("id",),
    OperationKind.REMOVE_OPENING: ("id",),
    OperationKind.ADD_ROOM: ("name", "points"),
    OperationKind.UPDATE_ROOM: ("id",),
    OperationKind.REMOVE_ROOM: ("id",),
}

# An `update_*` that sets nothing is a wasted call, and usually a sign the model
# meant to remove instead. These are the fields each one may patch.
_PATCHABLE_FIELDS: dict[OperationKind, tuple[str, ...]] = {
    OperationKind.UPDATE_WALL: ("a", "b", "thickness"),
    OperationKind.UPDATE_OPENING: ("wall_id", "kind", "position", "width", "flipped"),
    OperationKind.UPDATE_ROOM: ("name", "points"),
}


class PlanOperation(BaseModel):
    """
    One edit. Flat on purpose: a tagged union would be a more elegant schema,
    but every field of a flat object is described once in the tool definition
    and models fill it far more reliably than a ten-branch `anyOf`.

    Which fields matter depends on `op`; the validator below enforces that pair.
    """

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    op: OperationKind = Field(description="What this operation does.")

    id: str | None = Field(
        default=None,
        max_length=ID_MAX_LENGTH,
        description=(
            "For update_*/remove_*: the id of the existing entity. For add_*: "
            "the id to give it, so later operations in this same answer can "
            "reference it."
        ),
    )

    # --- walls ------------------------------------------------------------
    a: Point | None = Field(default=None, description="Wall start, in cm.")
    b: Point | None = Field(default=None, description="Wall end, in cm.")
    thickness: float | None = Field(
        default=None,
        ge=1.0,
        le=200.0,
        description="Wall thickness in cm. 15 for interior, 20-30 outer.",
    )

    # --- openings ---------------------------------------------------------
    wall_id: str | None = Field(
        default=None,
        max_length=ID_MAX_LENGTH,
        description="Wall the door or window is cut into.",
    )
    kind: Literal["door", "window"] | None = Field(default=None)
    position: float | None = Field(
        default=None,
        gt=0.0,
        lt=1.0,
        description="Centre of the opening along the wall: 0 at `a`, 1 at `b`.",
    )
    width: float | None = Field(
        default=None,
        ge=10.0,
        le=1_000.0,
        description="Opening width in cm. 80-90 doors, 120 windows.",
    )
    flipped: bool | None = Field(
        default=None, description="Which side a door leaf swings to."
    )

    # --- rooms ------------------------------------------------------------
    name: str | None = Field(
        default=None,
        max_length=ROOM_NAME_MAX_LENGTH,
        description="Room name in Spanish, e.g. 'Cocina'.",
    )
    points: list[Point] | None = Field(
        default=None,
        min_length=3,
        max_length=MAX_ROOM_POINTS,
        description="Room polygon, in order, in cm.",
    )

    @model_validator(mode="after")
    def _check_shape(self) -> Self:
        missing = [
            field
            for field in _REQUIRED_FIELDS[self.op]
            if getattr(self, field) is None
        ]
        if missing:
            raise ValueError(
                f"The operation {self.op.value!r} requires {', '.join(missing)}."
            )

        patchable = _PATCHABLE_FIELDS.get(self.op)
        if patchable is not None and all(
            getattr(self, field) is None for field in patchable
        ):
            raise ValueError(
                f"The operation {self.op.value!r} must change at least one of "
                f"{', '.join(patchable)}."
            )

        return self


class NewFloor(BaseModel):
    """
    A storey to add to the project, drawn from scratch.

    This exists because "hacé el ático" is not an edit of the floor on screen:
    drawing it beside the current plan — which is what an assistant without this
    does — produces one storey with two houses in it. A new floor is a new
    floor, and the project already knows how to hold several.

    Its `operations` start from an empty drawing, so they never need `reset`.
    """

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(
        min_length=1,
        max_length=FLOOR_NAME_MAX_LENGTH,
        description="Name of the storey in Spanish, e.g. 'Ático' or 'Planta Alta'.",
    )
    level: int = Field(
        ge=FLOOR_MIN_LEVEL,
        le=FLOOR_MAX_LEVEL,
        description=(
            "Where it sits: 0 is the ground floor, 1 the one above it, -1 a "
            "basement. An attic goes above the highest existing storey."
        ),
    )
    operations: list[PlanOperation] = Field(
        default_factory=list,
        max_length=MAX_OPERATIONS,
        description="How to draw it, starting from an empty floor.",
    )


class PlanEdit(BaseModel):
    """
    The whole answer: what the assistant says, and what it does.

    `summary` is shown in the chat, so it is written for the person reading it
    — Spanish, one or two sentences — while `operations` is what the editor
    applies. Keeping both in one schema is what stops the model from narrating
    changes it never made.
    """

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    summary: str = Field(
        min_length=1,
        max_length=SUMMARY_MAX_LENGTH,
        description=(
            "One or two sentences in Rioplatense Spanish describing what you "
            "changed, addressed to the user. No markdown, no JSON."
        )
    )
    operations: list[PlanOperation] = Field(
        default_factory=list,
        max_length=MAX_OPERATIONS,
        description=(
            "Edits to the storey currently open, in order. Empty when the "
            "request needs no change to it — adding another storey does not."
        ),
    )
    new_floors: list[NewFloor] = Field(
        default_factory=list,
        max_length=MAX_NEW_FLOORS,
        description=(
            "Storeys to add to the project. Use this — never `operations` — "
            "when asked for another floor, an attic or a basement."
        ),
    )


# Re-exported so callers do not have to know the coordinate system lives in
# `schemas/layout.py`.
__all__ = [
    "COORDINATE_LIMIT",
    "MAX_NEW_FLOORS",
    "MAX_OPERATIONS",
    "NewFloor",
    "OperationKind",
    "PlanEdit",
    "PlanOperation",
]
