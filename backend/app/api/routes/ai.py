"""
AI assistant endpoints.

The assistant draws and edits the layout of a floor from plain language. It is
addressed under the floor (`/ai/floors/{floor_id}/plan`) because a plan only
means something on a storey, and the ownership chain floor → project → owner is
what authorizes the call.

These are the only endpoints in the API that cost money per request, so they are
also the only ones behind a rate limit (`app/lib/rate_limit.py`): over the
allowance they answer 429 with `Retry-After`, never a call to the gateway.

Routes only validate and delegate; the logic lives in
`app/services/ai_service.py`.
"""

from uuid import UUID

from fastapi import APIRouter, status

from app.ai import provider
from app.api.deps import CurrentUserId, DbSession
from app.core.config import get_settings
from app.db.models.conversation import Conversation
from app.schemas.ai import (
    AiStatusRead,
    AiUsage,
    ConversationRead,
    CreatedFloorRead,
    PlanAssistRequest,
    PlanAssistResponse,
)
from app.schemas.layout import Layout, summarize_layout
from app.services import ai_service

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/status", response_model=AiStatusRead)
def get_status(_: CurrentUserId) -> AiStatusRead:
    """
    Whether the assistant is usable, and how many requests a minute it allows.

    The editor asks on mount: with no credential configured it hides the panel
    instead of offering a button that is guaranteed to fail.
    """
    settings = get_settings()

    return AiStatusRead(
        configured=provider.is_configured(),
        model=provider.resolve_model(),
        user_requests_per_minute=settings.ai_user_requests_per_minute,
    )


@router.post(
    "/floors/{floor_id}/plan",
    response_model=PlanAssistResponse,
    status_code=status.HTTP_200_OK,
)
def assist_plan(
    floor_id: UUID,
    data: PlanAssistRequest,
    external_user_id: CurrentUserId,
    db: DbSession,
) -> PlanAssistResponse:
    """
    One turn with the assistant: a message in, the resulting drawing out.

    Works the same whether the floor is empty (it draws it) or already has walls
    (it edits them) — the request always carries the layout the person is
    looking at, unsaved changes included.

    Nothing is persisted on **this** floor: the editor applies the returned
    layout to its undo stack and the person saves it with
    `PUT /floors/{floor_id}/layout`.

    Asking for another storey ("hacé el ático") is the one exception. That is
    not an edit of the floor on screen, so it comes back in `created_floors`,
    already saved — a new floor has nowhere to sit on an undo stack that holds a
    single drawing.
    """
    turn = ai_service.run_plan_turn(db, external_user_id, floor_id, data)

    return PlanAssistResponse(
        conversation_id=turn.conversation.id,
        message_id=turn.message.id,
        summary=turn.summary,
        layout=turn.edit.layout,
        summary_of_layout=summarize_layout(turn.edit.layout),
        applied=turn.edit.applied,
        skipped=turn.edit.skipped,
        created_floors=[
            CreatedFloorRead(
                id=created.id,
                name=created.name,
                level=created.level,
                summary=summarize_layout(Layout.model_validate(created.layout or {})),
            )
            for created in turn.created_floors
        ],
        usage=AiUsage(
            model=turn.model,
            input_tokens=turn.input_tokens,
            output_tokens=turn.output_tokens,
        ),
    )


@router.get("/floors/{floor_id}/conversation", response_model=ConversationRead | None)
def get_floor_conversation(
    floor_id: UUID,
    external_user_id: CurrentUserId,
    db: DbSession,
) -> Conversation | None:
    """
    The thread of this floor, so reopening the editor restores the chat.

    `null` when the assistant has never been used here — a floor drawn by hand
    has no conversation, and that is not a 404.
    """
    return ai_service.get_floor_conversation(db, external_user_id, floor_id)


@router.get("/conversations/{conversation_id}", response_model=ConversationRead)
def get_conversation(
    conversation_id: UUID,
    external_user_id: CurrentUserId,
    db: DbSession,
) -> Conversation:
    """One thread with all of its turns, oldest first."""
    return ai_service.get_owned_conversation(db, external_user_id, conversation_id)
