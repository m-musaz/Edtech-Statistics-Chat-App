"""JWT utilities for anonymous user authentication."""

import jwt
from datetime import datetime, timedelta
from ..core.config import settings
from ..core.logging import get_logger

logger = get_logger(__name__)

# JWT secret key - in production, this should be in environment variables
JWT_SECRET_KEY = "your-jwt-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_SECONDS = 31536000  # 1 year


def create_jwt_token(payload: dict) -> str:
    """
    Create JWT token with user ID and metadata.

    Args:
        payload: Dictionary containing user data

    Returns:
        JWT token string
    """
    try:
        # Add standard JWT claims
        payload['iat'] = datetime.utcnow()
        payload['exp'] = datetime.utcnow() + timedelta(seconds=JWT_EXPIRATION_SECONDS)
        payload['ver'] = '1.0'  # Version for future compatibility

        # Create and return JWT token
        token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
        logger.debug(f"Created JWT token for user: {payload.get('uid', 'unknown')}")
        return token

    except Exception as e:
        logger.error(f"Error creating JWT token: {e}")
        raise


def verify_jwt_token(token: str) -> dict:
    """
    Verify JWT token and return payload.

    Args:
        token: JWT token string

    Returns:
        Decoded payload dictionary

    Raises:
        jwt.ExpiredSignatureError: If token is expired
        jwt.InvalidTokenError: If token is invalid
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        logger.debug(f"Verified JWT token for user: {payload.get('uid', 'unknown')}")
        return payload

    except jwt.ExpiredSignatureError:
        logger.warning("JWT token has expired")
        raise
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {e}")
        raise
    except Exception as e:
        logger.error(f"Error verifying JWT token: {e}")
        raise


def create_session_payload(uid: str, user_agent: str = "") -> dict:
    """
    Create session payload for JWT token.

    Args:
        uid: User ID
        user_agent: User agent string for security binding

    Returns:
        Payload dictionary for JWT
    """
    import hashlib

    # Create user agent hash for security binding
    ua_hash = hashlib.sha256(user_agent.encode()).hexdigest()[:16] if user_agent else ""

    return {
        'uid': uid,
        'ua_hash': ua_hash
    }
