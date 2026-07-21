"""YouTube (Google) OAuth routes.

Connect a YouTube channel via Google OAuth 2.0.

Routes:
  GET  /social/youtube/status        — connection status
  GET  /social/youtube/connect       — start OAuth flow
  GET  /social/youtube/callback      — OAuth callback (registered in Google Cloud Console)
  POST /social/youtube/disconnect    — remove connection
  POST /social/youtube/test-connection — verify token + fetch channel info
"""
from __future__ import annotations
from typing import Annotated

import json
import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse

from app.auth import require_admin
from app.database import PostgresConnection, get_db
from app.services.social.oauth_state import consume_oauth_state, create_oauth_state
from app.services.social.providers.base import SocialAccount, SocialProviderError
from app.services.social.providers.youtube import YouTubeProvider
from app.services.social.service import (
    disconnect_connection,
    get_connection,
    get_serialized_connection,
    mark_connection_checked,
    select_account_connection,
    store_oauth_accounts,
)
from app.services.social.token_crypto import TokenCryptoError, decrypt_token, encrypt_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/social/youtube", tags=["social-youtube"])

_RESPONSES = {400: {"description": "Bad Request"}, 502: {"description": "Bad Gateway"}}
YOUTUBE_ACCOUNT_TYPE = "youtube_channel"


def _admin_return_url(query: dict[str, str]) -> str:
    base = "/admin/social/platforms"
    return f"{base}?{urlencode(query)}" if query else base


@router.get("/status", responses=_RESPONSES)
async def youtube_status(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    provider = YouTubeProvider()
    connection = await get_serialized_connection(
        db,
        provider="youtube",
        account_type=YOUTUBE_ACCOUNT_TYPE,
    )
    return {"configured": provider.configured, "connection": connection}


@router.get("/connect", responses=_RESPONSES)
async def connect_youtube(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    provider = YouTubeProvider()
    try:
        state = await create_oauth_state(db, provider="youtube", admin_user_id=user.get("sub"))
        return RedirectResponse(provider.build_authorization_url(state=state), status_code=302)
    except SocialProviderError as exc:
        return RedirectResponse(_admin_return_url({"youtube_error": str(exc)}), status_code=302)


@router.get("/callback", responses=_RESPONSES)
async def youtube_callback(
    db: Annotated[PostgresConnection, Depends(get_db)],
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
):
    if error:
        return RedirectResponse(_admin_return_url({"youtube_error": error_description or error}), status_code=302)
    if not code or not state:
        return RedirectResponse(_admin_return_url({"youtube_error": "Missing OAuth callback parameters"}), status_code=302)

    state_row = await consume_oauth_state(db, state=state, provider="youtube")
    if not state_row:
        return RedirectResponse(_admin_return_url({"youtube_error": "Invalid or expired OAuth state"}), status_code=302)

    provider = YouTubeProvider()
    try:
        token_data = await provider.exchange_code_for_access_token(code)
        access_token = token_data.get("access_token")
        if not access_token:
            raise SocialProviderError("Google did not return an access token")

        channel = await provider.get_channel_info(access_token)
        channel_id = channel["channel_id"]
        channel_title = channel["title"]

        # Compute token expiry
        expires_in = token_data.get("expires_in")
        token_expires_at = None
        if expires_in:
            token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))

        refresh_token = token_data.get("refresh_token")

        accounts = [
            SocialAccount(
                id=channel_id,
                name=channel_title,
                category=YOUTUBE_ACCOUNT_TYPE,
                access_token=access_token,
                refresh_token=refresh_token,
                token_expires_at=token_expires_at.isoformat() if token_expires_at else None,
                scopes=[],
                metadata={
                    "channel_id": channel_id,
                    "channel_title": channel_title,
                    "custom_url": channel.get("custom_url", ""),
                    "subscriber_count": channel.get("subscriber_count"),
                    "thumbnail": channel.get("thumbnail"),
                },
            )
        ]
        await store_oauth_accounts(
            db,
            oauth_state_id=state_row["id"],
            provider="youtube",
            accounts=accounts,
        )

        # Auto-select: only one channel per Google account
        await select_account_connection(
            db,
            external_account_id=channel_id,
            provider="youtube",
            account_type=YOUTUBE_ACCOUNT_TYPE,
            admin_user_id=state_row.get("admin_user_id"),
            external_user_id=channel_id,
        )

        return RedirectResponse(
            _admin_return_url({"youtube_connected": "1", "youtube_channel": channel_title}),
            status_code=302,
        )
    except (SocialProviderError, TokenCryptoError) as exc:
        logger.warning("YouTube OAuth callback failed: %s", exc)
        return RedirectResponse(_admin_return_url({"youtube_error": str(exc)}), status_code=302)


@router.post("/disconnect", responses=_RESPONSES)
async def disconnect_youtube(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    disconnected = await disconnect_connection(db, provider="youtube", account_type=YOUTUBE_ACCOUNT_TYPE)
    return {"disconnected": disconnected}


@router.post("/test-connection", responses=_RESPONSES)
async def test_youtube_connection(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    """Verify the stored token is valid by fetching channel info."""
    connection = await get_connection(db, provider="youtube", account_type=YOUTUBE_ACCOUNT_TYPE)
    if not connection or connection["status"] == "disconnected":
        raise HTTPException(status_code=400, detail="YouTube channel is not connected")

    access_token = decrypt_token(connection.get("encrypted_access_token"))
    if not access_token:
        raise HTTPException(status_code=400, detail="YouTube token unavailable. Reconnect YouTube.")

    # Try refresh if token may be expired
    expires_at = connection.get("token_expires_at")
    if expires_at:
        expiry = expires_at if not isinstance(expires_at, str) else datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        if expiry <= datetime.now(timezone.utc):
            refresh_token = decrypt_token(connection.get("encrypted_refresh_token"))
            if not refresh_token:
                raise HTTPException(status_code=400, detail="YouTube token expired. Reconnect YouTube.")
            provider = YouTubeProvider()
            token_data = await provider.refresh_access_token(refresh_token)
            access_token = token_data.get("access_token")
            if not access_token:
                raise HTTPException(status_code=400, detail="YouTube token refresh failed. Reconnect YouTube.")
            new_expires_in = token_data.get("expires_in")
            new_expires_at = None
            if new_expires_in:
                new_expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(new_expires_in))
            await db.execute(
                """UPDATE social_connections
                   SET encrypted_access_token = ?, token_expires_at = ?, updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?""",
                (encrypt_token(access_token), new_expires_at, connection["id"]),
            )
            await db.commit()

    provider = YouTubeProvider()
    try:
        channel = await provider.get_channel_info(access_token)
        await mark_connection_checked(db, connection_id=connection["id"], status="connected")
        return {"ok": True, "channel": channel}
    except SocialProviderError as exc:
        await mark_connection_checked(db, connection_id=connection["id"], status="error", last_error=str(exc))
        raise HTTPException(status_code=502, detail=str(exc))
