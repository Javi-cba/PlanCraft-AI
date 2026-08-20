from functools import lru_cache

from anthropic import Anthropic

from app.core.config import get_settings
from app.lib.errors import ExternalServiceError

# Latest Anthropic model. Thinking is adaptive by default; `temperature`,
# `top_p` and `budget_tokens` are rejected by this model family.
DEFAULT_MODEL = "claude-opus-5"

# Non-streaming requests should stay well under the SDK's HTTP timeout.
DEFAULT_MAX_TOKENS = 16_000


@lru_cache
def get_client() -> Anthropic:
    """
    Configured Anthropic client, created once per process.

    Set AI_GATEWAY_URL to route the calls through a gateway (e.g. Vercel's)
    instead of hitting the API directly.
    """
    settings = get_settings()

    if not settings.anthropic_api_key:
        raise ExternalServiceError(
            "La generación con IA no está disponible en este momento.",
            code="AI_NOT_CONFIGURED",
        )

    return Anthropic(
        api_key=settings.anthropic_api_key,
        base_url=settings.ai_gateway_url or None,
    )
