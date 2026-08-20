"""
Clerk JWT verification.

The frontend sends the Clerk session token as `Authorization: Bearer <token>`.
Here the signature is checked against Clerk's public keys (JWKS), so the
backend never handles passwords or sessions itself.

Every failure raises an `AppError` from `lib/errors.py`, so an invalid token
reaches the client in the same envelope as any other error. The `code` says
which check failed; the `message` is what the UI shows.
"""

from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import jwt
from fastapi import status
from jwt import PyJWKClient

from app.core.config import get_settings
from app.lib.errors import AppError, UnauthorizedError

ALGORITHMS = ["RS256"]

# Tolerance for clock skew between Clerk and this server.
LEEWAY_SECONDS = 10

# How long the fetched JWKS stays usable before it is refreshed.
JWKS_CACHE_SECONDS = 3600


@dataclass(frozen=True)
class AuthenticatedUser:
    """Identity extracted from a verified Clerk token."""

    external_user_id: str
    session_id: str | None
    org_id: str | None
    claims: dict[str, Any]


@lru_cache
def _jwk_client() -> PyJWKClient:
    """
    Clerk's JWKS client, created once per process.

    `PyJWKClient` keeps the fetched keys in memory, so Clerk is contacted only
    on the first request and again when the cache expires or an unknown `kid`
    shows up (key rotation).
    """
    settings = get_settings()

    if not settings.clerk_jwks_url:
        # A deployment problem, not the caller's fault: 500 with a code that is
        # obvious in the logs, and a message that says nothing about the setup.
        raise AppError(
            "No pudimos validar tu sesión. Intentá de nuevo en unos minutos.",
            code="AUTH_NOT_CONFIGURED",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return PyJWKClient(
        settings.clerk_jwks_url, cache_keys=True, lifespan=JWKS_CACHE_SECONDS
    )


def _signing_key(token: str) -> Any:
    """Public key matching the token's `kid`."""
    return _jwk_client().get_signing_key_from_jwt(token).key


def verify_token(token: str) -> AuthenticatedUser:
    """
    Validates signature, expiry, issuer and origin of a Clerk session token.

    Raises `UnauthorizedError` when the token cannot be trusted.
    """
    settings = get_settings()

    try:
        key = _signing_key(token)
    except AppError:
        raise
    except Exception as exc:  # network failure, unknown kid, malformed token
        raise UnauthorizedError(
            "Tu sesión no es válida. Volvé a iniciar sesión.",
            code="TOKEN_INVALID",
        ) from exc

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
        raise UnauthorizedError(
            "Tu sesión expiró. Volvé a iniciar sesión.",
            code="TOKEN_EXPIRED",
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise UnauthorizedError(
            "Tu sesión no es válida. Volvé a iniciar sesión.",
            code="TOKEN_INVALID",
        ) from exc

    # `azp` is the origin the token was issued to. Checking it stops a token
    # minted for another site from being replayed against this API.
    parties = settings.authorized_parties
    if parties:
        azp = claims.get("azp")
        if azp is not None and azp not in parties:
            raise UnauthorizedError(
                "Tu sesión no es válida para esta aplicación.",
                code="TOKEN_UNTRUSTED_ORIGIN",
            )

    return AuthenticatedUser(
        external_user_id=str(claims["sub"]),
        session_id=claims.get("sid"),
        org_id=claims.get("org_id"),
        claims=claims,
    )
