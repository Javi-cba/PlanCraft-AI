from fastapi import APIRouter

router = APIRouter(prefix="/projects", tags=["elements"])

# Elements are nested under a project: /projects/{project_id}/elements
# Business logic lives in app/services/element_service.py.
