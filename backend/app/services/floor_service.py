"""
Business logic for floors. Same shape as `project_service`: the only layer that
talks to `db/`, and `external_user_id` always arrives from the verified token.

Nothing here trusts an id from the URL: a floor is only created inside a project
the caller owns, and `get_owned_floor` is what the resources nested under a
floor (plans) use to continue the ownership chain.
"""

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models.floor import Floor
from app.db.models.project import Project
from app.lib.errors import ConflictError, NotFoundError
from app.schemas.floor import FloorCreate
from app.services import project_service

logger = logging.getLogger(__name__)


def create_floor(
    db: Session,
    external_user_id: str,
    project_id: uuid.UUID,
    data: FloorCreate,
) -> Floor:
    """Creates a floor inside a project the caller owns. Raises otherwise."""
    # Ownership first: a project that is not this user's never gets here.
    project = project_service.get_owned_project(db, external_user_id, project_id)

    floor = Floor(project_id=project.id, name=data.name, level=data.level)

    db.add(floor)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning(
            "Integrity error creating a floor in project %s: %s", project.id, exc.orig
        )
        raise ConflictError(
            "No pudimos guardar el piso: ya existe uno igual o los datos chocan "
            "con otro registro.",
            code="FLOOR_CONFLICT",
        ) from exc

    db.refresh(floor)
    return floor


def get_owned_floor(db: Session, external_user_id: str, floor_id: uuid.UUID) -> Floor:
    """
    The floor, only if its project belongs to this user.

    One query joining `projects` does the whole chain: no floor of anybody
    else's project can come back, and a miss is a 404 like above.
    """
    floor = db.scalars(
        select(Floor)
        .join(Project, Floor.project_id == Project.id)
        .where(
            Floor.id == floor_id,
            Project.external_user_id == external_user_id,
        )
    ).first()

    if floor is None:
        raise NotFoundError("No encontramos el piso.", code="FLOOR_NOT_FOUND")

    return floor
