"""
Project endpoints. Routes only validate and delegate: the logic lives in
`app/services/project_service.py`.

Security: `external_user_id` comes from `CurrentUserId` (the verified Clerk
token) on every route. It is never accepted from the body or the query string —
`ProjectCreate` rejects it outright with `extra="forbid"`.
"""

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUserId, DbSession
from app.db.models.project import Project
from app.lib.responses import Page
from app.schemas.project import ProjectCreate, ProjectListParams, ProjectRead
from app.services import project_service

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate,
    external_user_id: CurrentUserId,
    db: DbSession,
) -> Project:
    """Creates a project — with its first floor and plan — for the signed-in user."""
    return project_service.create_project(db, external_user_id, data)


@router.get("", response_model=Page[ProjectRead])
def list_projects(
    params: Annotated[ProjectListParams, Query()],
    external_user_id: CurrentUserId,
    db: DbSession,
) -> Page[ProjectRead]:
    """One page of the signed-in user's projects. See `ProjectListParams`."""
    items, total = project_service.list_projects(db, external_user_id, params)

    return Page[ProjectRead](
        items=items,  # type: ignore[arg-type]  # validated from the ORM objects
        total=total,
        limit=params.limit,
        offset=params.offset,
    )
