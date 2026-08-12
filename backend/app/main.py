import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import ai, elements, health, projects
from app.core.config import get_settings
from app.lib.errors import ErrorHandlingMiddleware, register_error_handlers

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        debug=settings.debug,
        # A 307 redirect from /projects to /projects/ has no CORS headers, so
        # the browser reports a CORS failure instead of the routing mismatch.
        # Returning 404 makes the real problem obvious.
        redirect_slashes=False,
    )

    # Middleware order matters: the last one added is the outermost. Registering
    # CORS after the error handler means CORS headers are also attached to the
    # 500 responses the error handler produces.
    app.add_middleware(ErrorHandlingMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_origin_regex=settings.cors_origin_regex,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        # Headers the browser is allowed to read from the response.
        expose_headers=["Content-Disposition", "X-Request-Id"],
        # Cache the preflight for 10 minutes (Chrome's maximum).
        max_age=600,
    )

    register_error_handlers(app)

    app.include_router(health.router)
    app.include_router(projects.router)
    app.include_router(elements.router)
    app.include_router(ai.router)

    logger.info("CORS allowed origins: %s", settings.allowed_origins or "(regex only)")
    if settings.cors_origin_regex:
        logger.info("CORS origin regex: %s", settings.cors_origin_regex)

    return app


app = create_app()
