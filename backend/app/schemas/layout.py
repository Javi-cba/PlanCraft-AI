"""
The architectural layout of a floor: walls, openings and rooms.

This is the drawing every plan of that floor is traced over. It lives on the
**floor** and not on the plan because the electrical, sanitary and gas plans of
"Planta Baja" are drawn on the same walls — duplicating them per plan would let
the three drift apart the moment somebody moves a wall.

Everything is in **centimetres**, on a plain cartesian plane with +y pointing
down (screen coordinates). The editor stores what it draws; the caps below are
guardrails against a runaway payload, not product rules.
"""

from typing import Annotated, Literal, Self
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator

LAYOUT_VERSION = 1

# ±1 km around the origin: far beyond any building, small enough that a bad
# float cannot blow up the canvas.
COORDINATE_LIMIT = 100_000.0

MAX_WALLS = 4_000
MAX_OPENINGS = 2_000
MAX_ROOMS = 500
MAX_ROOM_POINTS = 64

# Below this a wall is a click that slipped, not a wall.
MIN_WALL_LENGTH = 1.0

ID_MAX_LENGTH = 64
ROOM_NAME_MAX_LENGTH = 80

Coordinate = Annotated[float, Field(ge=-COORDINATE_LIMIT, le=COORDINATE_LIMIT)]
EntityId = Annotated[str, Field(min_length=1, max_length=ID_MAX_LENGTH)]


class LayoutModel(BaseModel):
    """Shared config: trimmed strings and no unknown keys anywhere in a layout."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class Point(LayoutModel):
    """A point on the floor plane, in centimetres."""

    x: Coordinate
    y: Coordinate


class Wall(LayoutModel):
    """A straight wall segment from `a` to `b`, `thickness` cm wide."""

    id: EntityId
    a: Point
    b: Point
    thickness: Annotated[float, Field(default=15.0, ge=1.0, le=200.0)]

    @model_validator(mode="after")
    def _check_length(self) -> Self:
        if self.length < MIN_WALL_LENGTH:
            raise ValueError(
                f"Una pared no puede medir menos de {MIN_WALL_LENGTH:g} cm."
            )
        return self

    @property
    def length(self) -> float:
        return ((self.b.x - self.a.x) ** 2 + (self.b.y - self.a.y) ** 2) ** 0.5


class Opening(LayoutModel):
    """
    A door or a window cut into a wall.

    `position` is where its centre sits along the wall as a fraction from `a`
    to `b`. Storing a fraction and not an absolute distance means stretching
    the wall keeps the opening where it looks like it belongs.
    """

    id: EntityId
    wall_id: EntityId
    kind: Literal["door", "window"]
    position: Annotated[float, Field(gt=0.0, lt=1.0)]
    width: Annotated[float, Field(default=90.0, ge=10.0, le=1_000.0)]
    # Which side the leaf swings to. Meaningless for a window, kept for both so
    # the editor does not need two shapes.
    flipped: bool = False


class Room(LayoutModel):
    """A named polygon. Its area is derived, never stored: it would go stale."""

    id: EntityId
    name: Annotated[str, Field(min_length=1, max_length=ROOM_NAME_MAX_LENGTH)]
    points: Annotated[list[Point], Field(min_length=3, max_length=MAX_ROOM_POINTS)]


class Layout(LayoutModel):
    """
    The whole drawing of a floor. An empty one — `{}` — is a valid layout: a
    floor starts blank and the editor fills it in.
    """

    version: Literal[1] = LAYOUT_VERSION
    units: Literal["cm"] = "cm"
    walls: Annotated[list[Wall], Field(default_factory=list, max_length=MAX_WALLS)]
    openings: Annotated[
        list[Opening], Field(default_factory=list, max_length=MAX_OPENINGS)
    ]
    rooms: Annotated[list[Room], Field(default_factory=list, max_length=MAX_ROOMS)]

    @model_validator(mode="after")
    def _check_references(self) -> Self:
        """Ids are unique per collection and every opening sits on a real wall."""
        wall_ids = _unique_ids(self.walls, "pared")
        _unique_ids(self.openings, "abertura")
        _unique_ids(self.rooms, "ambiente")

        orphan = next((o for o in self.openings if o.wall_id not in wall_ids), None)
        if orphan is not None:
            raise ValueError(
                f"La abertura {orphan.id!r} apunta a una pared que no existe."
            )

        return self


def _unique_ids(items: list[Wall] | list[Opening] | list[Room], label: str) -> set[str]:
    ids = {item.id for item in items}
    if len(ids) != len(items):
        raise ValueError(f"Hay más de un/a {label} con el mismo id.")
    return ids


class LayoutSummary(LayoutModel):
    """
    What a floor card shows without downloading the whole drawing: how much is
    on it and how many square metres its rooms add up to.
    """

    walls: int = 0
    openings: int = 0
    rooms: int = 0
    # Sum of the room polygons. Derived on every read, so it can never go stale.
    area_m2: float = 0.0


def polygon_area_cm2(points: list[Point]) -> float:
    """
    Shoelace formula. Absolute value, so the winding of the polygon (which the
    editor does not control) does not turn an area negative.
    """
    if len(points) < 3:
        return 0.0

    total = 0.0
    for index, current in enumerate(points):
        following = points[(index + 1) % len(points)]
        total += current.x * following.y - following.x * current.y

    return abs(total) / 2.0


def summarize_layout(layout: Layout) -> LayoutSummary:
    """Counts and total area of a layout. 10 000 cm² = 1 m²."""
    area_cm2 = sum(polygon_area_cm2(room.points) for room in layout.rooms)

    return LayoutSummary(
        walls=len(layout.walls),
        openings=len(layout.openings),
        rooms=len(layout.rooms),
        area_m2=round(area_cm2 / 10_000.0, 2),
    )


def empty_layout() -> dict[str, object]:
    """The layout a floor is created with when no template is chosen."""
    return Layout().model_dump()


def new_id(prefix: str) -> str:
    """Ids the server generates (templates, AI output) look like `w-3f2a…`."""
    return f"{prefix}-{uuid4().hex[:12]}"
