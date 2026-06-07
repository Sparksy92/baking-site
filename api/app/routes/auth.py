from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from app.database import PostgresConnection

from app.auth import (
    AUTH_COOKIE_NAME,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.config import get_settings
from app.database import get_db
from app.models.schemas import LoginRequest, LoginResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    response: Response,
    request: Request,
    db: PostgresConnection = Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM admin_users WHERE username = ? AND is_active = 1",
        (body.username,),
    )
    user = await cursor.fetchone()

    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    settings = get_settings()
    token = create_access_token(
        username=user["username"],
        role=user["role"],
        display_name=user["display_name"],
        permissions=user["permissions"] if "permissions" in user.keys() else "all",
        settings=settings,
    )

    # Update last_login
    await db.execute(
        "UPDATE admin_users SET last_login = ? WHERE id = ?",
        (datetime.now(timezone.utc).isoformat(), user["id"]),
    )
    await db.commit()

    # Set httpOnly cookie
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=not settings.dev_mode,
        max_age=settings.admin_jwt_lifetime_hours * 3600,
        path="/",
    )

    return LoginResponse(
        username=user["username"],
        role=user["role"],
        display_name=user["display_name"] or user["username"],
    )


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key=AUTH_COOKIE_NAME, path="/")
    return {"detail": "Logged out"}


@router.get("/me", response_model=LoginResponse)
async def me(user: dict = Depends(get_current_user)):
    return LoginResponse(
        username=user["sub"],
        role=user["role"],
        display_name=user.get("display_name", user["sub"]),
    )
