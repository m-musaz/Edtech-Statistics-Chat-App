"""Main FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from .core.config import settings
from .core.logging import setup_logging
from .api.routes import api_router
from .middleware.security import setup_cors, setup_security
from .services.settings_cache import SettingsCache


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""

    # Setup logging
    setup_logging()

    # Create FastAPI app
    app = FastAPI(
        title=settings.project_name,
        description="Backend API for HTHGSE Shewhart Chatbot",
        version="0.1.0",
        debug=settings.debug,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )

    @app.middleware("http")
    async def debug_host(request, call_next):
        if request.url.path == "/healthz":
            print("Healthz Host:", request.headers.get("host"))
        return await call_next(request)

    # Add trusted host middleware
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.allowed_hosts
    )

    setup_cors(app, settings.cors_origins)


    @app.get("/")
    async def health_check():
        """Health check endpoint at root level."""
        return {"status": "ok", "message": "Service is healthy"}

    # Add health check at root level for compatibility
    @app.get("/healthz")
    async def health_check():
        """Health check endpoint at root level."""
        return {"status": "ok", "message": "Service is healthy"}
    # Setup middleware
    setup_security(app)

    # Include routers
    app.include_router(api_router)

    @app.on_event("startup")
    async def _warm_settings_cache():
        await SettingsCache.warm()
        SettingsCache.start_polling()

    return app


# Create app instance
app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level.lower(),
    )
