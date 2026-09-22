from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Environment-backed configuration. Validated once at startup: if a required
    variable is missing or inconsistent, the app refuses to boot.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "PlanCraft AI API"
    version: str = "0.1.0"
    debug: bool = False

    # Neon (Postgres). Normalized below to the psycopg v3 driver.
    database_url: str

    # --- LLM (Vercel AI Gateway) ------------------------------------------
    # Optional at boot: only the AI routes need them, and the API must come up
    # without them so the rest of the product keeps working when the gateway
    # credential is missing or rotated.
    #
    # The gateway speaks the Anthropic Messages API, so the official `anthropic`
    # SDK is pointed at it — see `app/ai/provider.py`.
    ai_gateway_api_key: str | None = None
    ai_gateway_url: str = "https://ai-gateway.vercel.sh"
    # Direct Anthropic credential. Only used as a fallback when no gateway key
    # is configured, and then the model id travels without the `anthropic/`
    # prefix the gateway expects.
    anthropic_api_key: str | None = None

    # `provider/model` as the gateway names it. Sonnet 5 is the deliberate
    # middle of the range: strong enough to lay out a floor plan, a fraction of
    # the price of the Opus tier.
    ai_model: str = "anthropic/claude-sonnet-5"
    # Generous enough for a whole house in one answer, far from the tier where
    # a non-streaming request risks the SDK's HTTP timeout.
    ai_max_tokens: int = 16_000
    # How many past turns of a thread are replayed to the model. The drawing
    # itself travels with every request, so older turns are only there for the
    # intent ("un poco más grande", "igual que el anterior").
    ai_history_turns: int = 12
    # On a schema violation instructor re-asks with the validation error. Two
    # extra attempts fix the occasional malformed id without burning credit.
    ai_max_retries: int = 2

    # --- AI rate limiting -------------------------------------------------
    # Requests per minute allowed before the API answers 429. Two windows: one
    # per user, so nobody monopolizes the quota, and one for the whole process,
    # which is what actually protects the gateway bill.
    ai_user_requests_per_minute: int = 6
    ai_requests_per_minute: int = 30

    # --- Clerk (auth) -----------------------------------------------------
    # Public keys used to verify the session JWT sent by the frontend.
    clerk_jwks_url: str | None = None
    # Backend credential, for calls to Clerk's own API.
    clerk_secret_key: str | None = None
    # Recommended: the token's expected `iss`, e.g. https://xxx.clerk.accounts.dev
    clerk_issuer: str | None = None
    # Optional comma-separated `azp` allowlist (the origins tokens are issued
    # to). Defaults to the CORS origins, which is what the browser sends.
    clerk_authorized_parties: str | None = None

    # --- CORS -------------------------------------------------------------
    # Comma-separated list of exact origins (scheme + host + port, no path).
    cors_origins: str = "http://localhost:3000"
    # Optional regex for dynamic origins, e.g. Vercel previews:
    #   CORS_ORIGIN_REGEX=https://.*\.vercel\.app
    cors_origin_regex: str | None = None
    # Required for cookie/Authorization-based auth. Incompatible with "*".
    cors_allow_credentials: bool = True

    @property
    def allowed_origins(self) -> list[str]:
        """Parsed `cors_origins`, normalized without trailing slashes."""
        return [
            origin.strip().rstrip("/")
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]

    @property
    def authorized_parties(self) -> list[str]:
        """Origins Clerk tokens may be issued to (`azp` claim)."""
        if self.clerk_authorized_parties is None:
            return self.allowed_origins
        return [
            party.strip().rstrip("/")
            for party in self.clerk_authorized_parties.split(",")
            if party.strip()
        ]

    @field_validator("database_url")
    @classmethod
    def _use_psycopg_driver(cls, value: str) -> str:
        """
        Neon (and every other provider) hands out a bare `postgresql://` URL,
        which SQLAlchemy resolves to psycopg2 — a driver this project does not
        install. Rewriting the scheme here means a copy-pasted connection
        string works as-is, in .env and in the deployment's environment.
        """
        for prefix in ("postgresql://", "postgres://"):
            if value.startswith(prefix):
                return f"postgresql+psycopg://{value[len(prefix):]}"
        return value

    @model_validator(mode="after")
    def _check_cors(self) -> "Settings":
        origins = self.allowed_origins

        if not origins and not self.cors_origin_regex:
            raise ValueError(
                "CORS is not configured: set CORS_ORIGINS (and/or CORS_ORIGIN_REGEX)."
            )

        # The browser rejects `Access-Control-Allow-Origin: *` whenever the
        # request carries credentials. Failing here beats debugging an opaque
        # CORS error in production.
        if "*" in origins and self.cors_allow_credentials:
            raise ValueError(
                'CORS_ORIGINS="*" cannot be combined with CORS_ALLOW_CREDENTIALS=true. '
                "List the exact origins, or use CORS_ORIGIN_REGEX."
            )

        for origin in origins:
            if origin != "*" and not origin.startswith(("http://", "https://")):
                raise ValueError(
                    f"Invalid CORS origin {origin!r}: it must include the scheme, "
                    "e.g. https://plancraft.app"
                )

        return self


@lru_cache
def get_settings() -> Settings:
    """Cached singleton so the environment is read and validated only once."""
    return Settings()  # type: ignore[call-arg]
