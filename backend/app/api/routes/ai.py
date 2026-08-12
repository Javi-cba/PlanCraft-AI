from fastapi import APIRouter

router = APIRouter(prefix="/ai", tags=["ai"])

# POST /ai/generate — prompt in, validated layout out.
# Business logic lives in app/services/ai_service.py.
