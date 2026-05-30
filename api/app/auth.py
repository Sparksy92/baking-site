from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, Request, status
import jwt

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

AUTH_COOKIE_NAME = "_auth_token"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(
    username: str,
    role: str,
    display_name: str | None = None,
    settings: Settings | None = None,
) -> str:
    if settings is None:
        settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.admin_jwt_lifetime_hours)
    payload = {
        "sub": username,
        "role": role,
        "display_name": display_name or username,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.admin_jwt_secret, algorithm=settings.admin_jwt_algorithm)  # type: ignore[arg-type]


def decode_token(token: str, settings: Settings | None = None) -> dict:
    if settings is None:
        settings = get_settings()
    return jwt.decode(token, settings.admin_jwt_secret, algorithms=[settings.admin_jwt_algorithm])  # type: ignore[arg-type]


async def get_current_user(request: Request) -> dict:
    """FastAPI dependency: extracts and validates JWT from cookie.
    Returns the decoded token payload or raises 401."""
    token = request.cookies.get(AUTH_COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        payload = decode_token(token)
    except (jwt.PyJWTError, Exception):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return payload


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """FastAPI dependency: requires admin or owner role."""
    if user.get("role") not in ("admin", "owner"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
