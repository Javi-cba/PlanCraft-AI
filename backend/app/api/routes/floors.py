"""
Floor endpoints, nested under a project: /projects/{project_id}/floors.
Routes only validate and delegate; the logic lives in
`app/services/floor_service.py`.

Security: `external_user_id` comes from `CurrentUserId`, and the service checks
the project belongs to that user before creating anything inside it.
"""

from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import CurrentUserId, DbSession
from app.db.models.floor import Floor
from app.schemas.floor import FloorCreate, FloorRead
from app.services import floor_service

router = APIRouter(prefix="/projects", tags=["floors"])


@router.post(
    "/{project_id}/floors", response_model=FloorRead, status_code=status.HTTP_201_CREATED
)
def create_floor(
    project_id: UUID,
    data: FloorCreate,
    external_user_id: CurrentUserId,
    db: DbSession,
) -> Floor:
    """Creates a floor in a project of the signed-in user."""
    return floor_service.create_floor(db, external_user_id, project_id, data)
