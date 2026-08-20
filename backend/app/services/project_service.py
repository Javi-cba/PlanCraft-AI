"""
Business logic for projects. The only layer that talks to `db/`.

`external_user_id` always arrives as an argument, resolved by
`get_current_user` from the verified Clerk token. No function here reads it
from a request body or a query parameter.
"""

import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models.project import Project
from app.lib.errors import ConflictError
from app.schemas.project import ProjectCreate

logger = logging.getLogger(__name__)


def create_project(db: Session, external_user_id: str, data: ProjectCreate) -> Project:
    """Persists a new project owned by `external_user_id`."""
    project = Project(
        external_user_id=external_user_id,
        name=data.name,
        description=data.description,
    )

    db.add(project)

    try:
        db.commit()
    except IntegrityError as exc:
        # No unique constraint on `projects` today, so this is a safety net for
        # the ones that will come (a per-user unique name, for instance). The
        # rollback matters: without it the session stays unusable.
        db.rollback()
        logger.warning(
            "Integrity error creating a project for %s: %s", external_user_id, exc.orig
        )
        raise ConflictError(
            "No pudimos guardar el proyecto: ya existe uno igual o los datos "
            "chocan con otro registro.",
            code="PROJECT_CONFLICT",
        ) from exc

    # Brings back what the database generated (id, created_at, updated_at).
    db.refresh(project)
    return project


def list_projects(db: Session, external_user_id: str) -> list[Project]:
    """Projects owned by this user, newest first. Never anybody else's."""
    statement = (
        select(Project)
        .where(Project.external_user_id == external_user_id)
        .order_by(Project.created_at.desc())
    )
    return list(db.scalars(statement))
