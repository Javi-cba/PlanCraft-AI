from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.lib.auth import verify_token
from app.lib.errors import UnauthorizedError

DbSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]

# auto_error=False so a missing header raises our own error shape, not FastAPI's.
_bearer = HTTPBearer(auto_error=False, description="Clerk session JWT")


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> str:
    """
    Requires a valid Clerk token and returns the `external_user_id`.

    That is the token's `sub` claim — the Clerk user id — which is exactly what
    the tables store (`projects.external_user_id`). Users live in Clerk, so this
    string is the only identity the backend needs to scope data by owner.
    """
    if credentials is None or not credentials.credentials:
        raise UnauthorizedError(
            "Necesitás iniciar sesión para continuar.",
            code="TOKEN_MISSING",
        )

    return verify_token(credentials.credentials).external_user_id


# Annotate any endpoint that needs a signed-in user:
#     def list_projects(external_user_id: CurrentUserId, db: DbSession) -> ...
CurrentUserId = Annotated[str, Depends(get_current_user)]
