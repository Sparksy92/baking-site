"""Pinterest OAuth routes.

Routes:
  GET  /social/pinterest/status          — connection status + configured flag
  GET  /social/pinterest/connect         — start OAuth redirect to Pinterest
  GET  /social/pinterest/callback        — OAuth callback (registered in Pinterest app)
  POST /social/pinterest/disconnect      — remove stored connection
  POST /social/pinterest/test-connection — verify token by fetching user info
  GET  /social/pinterest/boards          — list connected account boards
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
from app.services.social.providers.pinterest import PinterestProvider
from app.services.social.service import (
    disconnect_connection,
    get_connection,
    get_serialized_connection,
    mark_connection_checked,
    store_oauth_accounts,
    select_account_connection,
)
from app.services.social.token_crypto import TokenCryptoError, decrypt_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/social/pinterest", tags=["social-pinterest"])

_RESPONSES = {400: {"description": "Bad Request"}, 502: {"description": "Bad Gateway"}}
PINTEREST_ACCOUNT_TYPE = "personal"


def _admin_return_url(query: dict[str, str]) -> str:
    base = "/admin/social/platforms"
    return f"{base}?{urlencode(query)}" if query else base


@router.get("/status", responses=_RESPONSES)
async def pinterest_status(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    """Return current Pinterest connection status and configured flag."""
    provider = PinterestProvider()
    connection = await get_serialized_connection(
        db, provider="pinterest", account_type=PINTEREST_ACCOUNT_TYPE
    )
    return {"configured": bool(provider.client_id and provider.client_secret), "connection": connection}


@router.get("/connect", responses=_RESPONSES)
async def pinterest_connect(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    """Initiate Pinterest OAuth flow — redirect to Pinterest authorization."""
    provider = PinterestProvider()
    if not provider.client_id:
        return RedirectResponse(
            _admin_return_url({"pinterest_error": "Pinterest credentials not configured. Set PINTEREST_CLIENT_ID and PINTEREST_CLIENT_SECRET."}),
            status_code=302,
        )
    try:
        state = await create_oauth_state(db, provider="pinterest", admin_user_id=user.get("sub"))
        return RedirectResponse(provider.get_auth_url(state), status_code=302)
    except Exception as exc:
        return RedirectResponse(_admin_return_url({"pinterest_error": str(exc)}), status_code=302)


@router.get("/callback", responses=_RESPONSES)
async def pinterest_callback(
    db: Annotated[PostgresConnection, Depends(get_db)],
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
):
    """Handle Pinterest OAuth callback."""
    if error:
        logger.warning("Pinterest OAuth error: %s", error)
        return RedirectResponse(
            _admin_return_url({"pinterest_error": error_description or error}), status_code=302
        )
    if not code or not state:
        return RedirectResponse(
            _admin_return_url({"pinterest_error": "Missing OAuth callback parameters"}), status_code=302
        )

    state_row = await consume_oauth_state(db, state=state, provider="pinterest")
    if not state_row:
        return RedirectResponse(
            _admin_return_url({"pinterest_error": "Invalid or expired OAuth state"}), status_code=302
        )

    provider = PinterestProvider()
    try:
        token_data = await provider.exchange_code(code)
        access_token = token_data.get("access_token")
        if not access_token:
            raise SocialProviderError("Pinterest did not return an access token")

        user_info = await provider.get_user_info(access_token)
        boards = []
        try:
            boards = await provider.get_boards(access_token)
        except Exception:
            pass
        default_board = boards[0] if boards else None
        username = user_info.get("username", "unknown")
        display_name = user_info.get("display_name") or username

        accounts = [
            {
                "external_account_id": username,
                "name": display_name,
                "account_type": PINTEREST_ACCOUNT_TYPE,
                "access_token": access_token,
                "refresh_token": token_data.get("refresh_token"),
                "token_expires_at": None,
                "metadata": json.dumps({
                    "username": username,
                    "display_name": display_name,
                    "profile_image": user_info.get("profile_image"),
                    "default_board_id": default_board["id"] if default_board else None,
                    "default_board_name": default_board["name"] if default_board else None,
                    "boards": boards[:10],
                }),
            }
        ]
        await store_oauth_accounts(
            db,
            oauth_state_id=state_row["id"],
            provider="pinterest",
            accounts=accounts,
        )
        await select_account_connection(
            db,
            external_account_id=username,
            provider="pinterest",
            account_type=PINTEREST_ACCOUNT_TYPE,
            admin_user_id=state_row.get("admin_user_id"),
            external_user_id=username,
        )

        logger.info("Pinterest connected: %s", username)
        return RedirectResponse(
            _admin_return_url({"pinterest_connected": "1", "pinterest_user": display_name}),
            status_code=302,
        )
    except (SocialProviderError, TokenCryptoError) as exc:
        logger.warning("Pinterest OAuth callback failed: %s", exc)
        return RedirectResponse(_admin_return_url({"pinterest_error": str(exc)}), status_code=302)


@router.post("/disconnect", responses=_RESPONSES)
async def pinterest_disconnect(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    """Disconnect the Pinterest account."""
    disconnected = await disconnect_connection(db, provider="pinterest", account_type=PINTEREST_ACCOUNT_TYPE)
    return {"disconnected": disconnected}


@router.post("/test-connection", responses=_RESPONSES)
async def pinterest_test_connection(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    """Verify the stored token is valid by fetching Pinterest user info."""
    connection = await get_connection(db, provider="pinterest", account_type=PINTEREST_ACCOUNT_TYPE)
    if not connection or connection["status"] == "disconnected":
        raise HTTPException(status_code=400, detail="Pinterest is not connected")

    access_token = decrypt_token(connection.get("encrypted_access_token"))
    if not access_token:
        raise HTTPException(status_code=400, detail="Pinterest token unavailable. Reconnect Pinterest.")

    provider = PinterestProvider()
    try:
        user_info = await provider.get_user_info(access_token)
        await mark_connection_checked(db, connection_id=connection["id"], status="connected")
        return {"ok": True, "user": user_info}
    except SocialProviderError as exc:
        await mark_connection_checked(db, connection_id=connection["id"], status="error", last_error=str(exc))
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/boards", responses=_RESPONSES)
async def pinterest_boards(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    """List the connected account's Pinterest boards."""
    connection = await get_connection(db, provider="pinterest", account_type=PINTEREST_ACCOUNT_TYPE)
    if not connection or connection["status"] == "disconnected":
        raise HTTPException(status_code=400, detail="Pinterest is not connected")

    access_token = decrypt_token(connection.get("encrypted_access_token"))
    if not access_token:
        raise HTTPException(status_code=400, detail="Pinterest token unavailable.")

    provider = PinterestProvider()
    boards = await provider.get_boards(access_token)
    return {"boards": boards}
