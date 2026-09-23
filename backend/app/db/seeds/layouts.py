"""
Floor layouts for the seed, built from rectangular rooms.

This is the Python twin of `frontend/src/lib/plans/templates.ts`: a storey is
authored as a list of **rectangles** in centimetres plus the doors and windows
on them, and the walls are derived from the rectangles' edges. That is the only
way these stay readable — writing forty wall segments by hand is how a plan
ends up with a corner that does not close.

`merge_collinear_walls` is what makes it work: the edge two adjoining rooms
share arrives twice, and a long wall arrives in the pieces the rooms on either
side contributed. Left alone, an opening cut into one copy would leave the
other one solid across the doorway.

Everything is in centimetres on the same plane as `app/schemas/layout.py`, with
+y pointing down. Ids are sequential and not random on purpose: re-running the
seed must produce the same drawing, so a diff between two runs shows real
changes instead of a fresh set of ids.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal, NamedTuple

from app.schemas.layout import Layout

DEFAULT_WALL_THICKNESS = 15.0
DEFAULT_DOOR_WIDTH = 90.0
DEFAULT_WINDOW_WIDTH = 120.0

# Two wall pieces this close, on the same line, are the same wall.
MERGE_TOLERANCE = 0.5
# How far from a wall an opening may point and still find it.
OPENING_TOLERANCE = 25.0

# Below this, two directions are the same direction — floats coming out of a
# division never land exactly on 0.
EPSILON = 1e-9

Point = tuple[float, float]


@dataclass(frozen=True, slots=True)
class Rect:
    """A rectangular room: origin plus size, in centimetres."""

    name: str
    x: float
    y: float
    width: float
    height: float


@dataclass(frozen=True, slots=True)
class OpeningAt:
    """
    A door or a window placed by pointing at where it goes.

    The builder finds the wall under that point, which is far easier to author
    (and to re-read) than naming a wall that does not exist yet.
    """

    kind: Literal["door", "window"]
    x: float
    y: float
    width: float


def door(x: float, y: float, width: float = DEFAULT_DOOR_WIDTH) -> OpeningAt:
    return OpeningAt(kind="door", x=x, y=y, width=width)


def window(x: float, y: float, width: float = DEFAULT_WINDOW_WIDTH) -> OpeningAt:
    return OpeningAt(kind="window", x=x, y=y, width=width)


def spot(rooms: Sequence[Rect], name: str, fx: float = 0.5, fy: float = 0.5) -> Point:
    """
    A point inside a room, given as a fraction of its width and height.

    Every element of the seed is placed with this instead of with a bare pair of
    numbers: `spot(HOUSE, "Cocina", 0.1, 0.9)` cannot land in the bathroom the
    way a hand-typed `(35, 735)` silently can once a room moves.
    """
    room = _room(rooms, name)
    return (room.x + room.width * fx, room.y + room.height * fy)


def edge(rooms: Sequence[Rect], name: str, side: str, fraction: float = 0.5) -> Point:
    """A point on one of a room's four edges — where openings are pointed at."""
    room = _room(rooms, name)
    anchors: dict[str, Point] = {
        "top": (room.x + room.width * fraction, room.y),
        "bottom": (room.x + room.width * fraction, room.y + room.height),
        "left": (room.x, room.y + room.height * fraction),
        "right": (room.x + room.width, room.y + room.height * fraction),
    }

    if side not in anchors:
        raise ValueError(f"Lado desconocido: {side!r}. Usá top/bottom/left/right.")

    return anchors[side]


class _Segment(NamedTuple):
    """One edge of a rectangle, before the collinear ones are fused."""

    a: Point
    b: Point
    thickness: float


def build_layout(
    rooms: Sequence[Rect],
    openings: Sequence[OpeningAt] = (),
    thickness: float = DEFAULT_WALL_THICKNESS,
) -> Layout:
    """
    The whole drawing of a storey: walls from the rectangles, then the openings.

    The result is validated as a `Layout`, so a seed that would be rejected by
    `PUT /floors/{id}/layout` fails here, while writing it, instead of landing
    in the database as a drawing the editor cannot open.
    """
    corners = [_rectangle_points(room) for room in rooms]

    edges = [
        _Segment(points[index], points[(index + 1) % len(points)], thickness)
        for points in corners
        for index in range(len(points))
    ]

    walls = merge_collinear_walls(edges)

    return Layout.model_validate(
        {
            "version": 1,
            "units": "cm",
            "walls": walls,
            "openings": _place_openings(walls, openings),
            "rooms": [
                {
                    "id": f"r-{index + 1:03d}",
                    "name": room.name,
                    "points": [{"x": x, "y": y} for x, y in points],
                }
                for index, (room, points) in enumerate(zip(rooms, corners, strict=True))
            ],
        }
    )


