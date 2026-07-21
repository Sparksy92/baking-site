"""Threads (Meta) OAuth routes.

Threads reuses your existing META_APP_ID / META_APP_SECRET.
Add META_THREADS_REDIRECT_URI to .env and register it in the
Meta developer portal under your app's Threads product.

Routes:
  GET  /social/threads/status          — connection status + configured flag
  GET  /social/threads/connect         — start OAuth redirect to Threads
  GET  /social/threads/callback        — OAuth callback
  POST /social/threads/disconnect      — remove stored connection
  POST /social/threads/test-connection — verify token by fetching user info
"""
from __future__ import annotations
from typing import Annotated

import json
import logging
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.auth import require_admin
from app.database import PostgresConnection, get_db
from app.services.social.oauth_state import consume_oauth_state, create_oauth_state
from app.services.social.providers.base import SocialProviderError
from app.services.social.providers.threads import ThreadsProvider
from app.services.social.service import (
    disconnect_connection,
    get_connection,
    get_serialized_connection,
    mark_connection_checked,
    select_account_connection,
    store_oauth_accounts,
)
from app.services.social.token_crypto import TokenCryptoError, decrypt_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/social/threads", tags=["social-threads"])

_RESPONSES = {400: {"description": "Bad Request"}, 502: {"description": "Bad Gateway"}}
THREADS_ACCOUNT_TYPE = "threads_user"


def _admin_return_url(query: dict[str, str]) -> str:
    base = "/admin/social/platforms"
    return f"{base}?{urlencode(query)}" if query else base


@router.get("/status", responses=_RESPONSES)
async def threads_status(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    """Return current Threads connection status and configured flag."""
    provider = ThreadsProvider()
    connection = await get_serialized_connection(
        db, provider="threads", account_type=THREADS_ACCOUNT_TYPE
    )
    return {"configured": provider.configured, "connection": connection}


@router.get("/connect", responses=_RESPONSES)
async def threads_connect(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    """Initiate Threads OAuth flow — redirect to Threads authorization."""
    provider = ThreadsProvider()
    try:
        provider.assert_configured()
        state = await create_oauth_state(db, provider="threads", admin_user_id=user.get("sub"))
        return RedirectResponse(provider.build_authorization_url(state=state), status_code=302)
    except SocialProviderError as exc:
        return RedirectResponse(_admin_return_url({"threads_error": str(exc)}), status_code=302)


@router.get("/callback", responses=_RESPONSES)
async def threads_callback(
    db: Annotated[PostgresConnection, Depends(get_db)],
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
):
    """Handle Threads OAuth callback."""
    if error:
        logger.warning("Threads OAuth error: %s", error)
        return RedirectResponse(
            _admin_return_url({"threads_error": error_description or error}), status_code=302
        )
    if not code or not state:
        return RedirectResponse(
            _admin_return_url({"threads_error": "Missing OAuth callback parameters"}), status_code=302
        )

    state_row = await consume_oauth_state(db, state=state, provider="threads")
    if not state_row:
        return RedirectResponse(
            _admin_return_url({"threads_error": "Invalid or expired OAuth state"}), status_code=302
        )

    provider = ThreadsProvider()
    try:
        token_data = await provider.exchange_code_for_token(code)
        access_token = token_data.get("access_token")
        if not access_token:
            raise SocialProviderError("Threads did not return an access token")

        threads_user_id = str(token_data.get("user_id", ""))
        user_info = await provider.get_user_info(access_token)
        username    = user_info.get("username", threads_user_id or "unknown")
        display_name = user_info.get("name") or username
        external_id  = user_info.get("id") or threads_user_id or username

        accounts = [
            {
                "external_account_id": external_id,
                "name":                display_name,
                "account_type":        THREADS_ACCOUNT_TYPE,
                "access_token":        access_token,
                "refresh_token":       None,
                "token_expires_at":    None,
                "metadata": json.dumps({
                    "user_id":      external_id,
                    "username":     username,
                    "display_name": display_name,
                    "biography":    user_info.get("threads_biography"),
                    "profile_picture_url": user_info.get("threads_profile_picture_url"),
                }),
            }
        ]
        await store_oauth_accounts(
            db,
            oauth_state_id=state_row["id"],
            provider="threads",
            accounts=accounts,
        )
        await select_account_connection(
            db,
            external_account_id=external_id,
            provider="threads",
            account_type=THREADS_ACCOUNT_TYPE,
            admin_user_id=state_row.get("admin_user_id"),
            external_user_id=external_id,
        )

        logger.info("Threads connected: @%s (id=%s)", username, external_id)
        return RedirectResponse(
            _admin_return_url({"threads_connected": "1", "threads_user": display_name}),
            status_code=302,
        )
    except (SocialProviderError, TokenCryptoError) as exc:
        logger.warning("Threads OAuth callback failed: %s", exc)
        return RedirectResponse(_admin_return_url({"threads_error": str(exc)}), status_code=302)


@router.post("/disconnect", responses=_RESPONSES)
async def threads_disconnect(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    """Disconnect the Threads account."""
    disconnected = await disconnect_connection(
        db, provider="threads", account_type=THREADS_ACCOUNT_TYPE
    )
    return {"disconnected": disconnected}


@router.post("/test-connection", responses=_RESPONSES)
async def threads_test_connection(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    """Verify the stored token is valid by fetching Threads user info."""
    connection = await get_connection(db, provider="threads", account_type=THREADS_ACCOUNT_TYPE)
    if not connection or connection["status"] == "disconnected":
        raise HTTPException(status_code=400, detail="Threads is not connected")

    access_token = decrypt_token(connection.get("encrypted_access_token"))
    if not access_token:
        raise HTTPException(
            status_code=400, detail="Threads token unavailable. Reconnect Threads."
        )

    provider = ThreadsProvider()
    try:
        user_info = await provider.get_user_info(access_token)
        await mark_connection_checked(db, connection_id=connection["id"], status="connected")
        return {"ok": True, "user": user_info}
    except SocialProviderError as exc:
        await mark_connection_checked(
            db, connection_id=connection["id"], status="error", last_error=str(exc)
        )
        raise HTTPException(status_code=502, detail=str(exc))
