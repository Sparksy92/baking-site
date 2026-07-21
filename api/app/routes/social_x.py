from __future__ import annotations
from typing import Annotated

import json
import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from app.auth import require_admin
from app.database import PostgresConnection, get_db
from app.services.social.oauth_state import consume_oauth_state, create_oauth_state
from app.services.social.providers.base import SocialProviderError
from app.services.social.providers.x import (
    X_DEFAULT_TEST_POST,
    X_MEDIA_DISABLED_ERROR,
    X_MISSING_WRITE_SCOPE_ERROR,
    X_REQUIRED_SCOPES,
    X_WRITE_ACCESS_ERROR,
    XProvider,
)
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

router = APIRouter(prefix="/social/x", tags=["social-x"])
X_ACCOUNT_TYPE = "user_account"


class XPostRequest(BaseModel):
    text: str | None = None


class XLinkPostRequest(BaseModel):
    text: str = Field(min_length=1)
    link_url: str = Field(min_length=1)


class XMediaPostRequest(BaseModel):
    text: str | None = None
    media_url: str | None = None
    media_id: str | None = None


def _admin_return_url(query: dict[str, str]) -> str:
    base = "/admin/social/platforms"
    return f"{base}?{urlencode(query)}" if query else base


def _loads_metadata(value: object) -> dict:
    if isinstance(value, dict):
        return value
    if not value:
        return {}
    try:
        parsed = json.loads(str(value))
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _scopes(connection: dict) -> list[str]:
    raw = connection.get("scopes")
    if isinstance(raw, list):
        return raw
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        return [part for part in str(raw).replace(",", " ").split() if part]


def _seconds_from_now(seconds: object) -> datetime | None:
    try:
        value = int(seconds)
    except (TypeError, ValueError):
        return None
    return datetime.now(timezone.utc) + timedelta(seconds=value)


async def _get_x_connection_and_token(db: PostgresConnection) -> tuple[dict, str]:
    connection = await get_connection(db, provider="x", account_type=X_ACCOUNT_TYPE)
    if not connection or connection["status"] == "disconnected":
        raise ValueError("X/Twitter account is not connected.")
    if connection["status"] == "pending_api_access":
        raise ValueError(connection.get("last_error") or X_WRITE_ACCESS_ERROR)
    token = decrypt_token(connection.get("encrypted_access_token"))
    if not token:
        raise ValueError("X/Twitter token is unavailable. Reconnect X/Twitter.")
    return connection, token


async def _refresh_if_expired(db: PostgresConnection, connection: dict, token: str) -> str:
    expires_at = connection.get("token_expires_at")
    if not expires_at:
        return token
    expiry = expires_at
    if isinstance(expiry, str):
        expiry = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if expiry > datetime.now(timezone.utc):
        return token
    refresh_token = decrypt_token(connection.get("encrypted_refresh_token"))
    if not refresh_token:
        await mark_connection_checked(db, connection_id=connection["id"], status="expired", last_error="X/Twitter token expired. Reconnect X/Twitter.")
        raise ValueError("X/Twitter token expired. Reconnect X/Twitter.")
    provider = XProvider()
    token_data = await provider.refresh_access_token(refresh_token)
    new_token = token_data.get("access_token")
    new_refresh_token = token_data.get("refresh_token") or refresh_token
    if not new_token:
        await mark_connection_checked(db, connection_id=connection["id"], status="expired", last_error="X/Twitter token refresh failed. Reconnect X/Twitter.")
        raise ValueError("X/Twitter token refresh failed. Reconnect X/Twitter.")
    await db.execute(
        """UPDATE social_connections
           SET encrypted_access_token = ?, encrypted_refresh_token = ?,
               token_expires_at = ?, scopes = COALESCE(?, scopes),
               status = 'connected', last_error = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?""",
        (
            encrypt_token(str(new_token)),
            encrypt_token(str(new_refresh_token)),
            _seconds_from_now(token_data.get("expires_in")),
            json.dumps(provider._parse_scopes(token_data.get("scope"))) if token_data.get("scope") else None,
            connection["id"],
        ),
    )
    await db.commit()
    return str(new_token)


def _permalink(username: str | None, post_id: str | None) -> str | None:
    if not post_id:
        return None
    if username:
        return f"https://x.com/{username}/status/{post_id}"
    return f"https://x.com/i/web/status/{post_id}"


def _connection_username(connection: dict) -> str | None:
    return _loads_metadata(connection.get("metadata")).get("username")


def _post_response(connection: dict, result: dict) -> dict:
    data = result.get("data", {})
    post_id = data.get("id")
    return {
        "ok": True,
        "post_id": post_id,
        "url": _permalink(_connection_username(connection), post_id),
        "text": data.get("text"),
    }


async def _mark_current_x_error(message: str) -> None:
    from app.database import db_connection

    status_value = "pending_api_access" if message in {X_WRITE_ACCESS_ERROR, X_MISSING_WRITE_SCOPE_ERROR} else "error"
    if "rate limit" in message.lower():
        status_value = "error"
    async with db_connection() as error_db:
        current = await get_connection(error_db, provider="x", account_type=X_ACCOUNT_TYPE)
        if current:
            await mark_connection_checked(error_db, connection_id=current["id"], status=status_value, last_error=message)


