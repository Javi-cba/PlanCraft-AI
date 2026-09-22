"""
Business logic for the plan assistant.

The flow of one turn: check the caller owns the floor, check the allowance, load
the thread, ask the model, apply what it answered, store both sides of the
exchange, return the resulting drawing.

Two decisions worth keeping in mind:

* **This service never writes `floors.layout`.** It returns the layout the edit
  produces and the editor applies it to its undo stack, so an answer nobody
  likes is one ⌘Z away. Saving stays where it always was: `PUT /floors/{id}/layout`.
* **The layout arrives with the request.** Reading it from the database would
  make the assistant edit the last *saved* drawing, not the one on screen.

Like every other service here, `external_user_id` comes from the verified token
and the ownership chain is walked before anything is read or written.
"""

import logging
import uuid
from dataclasses import dataclass, field

from anthropic import APIError
from instructor.core import InstructorRetryException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.ai import prompts, provider
from app.ai.operations import AppliedEdit, apply_operations
from app.ai.prompts import FloorContext
from app.ai.schemas import NewFloor, PlanEdit
from app.core.config import get_settings
from app.db.models.conversation import Conversation
from app.db.models.floor import Floor
from app.db.models.message import Message, MessageRole
from app.lib.errors import (
    ConflictError,
    ExternalServiceError,
    NotFoundError,
    TooManyRequestsError,
)
from app.lib.rate_limit import ai_rate_limiter
from app.schemas.ai import PlanAssistRequest
from app.schemas.floor import FLOOR_MAX_LEVEL, FloorCreate
from app.schemas.layout import Layout
from app.services import floor_service

logger = logging.getLogger(__name__)

# A thread's title is the first thing the user asked for, trimmed to fit.
TITLE_MAX_LENGTH = 120


@dataclass
class AssistantTurn:
    """Everything one exchange produced."""

    conversation: Conversation
    message: Message
    edit: AppliedEdit
    summary: str
    input_tokens: int
    output_tokens: int
    model: str
    # Storeys added to the project by this turn. Unlike the layout, these are
    # persisted here and now — a new floor cannot live on the editor's undo
    # stack, which only holds the drawing of the floor that is open.
    created_floors: list[Floor] = field(default_factory=list)


def run_plan_turn(
    db: Session,
    external_user_id: str,
    floor_id: uuid.UUID,
    data: PlanAssistRequest,
) -> AssistantTurn:
    """One message to the assistant, from ownership check to persisted answer."""
    # Ownership first. A floor that is not this user's never reaches the gateway,
    # which also means it can never spend their quota.
    floor = floor_service.get_owned_floor(db, external_user_id, floor_id)

    _enforce_rate_limit(external_user_id)

    conversation = _resolve_conversation(
        db, external_user_id, floor, data.conversation_id, data.message
    )

    siblings = _sibling_floors(db, floor)

    edit, answer, usage = _ask_model(
        history=_replay(conversation),
        layout=data.layout,
        request=data.message,
        current=FloorContext(floor.name, floor.level, data.layout),
        others=siblings,
    )

    created = _create_floors(db, external_user_id, floor, answer.new_floors, siblings)

    message = _record_exchange(
        db,
        conversation=conversation,
        prompt=data.message,
        summary=answer.summary,
        edit=edit,
        usage=usage,
        created=created,
    )

    return AssistantTurn(
        conversation=conversation,
        message=message,
        edit=edit,
        summary=answer.summary,
        input_tokens=usage[0],
        output_tokens=usage[1],
        model=usage[2],
        created_floors=created,
    )


def get_owned_conversation(
    db: Session,
    external_user_id: str,
    conversation_id: uuid.UUID,
) -> Conversation:
    """A thread with its messages, only if it belongs to this user."""
    conversation = db.scalars(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.external_user_id == external_user_id,
        )
        .options(selectinload(Conversation.messages))
    ).first()

    if conversation is None:
        raise NotFoundError(
            "No encontramos la conversación.", code="CONVERSATION_NOT_FOUND"
        )

    return conversation


