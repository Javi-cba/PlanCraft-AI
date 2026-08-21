"""
Project endpoints. Routes only validate and delegate: the logic lives in
`app/services/project_service.py`.

Security: `external_user_id` comes from `CurrentUserId` (the verified Clerk
token) on every route. It is never accepted from the body or the query string —
`ProjectCreate` rejects it outright with `extra="forbid"`.
"""

from fastapi import APIRouter, status

from app.api.deps import CurrentUserId, DbSession
from app.db.models.project import Project
from app.schemas.project import ProjectCreate, ProjectRead
from app.services import project_service

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate,
    external_user_id: CurrentUserId,
    db: DbSession,
) -> Project:
    """Creates a project owned by the signed-in user."""
    return project_service.create_project(db, external_user_id, data)


@router.get("", response_model=list[ProjectRead])
def list_projects(external_user_id: CurrentUserId, db: DbSession) -> list[Project]:
    """Projects of the signed-in user. Pagination comes with `lib/responses.Page`."""
    return project_service.list_projects(db, external_user_id)
