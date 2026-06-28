"""Common utilities for API routes."""

from fastapi import HTTPException, Request

from ...core.jwt_utils import verify_jwt_token


async def verify_admin_access(request: Request) -> dict:
    """Verify that the request comes from an authenticated admin user."""
    session_cookie = request.cookies.get("sess")
    
    if not session_cookie:
        raise HTTPException(status_code=401, detail="No session found")
    
    try:
        payload = verify_jwt_token(session_cookie)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # Check if user is admin
    if not payload.get('is_admin'):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return payload