@router.get("/status")
async def x_status(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    provider = XProvider()
    connection = await get_serialized_connection(db, provider="x", account_type=X_ACCOUNT_TYPE)
    return {
        "configured": provider.configured,
        "media_posts_enabled": provider.media_posts_enabled,
        "required_scopes": X_REQUIRED_SCOPES,
        "connection": connection,
    }


@router.get("/connect")
async def connect_x(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    provider = XProvider()
    try:
        code_verifier = provider.generate_pkce_code_verifier()
        code_challenge = provider.generate_pkce_code_challenge(code_verifier)
        state = await create_oauth_state(
            db,
            provider="x",
            admin_user_id=user.get("sub"),
            metadata={"code_verifier": code_verifier},
        )
        return RedirectResponse(provider.build_authorization_url(state=state, code_challenge=code_challenge), status_code=302)
    except SocialProviderError as exc:
        return RedirectResponse(_admin_return_url({"x_error": str(exc)}), status_code=302)


@router.get("/callback")
async def x_callback(
    db: Annotated[PostgresConnection, Depends(get_db)],
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
):
    if error:
        return RedirectResponse(_admin_return_url({"x_error": error_description or error}), status_code=302)
    if not code or not state:
        return RedirectResponse(_admin_return_url({"x_error": "Missing OAuth callback parameters"}), status_code=302)
    state_row = await consume_oauth_state(db, state=state, provider="x")
    if not state_row:
        return RedirectResponse(_admin_return_url({"x_error": "Invalid or expired OAuth state"}), status_code=302)
    code_verifier = _loads_metadata(state_row.get("metadata")).get("code_verifier")
    if not code_verifier:
        return RedirectResponse(_admin_return_url({"x_error": "Missing OAuth PKCE verifier. Reconnect X/Twitter."}), status_code=302)
    provider = XProvider()
    try:
        token_data = await provider.exchange_code_for_access_token(code, code_verifier)
        access_token = token_data.get("access_token")
        if not access_token:
            raise SocialProviderError("X did not return an access token")
        profile = await provider.get_current_user_profile(str(access_token))
        account = provider.account_from_token_data(token_data, profile)
        await store_oauth_accounts(db, oauth_state_id=state_row["id"], provider="x", accounts=[account])
        connection = await select_account_connection(
            db,
            external_account_id=account.id,
            provider="x",
            account_type=X_ACCOUNT_TYPE,
            admin_user_id=state_row.get("admin_user_id"),
            external_user_id=account.id,
        )
        return RedirectResponse(_admin_return_url({"x_oauth": "connected", "x_user": connection["external_account_id"]}), status_code=302)
    except (SocialProviderError, TokenCryptoError, ValueError) as exc:
        logger.warning("X OAuth callback failed: %s", exc)
        return RedirectResponse(_admin_return_url({"x_error": str(exc)}), status_code=302)


@router.get("/account")
async def x_account(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    connection = await get_serialized_connection(db, provider="x", account_type=X_ACCOUNT_TYPE)
    if not connection:
        return {"connection": None}
    metadata = connection.get("metadata") or {}
    return {
        "connection": {
            "display_name": connection.get("display_name"),
            "username": metadata.get("username"),
            "user_id": connection.get("external_account_id"),
            "profile_image_url": metadata.get("profile_image_url"),
            "status": connection.get("status"),
            "scopes": connection.get("scopes", []),
            "token_expires_at": connection.get("token_expires_at"),
            "last_checked_at": connection.get("last_checked_at"),
            "last_error": connection.get("last_error"),
            "media_posts_enabled": metadata.get("media_posts_enabled", False),
        }
    }


@router.post("/test-connection")
async def test_x_connection(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    try:
        connection, token = await _get_x_connection_and_token(db)
        token = await _refresh_if_expired(db, connection, token)
        result = await XProvider().test_x_connection(token)
        await mark_connection_checked(db, connection_id=connection["id"], status="connected")
        return {"ok": True, **result}
    except (ValueError, TokenCryptoError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SocialProviderError as exc:
        await _mark_current_x_error(str(exc))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.post("/test-post")
async def test_x_post(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    body: XPostRequest,
):
    text = body.text or X_DEFAULT_TEST_POST
    try:
        connection, token = await _get_x_connection_and_token(db)
        if "tweet.write" not in _scopes(connection):
            raise ValueError(X_MISSING_WRITE_SCOPE_ERROR)
        token = await _refresh_if_expired(db, connection, token)
        result = await XProvider().publish_text_post(token, text)
        await mark_connection_checked(db, connection_id=connection["id"], status="connected")
        return _post_response(connection, result)
    except (ValueError, TokenCryptoError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SocialProviderError as exc:
        await _mark_current_x_error(str(exc))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.post("/post-link")
async def post_x_link(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    body: XLinkPostRequest,
):
    try:
        connection, token = await _get_x_connection_and_token(db)
        if "tweet.write" not in _scopes(connection):
            raise ValueError(X_MISSING_WRITE_SCOPE_ERROR)
        token = await _refresh_if_expired(db, connection, token)
        result = await XProvider().publish_link_post(token, body.text, body.link_url)
        await mark_connection_checked(db, connection_id=connection["id"], status="connected")
        return _post_response(connection, result)
    except (ValueError, TokenCryptoError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SocialProviderError as exc:
        await _mark_current_x_error(str(exc))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.post("/media-post")
async def post_x_media(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    body: XMediaPostRequest,
):
    provider = XProvider()
    if not provider.media_posts_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=X_MEDIA_DISABLED_ERROR)
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=X_MEDIA_DISABLED_ERROR)


@router.post("/disconnect")
async def disconnect_x(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    disconnected = await disconnect_connection(db, provider="x", account_type=X_ACCOUNT_TYPE)
    return {"disconnected": disconnected}