def merge_collinear_walls(
    segments: Sequence[_Segment], tolerance: float = MERGE_TOLERANCE
) -> list[dict]:
    """
    Fuses walls that lie on the same straight line and touch or overlap.

    Thickness is part of the grouping: a partition and a load-bearing wall on
    the same line are two different walls, not one.
    """
    groups: dict[str, list[tuple[Point, float, _Segment]]] = {}

    for segment in segments:
        unit = _direction(segment.a, segment.b)
        if unit == (0.0, 0.0):
            continue

        # One orientation per line, so `a→b` and `b→a` land in the same group.
        if unit[0] < -EPSILON or (abs(unit[0]) <= EPSILON and unit[1] < 0):
            unit = (-unit[0], -unit[1])

        # Signed distance from the origin to the line, along its normal.
        offset = segment.a[0] * -unit[1] + segment.a[1] * unit[0]

        key = ":".join(
            (
                _key_part(unit[0], 4),
                _key_part(unit[1], 4),
                _key_part(offset, 1),
                _key_part(segment.thickness, 2),
            )
        )
        groups.setdefault(key, []).append((unit, offset, segment))

    merged: list[dict] = []

    for group in groups.values():
        unit, offset, _ = group[0]

        # Position along the line, so an overlap is a plain interval overlap.
        def along(point: Point, unit: Point = unit) -> float:
            return point[0] * unit[0] + point[1] * unit[1]

        spans = sorted(
            (
                min(along(segment.a), along(segment.b)),
                max(along(segment.a), along(segment.b)),
                segment.thickness,
            )
            for _, _, segment in group
        )

        runs: list[tuple[float, float, float]] = []
        current = spans[0]

        for span in spans[1:]:
            if span[0] <= current[1] + tolerance:
                current = (current[0], max(current[1], span[1]), current[2])
            else:
                runs.append(current)
                current = span
        runs.append(current)

        for start, end, run_thickness in runs:
            merged.append(
                {
                    # Numbered below, once every group has contributed: doing it
                    # here would tie the ids to the order the groups happen to
                    # come out of the dict.
                    "id": "",
                    "a": _point_at(unit, offset, start),
                    "b": _point_at(unit, offset, end),
                    "thickness": run_thickness,
                }
            )

    for index, wall in enumerate(merged):
        wall["id"] = f"w-{index + 1:03d}"

    return merged


def _place_openings(walls: list[dict], openings: Sequence[OpeningAt]) -> list[dict]:
    """
    Cuts each opening into the wall nearest to the point it was authored at.

    An opening that points at nothing is skipped rather than raised: the picker
    in the frontend drops it too, and failing here would take the whole seed
    down over a door authored 30 cm off its wall.
    """
    placed: list[dict] = []

    for opening in openings:
        hit = _wall_at(walls, (opening.x, opening.y), OPENING_TOLERANCE)
        if hit is None:
            continue

        wall, t = hit
        total = _length(wall["a"], wall["b"])
        position = _fit_opening(total, t, opening.width)
        if position is None:
            continue

        placed.append(
            {
                "id": f"o-{len(placed) + 1:03d}",
                "wall_id": wall["id"],
                "kind": opening.kind,
                "position": position,
                "width": min(opening.width, total),
                "flipped": False,
            }
        )

    return placed


def _wall_at(
    walls: list[dict], point: Point, tolerance: float
) -> tuple[dict, float] | None:
    """The wall nearest to `point`, plus where along it the point landed."""
    best: tuple[dict, float, float] | None = None

    for wall in walls:
        t, distance = _project_on_segment(point, wall["a"], wall["b"])
        # Half the thickness counts as "on the wall", so a thick wall is not
        # harder to hit than a thin one.
        reach = tolerance + wall["thickness"] / 2

        if distance <= reach and (best is None or distance < best[2]):
            best = (wall, t, distance)

    return None if best is None else (best[0], best[1])


def _fit_opening(total: float, t: float, width: float) -> float | None:
    """
    `t` moved so an opening of `width` fits entirely inside the wall, or None
    when the wall is too short to hold one.
    """
    if total <= 0:
        return None

    half = min(width, total) / 2 / total
    # Strictly inside: the layout schema rejects 0 and 1, and an opening flush
    # with a corner is a doorway with no jamb.
    low = min(half, 0.499)
    high = max(1 - half, 0.501)

    return min(max(t, low), high)


def _room(rooms: Sequence[Rect], name: str) -> Rect:
    room = next((candidate for candidate in rooms if candidate.name == name), None)
    if room is None:
        raise KeyError(f"No hay un ambiente llamado {name!r} en este piso.")
    return room


def _rectangle_points(room: Rect) -> list[Point]:
    """The four corners of a room, clockwise from its origin."""
    right, bottom = room.x + room.width, room.y + room.height
    return [(room.x, room.y), (right, room.y), (right, bottom), (room.x, bottom)]


def _direction(a: Point, b: Point) -> Point:
    delta = (b[0] - a[0], b[1] - a[1])
    size = (delta[0] ** 2 + delta[1] ** 2) ** 0.5
    return (0.0, 0.0) if size == 0 else (delta[0] / size, delta[1] / size)


def _length(a: dict, b: dict) -> float:
    return ((b["x"] - a["x"]) ** 2 + (b["y"] - a["y"]) ** 2) ** 0.5


def _point_at(unit: Point, offset: float, position: float) -> dict:
    """Back from (position along the line, offset across it) to a plain point."""
    return {
        "x": unit[0] * position - unit[1] * offset,
        "y": unit[1] * position + unit[0] * offset,
    }


def _project_on_segment(point: Point, a: dict, b: dict) -> tuple[float, float]:
    """Where `point` falls on the segment (0 at `a`, 1 at `b`) and how far off."""
    delta = (b["x"] - a["x"], b["y"] - a["y"])
    squared = delta[0] ** 2 + delta[1] ** 2

    if squared == 0:
        return 0.0, ((point[0] - a["x"]) ** 2 + (point[1] - a["y"]) ** 2) ** 0.5

    raw = ((point[0] - a["x"]) * delta[0] + (point[1] - a["y"]) * delta[1]) / squared
    t = min(max(raw, 0.0), 1.0)
    projected = (a["x"] + delta[0] * t, a["y"] + delta[1] * t)
    distance = ((point[0] - projected[0]) ** 2 + (point[1] - projected[1]) ** 2) ** 0.5

    return t, distance


def _key_part(value: float, digits: int) -> str:
    """
    A number as a grouping key. `or 0.0` collapses -0.0 into 0.0: without it a
    wall drawn right-to-left keys as "-0.0000" and never meets its twin.
    """
    return f"{round(value, digits) or 0.0:.{digits}f}"
