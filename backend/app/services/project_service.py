"""
Business logic for projects. The only layer that talks to `db/`.

`external_user_id` always arrives as an argument, resolved by
`get_current_user` from the verified Clerk token. No function here reads it
from a request body or a query parameter.
"""

import logging
import uuid
from collections.abc import Sequence

from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models.floor import Floor
from app.db.models.plan import InstallationType, Plan
from app.db.models.project import Project
from app.lib.errors import ConflictError, NotFoundError
from app.schemas.project import ProjectCreate, ProjectListParams, ProjectSort

logger = logging.getLogger(__name__)

# A new project is born ready to open: one floor with one plan on it.
INITIAL_FLOOR_NAME = "Planta Baja"
INSTALLATION_LABELS = {
    InstallationType.ELECTRICAL: "Eléctrica",
    InstallationType.SANITARY: "Sanitaria",
    InstallationType.GAS: "Gas",
}

# Escape character for LIKE patterns: "!" keeps the pattern readable in logs,
# where a backslash would have to be doubled.
_LIKE_ESCAPE = "!"

_ORDER_BY = {
    # The id breaks ties, so two projects created in the same millisecond do not
    # swap places between pages.
    ProjectSort.RECENT: (Project.created_at.desc(), Project.id.desc()),
    ProjectSort.OLDEST: (Project.created_at.asc(), Project.id.asc()),
    ProjectSort.NAME: (func.lower(Project.name).asc(), Project.id.asc()),
}


def create_project(db: Session, external_user_id: str, data: ProjectCreate) -> Project:
    """
    Creates a project together with its first floor and plan, in one commit.

    A project with no floor and no plan cannot be opened in the editor, so the
    scaffold is part of creating it instead of two follow-up calls the UI would
    have to chase (and undo by hand if the second one failed).
    """
    project = Project(
        external_user_id=external_user_id,
        name=data.name,
        description=data.description,
    )
    floor = Floor(project=project, name=INITIAL_FLOOR_NAME, level=0)
    Plan(
        floor=floor,
        name=f"{INSTALLATION_LABELS[data.installation_type]} — {INITIAL_FLOOR_NAME}",
        installation_type=data.installation_type,
        canvas_meta={},
    )

    # The relationships cascade the floor and the plan into the same INSERT
    # batch, so the three rows land in a single transaction.
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


def get_owned_project(
    db: Session, external_user_id: str, project_id: uuid.UUID
) -> Project:
    """
    The project, only if this user owns it. Every nested resource starts here.

    Somebody else's project answers 404 and not 403 on purpose: a 403 would
    confirm the id exists, which is more than the caller should learn. The
    owner is part of the WHERE clause, so a row that is not theirs is simply
    never selected.
    """
    project = db.scalars(
        select(Project).where(
            Project.id == project_id,
            Project.external_user_id == external_user_id,
        )
    ).first()

    if project is None:
        raise NotFoundError("No encontramos el proyecto.", code="PROJECT_NOT_FOUND")

    return project


def list_projects(
    db: Session, external_user_id: str, params: ProjectListParams
) -> tuple[Sequence[Project], int]:
    """
    One page of this user's projects, plus how many match in total.

    The owner is always the first condition, so no filter or ordering the client
    sends can widen the result beyond their own rows.
    """
    conditions: list[ColumnElement[bool]] = [
        Project.external_user_id == external_user_id
    ]

    if params.q:
        pattern = f"%{_escape_like(params.q)}%"
        conditions.append(
            or_(
                Project.name.ilike(pattern, escape=_LIKE_ESCAPE),
                Project.description.ilike(pattern, escape=_LIKE_ESCAPE),
            )
        )

    total = db.scalar(select(func.count()).select_from(Project).where(*conditions)) or 0

    items = db.scalars(
        select(Project)
        .where(*conditions)
        .order_by(*_ORDER_BY[params.sort])
        .limit(params.limit)
        .offset(params.offset)
    ).all()

    return items, total


def _escape_like(value: str) -> str:
    """Neutralizes the LIKE wildcards, so searching "100%" finds "100%"."""
    for character in (_LIKE_ESCAPE, "%", "_"):
        value = value.replace(character, f"{_LIKE_ESCAPE}{character}")
    return value
