"""
Floor endpoints. Creation is nested under its project
(`/projects/{project_id}/floors`); everything else addresses the floor directly
(`/floors/{floor_id}`), because once you have the id the parent adds nothing.

Routes only validate and delegate; the logic lives in
`app/services/floor_service.py`.

Security: `external_user_id` comes from `CurrentUserId`, and the service walks
floor → project → owner before reading or writing anything.
"""

from uuid import UUID

from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUserId, DbSession
from app.db.models.floor import Floor
from app.schemas.floor import (
    FloorCreate,
    FloorDetailRead,
    FloorLayoutUpdate,
    FloorRead,
    FloorUpdate,
    FloorWithPlansRead,
)
from app.services import floor_service

router = APIRouter(tags=["floors"])


@router.post(
    "/projects/{project_id}/floors",
    response_model=FloorRead,
    status_code=status.HTTP_201_CREATED,
)
def create_floor(
    project_id: UUID,
    data: FloorCreate,
    external_user_id: CurrentUserId,
    db: DbSession,
) -> Floor:
    """Creates a floor in a project of the signed-in user, template included."""
    return floor_service.create_floor(db, external_user_id, project_id, data)


@router.get("/floors/{floor_id}", response_model=FloorDetailRead)
def get_floor(
    floor_id: UUID,
    external_user_id: CurrentUserId,
    db: DbSession,
) -> Floor:
    """The floor with its layout and its plans. What the editor opens with."""
    return floor_service.get_owned_floor(db, external_user_id, floor_id, with_plans=True)


@router.patch("/floors/{floor_id}", response_model=FloorWithPlansRead)
def update_floor(
    floor_id: UUID,
    data: FloorUpdate,
    external_user_id: CurrentUserId,
    db: DbSession,
) -> Floor:
    """Renames a floor or moves it to another level."""
    return floor_service.update_floor(db, external_user_id, floor_id, data)


@router.put("/floors/{floor_id}/layout", response_model=FloorDetailRead)
def replace_floor_layout(
    floor_id: UUID,
    data: FloorLayoutUpdate,
    external_user_id: CurrentUserId,
    db: DbSession,
) -> Floor:
    """Saves the drawing of a floor: walls, openings and rooms, whole."""
    return floor_service.replace_layout(db, external_user_id, floor_id, data.layout)


@router.delete("/floors/{floor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_floor(
    floor_id: UUID,
    external_user_id: CurrentUserId,
    db: DbSession,
) -> Response:
    """Deletes a floor and, by cascade, its plans."""
    floor_service.delete_floor(db, external_user_id, floor_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
