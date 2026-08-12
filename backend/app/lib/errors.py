import logging
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base class for every error the application raises on purpose."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "app_error"

    def __init__(self, detail: str, *, code: str | None = None) -> None:
        super().__init__(detail)
        self.detail = detail
        if code is not None:
            self.code = code


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


class UnprocessableError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    code = "unprocessable"


class ExternalServiceError(AppError):
    """An upstream dependency (LLM provider, third-party API) failed."""

    status_code = status.HTTP_502_BAD_GATEWAY
    code = "external_service_error"


def _error_response(status_code: int, code: str, detail: object) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"code": code, "detail": detail})


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """
    Turns any unhandled exception into a JSON 500 *inside* the middleware stack.

    Starlette's built-in error handler sits above CORSMiddleware, so a crash
    there produces a response with no CORS headers and the browser reports a
    misleading "CORS error" instead of the real 500. Catching here — with the
    CORS middleware registered after this one, therefore wrapping it — keeps
    the headers on error responses too.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        try:
            return await call_next(request)
        except Exception:
            logger.exception("Unhandled error on %s %s", request.method, request.url.path)
            return _error_response(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                "internal_error",
                "Internal server error",
            )


def register_error_handlers(app: FastAPI) -> None:
    """Normalizes every error into `{"code": ..., "detail": ...}`."""

    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return _error_response(exc.status_code, exc.code, exc.detail)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _error_response(exc.status_code, "http_error", exc.detail)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return _error_response(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "validation_error", exc.errors()
        )
