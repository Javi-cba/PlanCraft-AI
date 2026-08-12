from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.lib.auth import AuthenticatedUser, UnauthorizedError, verify_token

DbSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]

# auto_error=False so a missing header raises our own error shape, not FastAPI's.
_bearer = HTTPBearer(auto_error=False, description="Clerk session JWT")


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> AuthenticatedUser:
    """Requires a valid Clerk token. Add to any endpoint that needs a user."""
    if credentials is None or not credentials.credentials:
        raise UnauthorizedError("Missing Authorization header")

    return verify_token(credentials.credentials)


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]