def get_floor_conversation(
    db: Session,
    external_user_id: str,
    floor_id: uuid.UUID,
) -> Conversation | None:
    """
    The thread of a floor, or `None` when nobody has asked the assistant yet.

    `None` is not an error: the editor calls this on mount to restore the chat,
    and a floor drawn entirely by hand simply has no thread.
    """
    floor = floor_service.get_owned_floor(db, external_user_id, floor_id)

    return db.scalars(
        select(Conversation)
        .where(
            Conversation.floor_id == floor.id,
            Conversation.external_user_id == external_user_id,
        )
        .options(selectinload(Conversation.messages))
        # A floor should have one thread; ordering makes "the newest" defined
        # even if an older client managed to create two.
        .order_by(Conversation.created_at.desc())
    ).first()


# --- the model ---------------------------------------------------------------


def _ask_model(
    *,
    history: list[dict[str, str]],
    layout: Layout,
    request: str,
    current: FloorContext,
    others: list[FloorContext],
) -> tuple[AppliedEdit, PlanEdit, tuple[int, int, str]]:
    """
    Sends the turn and applies the answer. Everything upstream-shaped is
    translated into this API's errors before it leaves.
    """
    settings = get_settings()
    client = provider.get_client()
    model = provider.resolve_model()

    turn = prompts.build_turn(layout, request, current=current, others=others)
    messages = [*history, {"role": "user", "content": turn}]

    try:
        edit, completion = client.messages.create_with_completion(
            model=model,
            max_tokens=settings.ai_max_tokens,
            max_retries=settings.ai_max_retries,
            response_model=PlanEdit,
            # Stable prefix, so the gateway and the provider can cache it: the
            # system prompt never mentions the drawing or the user.
            system=[
                {
                    "type": "text",
                    "text": prompts.SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=messages,
        )
    except InstructorRetryException as exc:
        # The model answered, repeatedly, with something that is not a valid
        # edit. That is a bad turn, not a broken service.
        logger.warning("AI returned an unusable plan edit: %s", exc)
        raise ExternalServiceError(
            "La IA no devolvió un plano válido. Probá reformulando el pedido.",
            code="AI_INVALID_OUTPUT",
        ) from exc
    except APIError as exc:
        raise provider.translate_provider_error(exc) from exc

    try:
        applied = apply_operations(layout, edit.operations)
    except ValueError as exc:
        raise ExternalServiceError(
            "La IA devolvió un plano inconsistente. Probá pidiéndolo de nuevo.",
            code="AI_INVALID_OUTPUT",
        ) from exc

    usage = completion.usage

    return applied, edit, (usage.input_tokens, usage.output_tokens, model)


def _replay(conversation: Conversation) -> list[dict[str, str]]:
    """
    The last turns of the thread, as the Messages API wants them.

    Only the text is replayed. The drawing of an old turn is history the canvas
    has already moved past — resending it would have the model reconcile three
    versions of the same house.
    """
    limit = get_settings().ai_history_turns

    turns = [
        {"role": message.role.value, "content": message.content}
        for message in conversation.messages
        if message.role in (MessageRole.USER, MessageRole.ASSISTANT)
    ]

    # The window has to start on a user turn: the API rejects a conversation
    # that opens with the assistant.
    window = turns[-limit:]
    while window and window[0]["role"] != MessageRole.USER.value:
        window.pop(0)

    return window


# --- the rest of the project ---------------------------------------------------


def _sibling_floors(db: Session, floor: Floor) -> list[FloorContext]:
    """
    The other storeys of the project, ordered bottom to top.

    They are what lets the assistant put the stairs of the first floor over the
    stairs of the ground floor instead of somewhere plausible-looking. Read
    straight from the database and not from the request: the person is editing
    one floor, and the others are whatever was last saved on them.
    """
    others = db.scalars(
        select(Floor)
        .where(Floor.project_id == floor.project_id, Floor.id != floor.id)
        .order_by(Floor.level)
    ).all()

    return [
        FloorContext(
            name=sibling.name,
            level=sibling.level,
            layout=Layout.model_validate(sibling.layout or {}),
        )
        for sibling in others
    ]


def _create_floors(
    db: Session,
    external_user_id: str,
    floor: Floor,
    requested: list[NewFloor],
    siblings: list[FloorContext],
) -> list[Floor]:
    """
    Adds the storeys the answer asked for, drawn and saved.

    These are persisted straight away, unlike the edit to the open floor: the
    editor's undo stack holds one drawing, so a new storey has nowhere to sit
    until it exists. The person asked for a floor and gets a floor, with a link
    to open it — and deleting it is the same one click as any other.

    A level that is already taken is moved to the first free one above the
    building rather than refused: the storey is what was asked for, its number
    is bookkeeping.
    """
    if not requested:
        return []

    taken = {sibling.level for sibling in siblings} | {floor.level}
    created: list[Floor] = []

    for spec in requested:
        level = spec.level
        while level in taken and level < FLOOR_MAX_LEVEL:
            level += 1
        taken.add(level)

        try:
            drawn = apply_operations(Layout(), spec.operations)
        except ValueError:
            logger.warning("AI produced an invalid layout for floor %r", spec.name)
            continue

        created.append(
            floor_service.create_floor(
                db,
                external_user_id,
                floor.project_id,
                FloorCreate(name=spec.name, level=level, layout=drawn.layout),
            )
        )

    return created


# --- persistence --------------------------------------------------------------


def _resolve_conversation(
    db: Session,
    external_user_id: str,
    floor: Floor,
    conversation_id: uuid.UUID | None,
    first_message: str,
) -> Conversation:
    """
    The thread this turn belongs to, created on the first message of a floor.

    An explicit `conversation_id` is honoured but verified: it must be the
    caller's and it must be about this floor, so a valid id from another plan
    cannot be used to graft one drawing's history onto another.
    """
    if conversation_id is not None:
        conversation = get_owned_conversation(db, external_user_id, conversation_id)

        if conversation.floor_id != floor.id:
            raise NotFoundError(
                "Esa conversación no es de este plano.",
                code="CONVERSATION_FLOOR_MISMATCH",
            )

        return conversation

    existing = get_floor_conversation(db, external_user_id, floor.id)
    if existing is not None:
        return existing

    conversation = Conversation(
        project_id=floor.project_id,
        floor_id=floor.id,
        external_user_id=external_user_id,
        title=_title_from(first_message),
    )

    db.add(conversation)
    _commit(db, "creating a conversation for floor", floor.id)
    db.refresh(conversation)

    return conversation


def _record_exchange(
    db: Session,
    *,
    conversation: Conversation,
    prompt: str,
    summary: str,
    edit: AppliedEdit,
    usage: tuple[int, int, str],
    created: list[Floor],
) -> Message:
    """
    Stores both turns in one transaction.

    Both or neither: a thread where the answer is missing would be replayed to
    the model as an unanswered question on the next message.
    """
    input_tokens, output_tokens, model = usage

    db.add(
        Message(
            conversation_id=conversation.id,
            role=MessageRole.USER,
            content=prompt,
        )
    )

    answer = Message(
        conversation_id=conversation.id,
        role=MessageRole.ASSISTANT,
        content=summary,
        metadata_={
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "applied": edit.applied,
            "skipped": edit.skipped,
            # So reopening the thread still shows "creé la Planta Alta", with
            # the link, months later.
            "created_floors": [
                {"id": str(new.id), "name": new.name, "level": new.level}
                for new in created
            ],
        },
    )
    db.add(answer)

    _commit(db, "saving the exchange of conversation", conversation.id)
    db.refresh(answer)

    return answer


def _enforce_rate_limit(external_user_id: str) -> None:
    """Refuses the turn before it costs anything. See `lib/rate_limit.py`."""
    settings = get_settings()

    verdict = ai_rate_limiter.check(
        external_user_id,
        per_subject_limit=settings.ai_user_requests_per_minute,
        global_limit=settings.ai_requests_per_minute,
    )

    if verdict.allowed:
        return

    message = (
        f"Alcanzaste el límite de {settings.ai_user_requests_per_minute} pedidos "
        f"por minuto. Esperá {verdict.retry_after} segundos."
        if verdict.scope == "user"
        else "El asistente está recibiendo muchos pedidos. Probá en unos segundos."
    )

    raise TooManyRequestsError(
        message,
        code="AI_RATE_LIMITED",
        details={"retry_after": verdict.retry_after, "scope": verdict.scope},
    )


def _title_from(message: str) -> str:
    title = " ".join(message.split())
    if len(title) <= TITLE_MAX_LENGTH:
        return title
    return f"{title[: TITLE_MAX_LENGTH - 1].rstrip()}…"


def _commit(db: Session, action: str, subject: uuid.UUID) -> None:
    """Commits, or turns the integrity error into the API's conflict shape."""
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning("Integrity error %s %s: %s", action, subject, exc.orig)
        raise ConflictError(
            "No pudimos guardar la conversación con la IA.",
            code="CONVERSATION_CONFLICT",
        ) from exc
