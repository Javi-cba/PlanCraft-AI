"""
Business logic for plans. Same shape as `project_service` and `floor_service`.

The ownership chain is plan → floor → project → owner: `get_owned_floor` runs
the whole check in one query before anything is written.
"""

import logging
import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models.plan import InstallationType, Plan
from app.lib.errors import ConflictError, ValidationAppError
from app.schemas.plan import PlanCreate
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

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning(
            "Integrity error creating a plan on floor %s: %s", floor.id, exc.orig
        )
        raise ConflictError(
            "No pudimos guardar el plano: ya existe uno igual o los datos chocan "
            "con otro registro.",
            code="PLAN_CONFLICT",
        ) from exc

    db.refresh(plan)
    return plan


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
