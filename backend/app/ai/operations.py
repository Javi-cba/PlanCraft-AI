"""
Turns the model's operation list into a new `Layout`.

The rules here are what keep a hallucinated answer from producing a broken
drawing:

* nothing is mutated in place — the caller keeps the layout it passed in, which
  is what lets the editor put the result on its undo stack;
* an operation that cannot be carried out (an id that does not exist, a wall
  one centimetre long) is **skipped and reported**, never applied halfway. A
  turn that renames three rooms and misses one should rename three rooms;
* removing a wall removes its doors and windows, because an opening on a wall
  that is gone is not a valid layout;
* the result is validated as a whole `Layout` before it is returned.

The skip reasons are Spanish: they are shown to the user under the assistant's
message, so they have to read like an explanation and not like a stack trace.
"""

import logging
from dataclasses import dataclass, field
from typing import Any

from pydantic import ValidationError

from app.ai.schemas import OperationKind, PlanOperation
from app.schemas.layout import (
    MAX_OPENINGS,
    MAX_ROOMS,
    MAX_WALLS,
    Layout,
    Opening,
    Room,
    Wall,
    new_id,
)

logger = logging.getLogger(__name__)

# Widths the editor uses when you place an opening by hand. Matching them means
# an AI-placed window and a hand-placed one look the same.
DEFAULT_OPENING_WIDTH: dict[str, float] = {"door": 90.0, "window": 120.0}

# Id prefixes, so an AI-drawn wall is indistinguishable from a template's.
_PREFIXES = {"wall": "w", "opening": "o", "room": "r"}


@dataclass
class AppliedEdit:
    """The new drawing, what actually happened, and what did not."""

    layout: Layout
    # How many operations were carried out. The UI shows it next to the summary.
    applied: int = 0
    # One Spanish sentence per skipped operation.
    skipped: list[str] = field(default_factory=list)


@dataclass
class _Draft:
    """
    The layout being built, as plain lists plus an index by id.

    Rebuilding a `Layout` after every operation would re-validate the whole
    house dozens of times per turn; the lists are validated once at the end.
    """

    walls: list[Wall]
    openings: list[Opening]
    rooms: list[Room]
    # Ids the model proposed that had to be renamed because they were taken.
    # Later operations in the same answer refer to the id the model chose, so
    # the remap has to outlive the operation that caused it.
    renamed: dict[str, str] = field(default_factory=dict)

    def taken(self) -> set[str]:
        return (
            {wall.id for wall in self.walls}
            | {opening.id for opening in self.openings}
            | {room.id for room in self.rooms}
        )

    def resolve(self, entity_id: str | None) -> str | None:
        """The id an operation means, after any rename this answer performed."""
        if entity_id is None:
            return None
        return self.renamed.get(entity_id, entity_id)


def apply_operations(layout: Layout, operations: list[PlanOperation]) -> AppliedEdit:
    """
    Applies `operations` to a copy of `layout` and returns the result.

    Raises `ValueError` only when the outcome is not a valid layout at all —
    which, given every operation is guarded, means the model produced something
    the per-operation checks could not foresee. The caller turns that into an
    error the user can retry.
    """
    draft = _Draft(
        walls=list(layout.walls),
        openings=list(layout.openings),
        rooms=list(layout.rooms),
    )

    applied = 0
    skipped: list[str] = []

    for operation in operations:
        problem = _apply_one(draft, operation)

        if problem is None:
            applied += 1
        else:
            skipped.append(problem)

    try:
        result = Layout(walls=draft.walls, openings=draft.openings, rooms=draft.rooms)
    except ValidationError as exc:
        logger.warning("AI produced an invalid layout: %s", exc)
        raise ValueError("El resultado no es un plano válido.") from exc

    return AppliedEdit(layout=result, applied=applied, skipped=skipped)


def _apply_one(draft: _Draft, operation: PlanOperation) -> str | None:
    """Carries out one operation. Returns `None`, or why it was skipped."""
    handlers = {
        OperationKind.RESET: _reset,
        OperationKind.ADD_WALL: _add_wall,
        OperationKind.UPDATE_WALL: _update_wall,
        OperationKind.REMOVE_WALL: _remove_wall,
        OperationKind.ADD_OPENING: _add_opening,
        OperationKind.UPDATE_OPENING: _update_opening,
        OperationKind.REMOVE_OPENING: _remove_opening,
        OperationKind.ADD_ROOM: _add_room,
        OperationKind.UPDATE_ROOM: _update_room,
        OperationKind.REMOVE_ROOM: _remove_room,
    }

    try:
        return handlers[operation.op](draft, operation)
    except ValidationError as exc:
        # A single bad measurement (a wall 0.2 cm long, a point past the
        # coordinate limit) loses its own operation and nothing else.
        return f"No se pudo aplicar {operation.op.value}: {_first_message(exc)}"


# --- walls -----------------------------------------------------------------


def _reset(draft: _Draft, _: PlanOperation) -> None:
    draft.walls.clear()
    draft.openings.clear()
    draft.rooms.clear()
    draft.renamed.clear()
    return None


def _add_wall(draft: _Draft, operation: PlanOperation) -> str | None:
    if len(draft.walls) >= MAX_WALLS:
        return f"El plano ya tiene el máximo de {MAX_WALLS} paredes."

    wall = Wall(
        id=_claim_id(draft, operation.id, "wall"),
        a=operation.a,  # type: ignore[arg-type]  # required by the schema validator
        b=operation.b,  # type: ignore[arg-type]
        **({"thickness": operation.thickness} if operation.thickness else {}),
    )

    draft.walls.append(wall)
    return None


