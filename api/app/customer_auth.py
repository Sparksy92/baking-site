from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, Request, status
import jwt

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

CUSTOMER_COOKIE_NAME = "_customer_token"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_customer_token(
    customer_id: int,
    email: str,
    first_name: str,
    settings: Settings | None = None,
) -> str:
    if settings is None:
        settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.customer_jwt_lifetime_hours)
    payload = {
        "sub": str(customer_id),
        "email": email,
        "first_name": first_name,
        "type": "customer",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.customer_jwt_secret, algorithm=settings.admin_jwt_algorithm)


def decode_customer_token(token: str, settings: Settings | None = None) -> dict:
    if settings is None:
        settings = get_settings()
    payload = jwt.decode(token, settings.customer_jwt_secret, algorithms=[settings.admin_jwt_algorithm])
    if payload.get("type") != "customer":
        raise jwt.InvalidTokenError("Not a customer token")
    return payload


async def get_current_customer(request: Request) -> dict:
    """FastAPI dependency: extracts and validates customer JWT from cookie."""
    token = request.cookies.get(CUSTOMER_COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        payload = decode_customer_token(token)
    except (jwt.PyJWTError, Exception):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return payload


async def get_optional_customer(request: Request) -> dict | None:
    """FastAPI dependency: returns customer payload or None if not logged in."""
    token = request.cookies.get(CUSTOMER_COOKIE_NAME)
    if not token:
        return None
    try:
        return decode_customer_token(token)
    except Exception:
        return None


def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)
