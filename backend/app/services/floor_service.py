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
from sqlalchemy.orm import Session, selectinload

from app.db.models.floor import Floor
from app.db.models.project import Project
from app.lib.errors import ConflictError, NotFoundError
from app.schemas.floor import FloorCreate, FloorUpdate
from app.schemas.layout import Layout
from app.services import project_service

logger = logging.getLogger(__name__)


def create_floor(
    db: Session,
    external_user_id: str,
    project_id: uuid.UUID,
    data: FloorCreate,
) -> Floor:
    """
    Creates a floor inside a project the caller owns. Raises otherwise.

    The layout travels with the request, so picking a template and creating the
    floor is a single write instead of "create blank, then save the drawing".
    """
    # Ownership first: a project that is not this user's never gets here.
    project = project_service.get_owned_project(db, external_user_id, project_id)

    floor = Floor(
        project_id=project.id,
        name=data.name,
        level=data.level,
        layout=data.layout.model_dump(),
    )

    db.add(floor)
    _commit(db, "creating a floor in project", project.id)

    db.refresh(floor)
    return floor


def get_owned_floor(
    db: Session,
    external_user_id: str,
    floor_id: uuid.UUID,
    *,
    with_plans: bool = False,
) -> Floor:
    """
    The floor, only if its project belongs to this user.

    One query joining `projects` does the whole chain: no floor of anybody
    else's project can come back, and a miss is a 404 like above.
    """
    statement = (
        select(Floor)
        .join(Project, Floor.project_id == Project.id)
        .where(
            Floor.id == floor_id,
            Project.external_user_id == external_user_id,
        )
    )

    if with_plans:
        statement = statement.options(selectinload(Floor.plans))

    floor = db.scalars(statement).first()

    if floor is None:
        raise NotFoundError("No encontramos el piso.", code="FLOOR_NOT_FOUND")

    return floor


def update_floor(
    db: Session,
    external_user_id: str,
    floor_id: uuid.UUID,
    data: FloorUpdate,
) -> Floor:
    """Renames a floor or moves it to another level. Only the fields sent."""
    floor = get_owned_floor(db, external_user_id, floor_id, with_plans=True)

    # `exclude_unset` is what makes this a PATCH: a field the client left out
    # keeps its value instead of being overwritten with the schema's default.
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(floor, field, value)

    _commit(db, "updating floor", floor.id)

    db.refresh(floor)
    return floor


def replace_layout(
    db: Session,
    external_user_id: str,
    floor_id: uuid.UUID,
    layout: Layout,
) -> Floor:
    """
    Overwrites the drawing of a floor with the one the editor holds.

    Whole-document replacement, not a merge: the editor always has the complete
    layout, and two tabs saving in turn should end on the last one saved rather
    than on a silent union of both.
    """
    floor = get_owned_floor(db, external_user_id, floor_id, with_plans=True)

    floor.layout = layout.model_dump()

    _commit(db, "saving the layout of floor", floor.id)

    db.refresh(floor)
    return floor


def delete_floor(db: Session, external_user_id: str, floor_id: uuid.UUID) -> None:
    """
    Deletes a floor and, by cascade, its plans and their elements.

    Deleting the last floor of a project is allowed: the project page can create
    another one, and refusing would strand anybody who wants to start over.
    """
    floor = get_owned_floor(db, external_user_id, floor_id)

    db.delete(floor)
    _commit(db, "deleting floor", floor.id)


def _commit(db: Session, action: str, subject: uuid.UUID) -> None:
    """Commits, or turns the integrity error into the API's conflict shape."""
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning("Integrity error %s %s: %s", action, subject, exc.orig)
        raise ConflictError(
            "No pudimos guardar el piso: los datos chocan con otro registro.",
            code="FLOOR_CONFLICT",
        ) from exc
