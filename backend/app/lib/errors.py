"""
Application errors and the single shape every error response has.

Whatever fails — an error raised on purpose, a request that does not validate,
or an unexpected crash — the client always reads the same envelope:

    {"error": {"code": "PROJECT_NOT_FOUND", "message": "...", "details": null}}

`code` is a stable identifier in ENGLISH: the frontend branches on it and it
never changes. `message` is Spanish text, ready to render in the UI. `details`
is optional structured context (field errors, ids, limits) — never a stacktrace.

The handlers live here; `main.py` registers them via `register_error_handlers`.
"""

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Codes produced by the handlers themselves, not by an `AppError`.
VALIDATION_ERROR_CODE = "VALIDATION_ERROR"
INTERNAL_ERROR_CODE = "INTERNAL_ERROR"
HTTP_ERROR_CODE = "HTTP_ERROR"

GENERIC_MESSAGE = "No pudimos procesar la solicitud."
INTERNAL_MESSAGE = "Ocurrió un error inesperado. Intentá de nuevo en unos minutos."


class AppError(Exception):
    """
    Base class for every error the application raises on purpose.

    Subclasses carry the defaults (status code and code family); each call site
    overrides what it needs, keeping the code specific enough to act on:

        raise NotFoundError("No encontramos el proyecto.", code="PROJECT_NOT_FOUND")
        raise ConflictError(
            "Ya tenés un proyecto con ese nombre.",
            code="PROJECT_NAME_TAKEN",
            details={"name": name},
        )
    """

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "APP_ERROR"
    message: str = GENERIC_MESSAGE

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        details: dict[str, Any] | None = None,
        status_code: int | None = None,
    ) -> None:
        if message is not None:
            self.message = message
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code
        self.details = details
        # str(exc) is the Spanish message, which is what shows up in the server
        # logs whenever something re-raises or logs the exception.
        super().__init__(self.message)


class UnauthorizedError(AppError):
    """No usable credential: the caller has to sign in."""

    status_code = status.HTTP_401_UNAUTHORIZED
    code = "UNAUTHORIZED"
    message = "Necesitás iniciar sesión para continuar."


class ForbiddenError(AppError):
    """Authenticated, but the resource belongs to somebody else."""

    status_code = status.HTTP_403_FORBIDDEN
    code = "FORBIDDEN"
    message = "No tenés permiso para acceder a este recurso."


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "NOT_FOUND"
    message = "No encontramos el recurso solicitado."


class ConflictError(AppError):
    """The request clashes with the current state (duplicates, races)."""

    status_code = status.HTTP_409_CONFLICT
    code = "CONFLICT"
    message = "El recurso ya existe o cambió mientras lo editabas."


class ValidationAppError(AppError):
    """
    A business rule the request breaks. The `App` suffix keeps it apart from
    pydantic's `ValidationError`, which is a different thing entirely.
    """

    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    code = "VALIDATION_ERROR"
    message = "Los datos enviados no son válidos."


class TooManyRequestsError(AppError):
    """
    The caller (or the whole process) went over an allowance.

    `details["retry_after"]` carries the seconds to wait, and the handler copies
    it to the `Retry-After` header so a client can back off without parsing the
    body. Raised by the AI routes, which are the only ones that cost money per
    request — see `app/lib/rate_limit.py`.
    """

    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "TOO_MANY_REQUESTS"
    message = "Hiciste demasiadas solicitudes. Esperá un momento antes de reintentar."


class ExternalServiceError(AppError):
    """An upstream dependency (LLM provider, third-party API) failed."""

    status_code = status.HTTP_502_BAD_GATEWAY
    code = "EXTERNAL_SERVICE_ERROR"
    message = "Un servicio externo no está disponible. Intentá de nuevo en unos minutos."


def error_payload(
    code: str, message: str, details: dict[str, Any] | None = None
) -> dict[str, Any]:
    """The one error body of this API. `details` is always present, maybe null."""
    return {"error": {"code": code, "message": message, "details": details}}


def _error_response(
    status_code: int, code: str, message: str, details: dict[str, Any] | None = None
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code, content=error_payload(code, message, details)
    )


# Spanish text for the HTTP errors Starlette raises on its own (unknown route,
# wrong method, …), which never go through an `AppError`.
_HTTP_MESSAGES: dict[int, tuple[str, str]] = {
    status.HTTP_401_UNAUTHORIZED: ("UNAUTHORIZED", UnauthorizedError.message),
    status.HTTP_403_FORBIDDEN: ("FORBIDDEN", ForbiddenError.message),
    status.HTTP_404_NOT_FOUND: ("NOT_FOUND", "No encontramos lo que buscabas."),
    status.HTTP_405_METHOD_NOT_ALLOWED: (
        "METHOD_NOT_ALLOWED",
        "La operación no está permitida en este recurso.",
    ),
    status.HTTP_429_TOO_MANY_REQUESTS: (
        "TOO_MANY_REQUESTS",
        "Hiciste demasiadas solicitudes. Esperá un momento antes de reintentar.",
    ),
}


def _validation_details(exc: RequestValidationError) -> dict[str, Any]:
    """
    Flattens pydantic's errors into one entry per offending field.

    `ctx` is dropped on purpose: it can hold exception objects that do not
    serialize, and the frontend only needs where it failed and why.
    """
    fields = [
        {
            "field": ".".join(str(part) for part in error.get("loc", ())) or "body",
            "type": error.get("type", "invalid"),
            "message": error.get("msg", ""),
        }
        for error in exc.errors()
    ]
    return {"fields": fields}


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
            logger.exception(
                "Unhandled error on %s %s", request.method, request.url.path
            )
            return _error_response(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                INTERNAL_ERROR_CODE,
                INTERNAL_MESSAGE,
            )


def register_error_handlers(app: FastAPI) -> None:
    """Normalizes every failure into the `{"error": {...}}` envelope."""

    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        response = _error_response(exc.status_code, exc.code, exc.message, exc.details)

        # A 429 that says how long to wait is the difference between a client
        # that backs off and one that hammers. `Retry-After` is the standard
        # place to say it; the body repeats it for code that never reads headers.
        retry_after = (exc.details or {}).get("retry_after")
        if exc.status_code == status.HTTP_429_TOO_MANY_REQUESTS and retry_after:
            response.headers["Retry-After"] = str(int(retry_after))

        return response

    @app.exception_handler(RequestValidationError)
    async def _validation_error(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return _error_response(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            VALIDATION_ERROR_CODE,
            "Revisá los datos enviados: hay campos inválidos.",
            _validation_details(exc),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code, message = _HTTP_MESSAGES.get(
            exc.status_code, (HTTP_ERROR_CODE, GENERIC_MESSAGE)
        )
        return _error_response(exc.status_code, code, message)

    # Backstop for anything raised *above* `ErrorHandlingMiddleware` (the CORS
    # middleware itself, for instance). The client never sees the cause: the
    # stacktrace stays in the server log.
    @app.exception_handler(Exception)
    async def _unhandled_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return _error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR, INTERNAL_ERROR_CODE, INTERNAL_MESSAGE
        )
