"""
Business logic for plans. Same shape as `project_service` and `floor_service`.

The ownership chain is plan → floor → project → owner: `get_owned_plan` runs
the whole check in one query before anything is read or written.
"""

import logging
import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models.floor import Floor
from app.db.models.plan import InstallationType, Plan
from app.db.models.project import Project
from app.lib.errors import ConflictError, NotFoundError, ValidationAppError
from app.schemas.plan import PlanCreate, PlanUpdate
from app.services import floor_service

logger = logging.getLogger(__name__)


def create_plan(
    db: Session,
    external_user_id: str,
    floor_id: uuid.UUID,
    data: PlanCreate,
) -> Plan:
    """Creates a plan on a floor whose project the caller owns."""
    floor = floor_service.get_owned_floor(db, external_user_id, floor_id)

    plan = Plan(
        floor_id=floor.id,
        name=data.name,
        installation_type=parse_installation_type(data.installation_type),
        canvas_meta=data.canvas_meta,
    )

    db.add(plan)
    _commit(db, "creating a plan on floor", floor.id)

    db.refresh(plan)
    return plan


def list_plans(
    db: Session, external_user_id: str, floor_id: uuid.UUID
) -> Sequence[Plan]:
    """Every plan of a floor the caller owns, oldest first."""
    floor = floor_service.get_owned_floor(db, external_user_id, floor_id)

    return db.scalars(
        select(Plan).where(Plan.floor_id == floor.id).order_by(Plan.created_at.asc())
    ).all()


def get_owned_plan(db: Session, external_user_id: str, plan_id: uuid.UUID) -> Plan:
    """
    The plan, only if the project above it belongs to this user.

    Two joins walk plan → floor → project in a single query, so a plan of
    somebody else's project is never selected and answers 404, not 403.
    """
    plan = db.scalars(
        select(Plan)
        .join(Floor, Plan.floor_id == Floor.id)
        .join(Project, Floor.project_id == Project.id)
        .where(
            Plan.id == plan_id,
            Project.external_user_id == external_user_id,
        )
    ).first()

    if plan is None:
        raise NotFoundError("No encontramos el plano.", code="PLAN_NOT_FOUND")

    return plan


def update_plan(
    db: Session,
    external_user_id: str,
    plan_id: uuid.UUID,
    data: PlanUpdate,
) -> Plan:
    """Renames a plan, changes its installation or stores its canvas state."""
    plan = get_owned_plan(db, external_user_id, plan_id)

    changes = data.model_dump(exclude_unset=True)
    if "installation_type" in changes:
        changes["installation_type"] = parse_installation_type(
            changes["installation_type"]
        )

    for field, value in changes.items():
        setattr(plan, field, value)

    _commit(db, "updating plan", plan.id)

    db.refresh(plan)
    return plan


def delete_plan(db: Session, external_user_id: str, plan_id: uuid.UUID) -> None:
    """Deletes a plan and, by cascade, the elements placed on it."""
    plan = get_owned_plan(db, external_user_id, plan_id)

    db.delete(plan)
    _commit(db, "deleting plan", plan.id)


def parse_installation_type(value: InstallationType | str) -> InstallationType:
    """
    Normalizes the installation type against the enum.

    Over HTTP `PlanCreate` already rejects an unknown value (422
    VALIDATION_ERROR with the field in `details`). This keeps the same answer
    for the other callers of the service — `ai_service`, scripts, a job — which
    hand over plain strings.
    """
    try:
        return InstallationType(value)
    except ValueError as exc:
        raise ValidationAppError(
            "El tipo de instalación no es válido.",
            code="INVALID_INSTALLATION_TYPE",
            details={
                "installation_type": str(value),
                "allowed": [member.value for member in InstallationType],
            },
        ) from exc


def _commit(db: Session, action: str, subject: uuid.UUID) -> None:
    """Commits, or turns the integrity error into the API's conflict shape."""
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning("Integrity error %s %s: %s", action, subject, exc.orig)
        raise ConflictError(
            "No pudimos guardar el plano: los datos chocan con otro registro.",
            code="PLAN_CONFLICT",
        ) from exc
