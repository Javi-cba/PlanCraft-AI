from fastapi import APIRouter

from app.api.deps import AppSettings

router = APIRouter(tags=["health"])


@router.get("/health")
def health(settings: AppSettings) -> dict[str, str]:
    """Liveness probe. Also the cheapest way to verify CORS from the browser."""
    return {"status": "ok", "service": settings.app_name, "version": settings.version}
