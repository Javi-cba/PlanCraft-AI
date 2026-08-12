from functools import lru_cache

from pydantic import model_validator
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

    # Neon (Postgres). Must use the psycopg v3 driver: postgresql+psycopg://...
    database_url: str

    # LLM. Optional at boot — only the AI routes need them.
    anthropic_api_key: str | None = None
    ai_gateway_url: str | None = None

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
