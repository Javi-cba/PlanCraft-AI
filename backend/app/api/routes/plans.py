"""
Plan endpoints. Creation and listing are nested under the floor
(`/floors/{floor_id}/plans`); the rest addresses the plan directly.

Routes only validate and delegate; the logic lives in
`app/services/plan_service.py`.

Security: the service walks plan → floor → project → owner in one query, so a
plan of somebody else's project answers 404.
"""

from uuid import UUID

from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUserId, DbSession
from app.db.models.plan import Plan
from app.schemas.plan import PlanCreate, PlanRead, PlanUpdate
from app.services import plan_service

router = APIRouter(tags=["plans"])


@router.post(
    "/floors/{floor_id}/plans",
    response_model=PlanRead,
    status_code=status.HTTP_201_CREATED,
)
def create_plan(
    floor_id: UUID,
    data: PlanCreate,
    external_user_id: CurrentUserId,
    db: DbSession,
) -> Plan:
    """Creates a plan on a floor of the signed-in user."""
    return plan_service.create_plan(db, external_user_id, floor_id, data)


@router.get("/floors/{floor_id}/plans", response_model=list[PlanRead])
def list_plans(
    floor_id: UUID,
    external_user_id: CurrentUserId,
    db: DbSession,
) -> list[Plan]:
    """Every plan of a floor, oldest first. Not paginated: a floor has a few."""
    return list(plan_service.list_plans(db, external_user_id, floor_id))


@router.get("/plans/{plan_id}", response_model=PlanRead)
def get_plan(
    plan_id: UUID,
    external_user_id: CurrentUserId,
    db: DbSession,
) -> Plan:
    """One plan of the signed-in user."""
    return plan_service.get_owned_plan(db, external_user_id, plan_id)


@router.patch("/plans/{plan_id}", response_model=PlanRead)
def update_plan(
    plan_id: UUID,
    data: PlanUpdate,
    external_user_id: CurrentUserId,
    db: DbSession,
) -> Plan:
    """Renames a plan, changes its installation or stores its canvas state."""
    return plan_service.update_plan(db, external_user_id, plan_id, data)


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan(
    plan_id: UUID,
    external_user_id: CurrentUserId,
    db: DbSession,
) -> Response:
    """Deletes a plan and, by cascade, the elements placed on it."""
    plan_service.delete_plan(db, external_user_id, plan_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
