"""
Clerk JWT verification.

The frontend sends the Clerk session token as `Authorization: Bearer <token>`.
Here the signature is checked against Clerk's public keys (JWKS), so the
backend never handles passwords or sessions itself.
"""

from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import jwt
from jwt import PyJWKClient

from app.core.config import get_settings
from app.lib.errors import AppError

ALGORITHMS = ["RS256"]

# Tolerance for clock skew between Clerk and this server.
LEEWAY_SECONDS = 10


class UnauthorizedError(AppError):
    status_code = 401
    code = "unauthorized"


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"


@dataclass(frozen=True)
class AuthenticatedUser:
    """Identity extracted from a verified Clerk token."""

    id: str
    session_id: str | None
    org_id: str | None
    claims: dict[str, Any]


@lru_cache
def _jwk_client() -> PyJWKClient:
    """Clerk's JWKS client. Caches the keys, so it is created only once."""
    settings = get_settings()

    if not settings.clerk_jwks_url:
        raise UnauthorizedError("CLERK_JWKS_URL is not configured")

    return PyJWKClient(settings.clerk_jwks_url, cache_keys=True, lifespan=3600)


def _signing_key(token: str) -> Any:
    """Public key matching the token's `kid`."""
    return _jwk_client().get_signing_key_from_jwt(token).key


def verify_token(token: str) -> AuthenticatedUser:
    """Validates signature, expiry and issuer. Raises `UnauthorizedError`."""
    settings = get_settings()

    try:
        key = _signing_key(token)
    except UnauthorizedError:
        raise
    except Exception as exc:  # network failure, unknown kid, malformed token
        raise UnauthorizedError("Could not resolve the token signing key") from exc

    try:
        claims: dict[str, Any] = jwt.decode(
            token,
            key,
            algorithms=ALGORITHMS,
            issuer=settings.clerk_issuer or None,
            leeway=LEEWAY_SECONDS,
            # Clerk session tokens carry no `aud` claim by default.
            options={"verify_aud": False, "require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedError("Expired token") from exc
    except jwt.InvalidTokenError as exc:
        raise UnauthorizedError("Invalid token") from exc

    # `azp` is the origin the token was issued to. Checking it stops a token
    # minted for another site from being replayed against this API.
    parties = settings.authorized_parties
    if parties:
        azp = claims.get("azp")
        if azp is not None and azp not in parties:
            raise UnauthorizedError("Token was issued for a different origin")

    return AuthenticatedUser(
        id=str(claims["sub"]),
        session_id=claims.get("sid"),
        org_id=claims.get("org_id"),
        claims=claims,
    )
