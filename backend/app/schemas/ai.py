"""
Pydantic schemas for the AI assistant API.

One idea drives the shape of these: **the assistant does not save the drawing.**
It answers with the layout the edit produces and the editor puts that on its
undo stack, exactly like a template or a hand-drawn wall. The person reviews it
and saves with the endpoint that already exists (`PUT /floors/{id}/layout`).

That is why the request carries the layout instead of the server reading it from
the database: between two messages the person moves walls by hand, and the
canvas — not the last save — is what they are talking about.
"""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.db.models.message import MessageRole
from app.schemas.layout import Layout, LayoutSummary

PROMPT_MAX_LENGTH = 2_000

AssistantPrompt = Annotated[
    str,
    Field(
        min_length=1,
        max_length=PROMPT_MAX_LENGTH,
        description="What to draw or change, in plain language.",
        examples=["Una casa de dos dormitorios, cocina, baño y living comedor."],
    ),
]


class PlanAssistRequest(BaseModel):
    """Body of `POST /ai/floors/{floor_id}/plan`."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    message: AssistantPrompt
    # The drawing as it is on the canvas right now, unsaved changes included.
    layout: Layout = Field(default_factory=Layout)
    # Continues an existing thread. Omitted, the floor's thread is reused and
    # created on the first message, so the client never has to bootstrap one.
    conversation_id: UUID | None = None


class AiUsage(BaseModel):
    """What the turn cost. Surfaced so the spend is visible, not guessed at."""

    model: str
    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)


class CreatedFloorRead(BaseModel):
    """
    A storey the turn added to the project.

    Unlike the layout, this one **is** already saved: a new floor cannot live on
    the editor's undo stack, which holds the drawing of the floor that is open.
    The client turns it into a link.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    level: int
    summary: LayoutSummary


class PlanAssistResponse(BaseModel):
    """
    The assistant's answer: what it says, and the drawing that results.

    `skipped` is the honest part — an operation the model got wrong (an id that
    does not exist, a wall of half a centimetre) is dropped and explained here
    instead of silently corrupting the plan.
    """

    conversation_id: UUID
    message_id: UUID
    summary: str
    layout: Layout
    summary_of_layout: LayoutSummary = Field(
        description="Counts and area of the resulting drawing.",
    )
    applied: int = Field(ge=0, description="Operations carried out.")
    created_floors: list[CreatedFloorRead] = Field(
        default_factory=list,
        description="Storeys added to the project by this turn, already saved.",
    )
    skipped: list[str] = Field(
        default_factory=list,
        description="One Spanish sentence per operation that could not be applied.",
    )
    usage: AiUsage


class AiMessageRead(BaseModel):
    """One turn of a thread, as the chat panel renders it."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: MessageRole
    content: str
    created_at: datetime
    # Model, tokens, how many operations the turn applied. Free-form jsonb.
    metadata_: dict[str, Any] = Field(
        default_factory=dict,
        # The ORM attribute is `metadata_` (SQLAlchemy owns `metadata`), but the
        # API publishes the name the client expects.
        serialization_alias="metadata",
        validation_alias="metadata_",
    )


class ConversationRead(BaseModel):
    """A thread with its turns, oldest first. What the editor reopens with."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    project_id: UUID
    floor_id: UUID | None
    title: str | None
    created_at: datetime
    updated_at: datetime
    messages: list[AiMessageRead] = Field(default_factory=list)


class AiStatusRead(BaseModel):
    """
    Whether the assistant can be used at all, and under what allowance.

    The editor asks once on mount: with no credential configured it hides the
    panel instead of offering a button that always fails.
    """

    configured: bool
    model: str
    user_requests_per_minute: int = Field(ge=1)