def _update_wall(draft: _Draft, operation: PlanOperation) -> str | None:
    index = _index_of(draft.walls, draft.resolve(operation.id))
    if index is None:
        return f"No existe la pared {operation.id!r}."

    current = draft.walls[index]
    draft.walls[index] = current.model_copy(
        update=_patch(operation, ("a", "b", "thickness"))
    )
    # `model_copy` skips validation, so the new geometry is checked explicitly.
    Wall.model_validate(draft.walls[index].model_dump())
    return None


def _remove_wall(draft: _Draft, operation: PlanOperation) -> str | None:
    wall_id = draft.resolve(operation.id)
    index = _index_of(draft.walls, wall_id)
    if index is None:
        return f"No existe la pared {operation.id!r}."

    draft.walls.pop(index)
    # An opening without its wall is not a layout: the doors and windows of a
    # demolished wall go with it.
    draft.openings = [
        opening for opening in draft.openings if opening.wall_id != wall_id
    ]
    return None


# --- openings ---------------------------------------------------------------


def _add_opening(draft: _Draft, operation: PlanOperation) -> str | None:
    if len(draft.openings) >= MAX_OPENINGS:
        return f"El plano ya tiene el máximo de {MAX_OPENINGS} aberturas."

    wall_id = draft.resolve(operation.wall_id)
    if _index_of(draft.walls, wall_id) is None:
        return f"No existe la pared {operation.wall_id!r} para poner la abertura."

    kind = operation.kind or "door"

    opening = Opening(
        id=_claim_id(draft, operation.id, "opening"),
        wall_id=wall_id,  # type: ignore[arg-type]
        kind=kind,
        position=operation.position,  # type: ignore[arg-type]
        width=operation.width or DEFAULT_OPENING_WIDTH[kind],
        flipped=bool(operation.flipped),
    )

    draft.openings.append(opening)
    return None


def _update_opening(draft: _Draft, operation: PlanOperation) -> str | None:
    index = _index_of(draft.openings, draft.resolve(operation.id))
    if index is None:
        return f"No existe la abertura {operation.id!r}."

    patch = _patch(operation, ("wall_id", "kind", "position", "width", "flipped"))

    if "wall_id" in patch:
        moved_to = draft.resolve(patch["wall_id"])
        if _index_of(draft.walls, moved_to) is None:
            return f"No existe la pared {patch['wall_id']!r} para mover la abertura."
        patch["wall_id"] = moved_to

    draft.openings[index] = draft.openings[index].model_copy(update=patch)
    Opening.model_validate(draft.openings[index].model_dump())
    return None


def _remove_opening(draft: _Draft, operation: PlanOperation) -> str | None:
    index = _index_of(draft.openings, draft.resolve(operation.id))
    if index is None:
        return f"No existe la abertura {operation.id!r}."

    draft.openings.pop(index)
    return None


# --- rooms -------------------------------------------------------------------


def _add_room(draft: _Draft, operation: PlanOperation) -> str | None:
    if len(draft.rooms) >= MAX_ROOMS:
        return f"El plano ya tiene el máximo de {MAX_ROOMS} ambientes."

    draft.rooms.append(
        Room(
            id=_claim_id(draft, operation.id, "room"),
            name=operation.name,  # type: ignore[arg-type]
            points=operation.points,  # type: ignore[arg-type]
        )
    )
    return None


def _update_room(draft: _Draft, operation: PlanOperation) -> str | None:
    index = _index_of(draft.rooms, draft.resolve(operation.id))
    if index is None:
        return f"No existe el ambiente {operation.id!r}."

    draft.rooms[index] = draft.rooms[index].model_copy(
        update=_patch(operation, ("name", "points"))
    )
    Room.model_validate(draft.rooms[index].model_dump())
    return None


def _remove_room(draft: _Draft, operation: PlanOperation) -> str | None:
    index = _index_of(draft.rooms, draft.resolve(operation.id))
    if index is None:
        return f"No existe el ambiente {operation.id!r}."

    draft.rooms.pop(index)
    return None


# --- helpers -----------------------------------------------------------------


def _claim_id(draft: _Draft, proposed: str | None, entity: str) -> str:
    """
    The id a new entity gets.

    The model's own id is honoured whenever it is free, because the operations
    that follow in the same answer reference it ("add_wall w1", then
    "add_opening on w1"). When it is taken, a fresh one is generated and the
    rename is remembered so those later references still land.
    """
    prefix = _PREFIXES[entity]
    taken = draft.taken()

    if proposed and proposed not in taken:
        return proposed

    generated = new_id(prefix)
    while generated in taken:
        generated = new_id(prefix)

    if proposed:
        draft.renamed[proposed] = generated

    return generated


def _index_of(
    items: list[Wall] | list[Opening] | list[Room], entity_id: str | None
) -> int | None:
    if entity_id is None:
        return None
    return next(
        (index for index, item in enumerate(items) if item.id == entity_id), None
    )


def _patch(operation: PlanOperation, fields: tuple[str, ...]) -> dict[str, Any]:
    """The fields of an `update_*` the model actually set."""
    return {
        name: value
        for name in fields
        if (value := getattr(operation, name)) is not None
    }


def _first_message(exc: ValidationError) -> str:
    error = exc.errors()[0]
    return error.get("msg", "dato inválido").removeprefix("Value error, ")
