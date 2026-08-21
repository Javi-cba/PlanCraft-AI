"""
Plan endpoints, nested under a floor: /floors/{floor_id}/plans.
Routes only validate and delegate; the logic lives in
`app/services/plan_service.py`.

Security: the service walks floor → project → owner before writing, so a floor
of somebody else's project answers 404.
"""

from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import CurrentUserId, DbSession
from app.db.models.plan import Plan
from app.schemas.plan import PlanCreate, PlanRead
from app.services import plan_service

router = APIRouter(prefix="/floors", tags=["plans"])


@router.post(
    "/{floor_id}/plans", response_model=PlanRead, status_code=status.HTTP_201_CREATED
)
def create_plan(
    floor_id: UUID,
    data: PlanCreate,
    external_user_id: CurrentUserId,
    db: DbSession,
) -> Plan:
    """Creates a plan on a floor of the signed-in user."""
    return plan_service.create_plan(db, external_user_id, floor_id, data)
