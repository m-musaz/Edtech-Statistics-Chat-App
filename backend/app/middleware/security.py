"""Security middleware for the application."""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import Response
from starlette.middleware.cors import CORSMiddleware

from ..core.logging import get_logger

logger = get_logger(__name__)


class SecurityMiddleware(BaseHTTPMiddleware):
    """Custom security middleware."""

    async def dispatch(self, request: Request, call_next) -> Response:
        """Process the request and add security headers."""

        response = await call_next(request)

        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        # Add custom headers
        response.headers["X-Powered-By"] = "HTHGSE Shewhart Chatbot"

        logger.debug("Security headers added to response")

        return response


def setup_cors(app, allowed_origins: list[str]) -> None:
    """Setup CORS middleware."""
    print(allowed_origins)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    logger.info("CORS middleware configured with origins: %s", allowed_origins)


def setup_security(app) -> None:
    """Setup security middleware."""

    app.add_middleware(SecurityMiddleware)

    logger.info("Security middleware configured")
