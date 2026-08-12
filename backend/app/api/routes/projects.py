from fastapi import APIRouter

router = APIRouter(prefix="/projects", tags=["projects"])

# Routes only validate the request, call a service and return the response.
# Business logic lives in app/services/project_service.py.
