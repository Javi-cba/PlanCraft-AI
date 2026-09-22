"""
The LLM client, configured once per process.

Calls go through the **Vercel AI Gateway**, which speaks the Anthropic Messages
API verbatim: the official `anthropic` SDK is simply pointed at the gateway's
base URL and the model id carries a `provider/` prefix (`anthropic/claude-sonnet-5`).
That buys one credential, one bill and one place to swap providers, without an
OpenAI-compatible shim in the middle.

`instructor` wraps the client so every answer is parsed into a Pydantic model
from `app/ai/schemas.py` and re-asked when it does not validate. Nothing
unvalidated ever leaves this module.
"""

import logging
from functools import lru_cache

import anthropic
import instructor

from app.core.config import get_settings
from app.lib.errors import ExternalServiceError, TooManyRequestsError

logger = logging.getLogger(__name__)

# The gateway names models `provider/model`; a direct Anthropic key does not.
GATEWAY_MODEL_SEPARATOR = "/"

# The SDK already retries 429/5xx twice with backoff. Keeping it there (instead
# of hand-rolling a loop) means one retry policy, and it honours `retry-after`.
SDK_MAX_RETRIES = 2

# A plan for a whole house is a long answer. Ten minutes is the SDK default and
# far more than a non-streaming Sonnet request needs; three keeps a stuck
# upstream from pinning a worker while the browser waits.
REQUEST_TIMEOUT_SECONDS = 180.0

_NOT_CONFIGURED = ExternalServiceError(
    "La generación con IA no está disponible en este momento.",
    code="AI_NOT_CONFIGURED",
)


@lru_cache
def get_client() -> instructor.Instructor:
    """
    Structured-output client for the gateway. Raises when no credential is set,
    so the API still boots without one and only the AI routes fail.
    """
    settings = get_settings()

    if settings.ai_gateway_api_key:
        api_key = settings.ai_gateway_api_key
        base_url = settings.ai_gateway_url
    elif settings.anthropic_api_key:
        # Fallback for a deployment without the gateway: same SDK, Anthropic's
        # own endpoint. `resolve_model` drops the `provider/` prefix to match.
        logger.warning("AI_GATEWAY_API_KEY is not set; calling Anthropic directly.")
        api_key = settings.anthropic_api_key
        base_url = None
    else:
        raise _NOT_CONFIGURED

    client = anthropic.Anthropic(
        api_key=api_key,
        base_url=base_url,
        max_retries=SDK_MAX_RETRIES,
        timeout=REQUEST_TIMEOUT_SECONDS,
    )

    # ANTHROPIC_TOOLS: the schema travels as a tool definition and the model
    # answers with tool input, which is the most reliable structured output the
    # Messages API offers — and what the gateway forwards unchanged.
    return instructor.from_anthropic(client, mode=instructor.Mode.ANTHROPIC_TOOLS)


def resolve_model() -> str:
    """
    The model id to send, adjusted to whichever endpoint is in use.

    `anthropic/claude-sonnet-5` is what the gateway expects; Anthropic's own API
    rejects the prefix, so it is stripped when falling back to a direct key.
    """
    settings = get_settings()
    model = settings.ai_model

    if not settings.ai_gateway_api_key and GATEWAY_MODEL_SEPARATOR in model:
        return model.split(GATEWAY_MODEL_SEPARATOR, 1)[1]

    return model


def is_configured() -> bool:
    """Whether an AI credential exists. Lets `/health` report it without a call."""
    settings = get_settings()
    return bool(settings.ai_gateway_api_key or settings.anthropic_api_key)


def translate_provider_error(exc: Exception) -> Exception:
    """
    Turns an SDK failure into this API's error shape.

    An upstream 429 (the gateway's own quota, not ours) has to reach the client
    as a 429 with its `Retry-After`, not as a generic 502: the two mean very
    different things to whoever is waiting.
    """
    if isinstance(exc, anthropic.RateLimitError):
        header = exc.response.headers.get("retry-after") if exc.response else None
        retry_after = _positive_int(header, fallback=30)

        return TooManyRequestsError(
            "El servicio de IA está saturado. Probá de nuevo en un momento.",
            code="AI_RATE_LIMITED",
            details={"retry_after": retry_after, "scope": "provider"},
        )

    if isinstance(exc, anthropic.AuthenticationError | anthropic.PermissionDeniedError):
        logger.error("AI gateway rejected the credential: %s", exc)
        return _NOT_CONFIGURED

    if isinstance(exc, anthropic.APIStatusError | anthropic.APIConnectionError):
        logger.warning("AI gateway request failed: %s", exc)
        return ExternalServiceError(
            "El servicio de IA no respondió. Probá de nuevo en unos minutos.",
            code="AI_UNAVAILABLE",
        )

    return exc


def _positive_int(value: str | None, *, fallback: int) -> int:
    """`retry-after` is seconds, but an upstream may send a date or nothing."""
    try:
        return max(1, int(value or ""))
    except ValueError:
        return fallback
