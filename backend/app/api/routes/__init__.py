"""API routes package."""

from fastapi import APIRouter

from .health import router as health_router
from .chat import router as chat_router
from .analytics import router as analytics_router
from .admin import router as admin_router
from .threads import router as threads_router

# Create main API router
api_router = APIRouter(prefix="/api/v1", tags=["api"])

# Include all sub-routers
api_router.include_router(health_router)
api_router.include_router(chat_router)
api_router.include_router(analytics_router)
api_router.include_router(admin_router)
api_router.include_router(threads_router)

__all__ = ["api_router"]
