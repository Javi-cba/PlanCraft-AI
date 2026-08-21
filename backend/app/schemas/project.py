"""
Pydantic schemas for the projects API: what comes in and what goes out.

These are not the ORM models (`db/models/project.py`) — the table is one thing,
the API contract another. `external_user_id` is deliberately absent from the
input schemas: the owner is never read from the body, it comes from the verified
Clerk token via `get_current_user`.
"""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

NAME_MAX_LENGTH = 120
# The column is TEXT, so the cap is an API guardrail: it keeps a runaway paste
# out of the database and out of the LLM prompts built from it.
DESCRIPTION_MAX_LENGTH = 2_000

ProjectName = Annotated[
    str,
    Field(
        min_length=1,
        max_length=NAME_MAX_LENGTH,
        description="Project name, as shown in the UI.",
        examples=["Casa en Córdoba"],
    ),
]

ProjectDescription = Annotated[
    str | None,
    Field(
        default=None,
        max_length=DESCRIPTION_MAX_LENGTH,
        description="Optional free text about the project.",
        examples=["Dos plantas, terreno en esquina."],
    ),
]


class ProjectCreate(BaseModel):
    """Body of `POST /projects`."""

    model_config = ConfigDict(
        # Whitespace is trimmed before the length checks, so "  " is not a name.
        str_strip_whitespace=True,
        # Anything the client invents — `external_user_id` above all — is
        # rejected instead of silently ignored.
        extra="forbid",
    )

    name: ProjectName
    description: ProjectDescription

    @field_validator("description")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        """A cleared textarea arrives as "", which means "no description"."""
        return value or None


class ProjectRead(BaseModel):
    """A project as the API returns it. No input constraints: this is output."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    # Clerk user id (`sub`) of the owner. Set by the server, never by the client.
    external_user_id: str
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime
