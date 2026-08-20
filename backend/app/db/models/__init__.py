"""
ORM models, one module per table.

Every model must be imported here: `app.db.base` imports this package to build
`Base.metadata`, which is what Alembic autogenerate compares against the DB.
"""

from app.db.models.conversation import Conversation
from app.db.models.element import Element
from app.db.models.floor import Floor
from app.db.models.message import Message, MessageRole
from app.db.models.plan import InstallationType, Plan
from app.db.models.project import Project

__all__ = [
    "Conversation",
    "Element",
    "Floor",
    "InstallationType",
    "Message",
    "MessageRole",
    "Plan",
    "Project",
]
