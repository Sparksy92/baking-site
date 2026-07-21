from __future__ import annotations
from typing import Annotated

import json
import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from app.auth import require_admin
from app.database import PostgresConnection, get_db
from app.services.social.oauth_state import consume_oauth_state, create_oauth_state
from app.services.social.providers.base import SocialProviderError
from app.services.social.providers.tiktok import (
    TIKTOK_DIRECT_POST_DISABLED_ERROR,
    TIKTOK_DIRECT_POST_SCOPE,
    TIKTOK_TITLE_LIMIT,
    TikTokProvider,
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

router = APIRouter(prefix="/social/tiktok", tags=["social-tiktok"])
TIKTOK_ACCOUNT_TYPE = "tiktok_user"


class TikTokVideoRequest(BaseModel):
    video_url: str | None = None
    title: str | None = None


class TikTokDirectPostRequest(TikTokVideoRequest):
    privacy_level: str = Field(min_length=1)
    disable_duet: bool = False
    disable_comment: bool = False
    disable_stitch: bool = False


class TikTokPublishStatusRequest(BaseModel):
    publish_id: str = Field(min_length=1)


def _admin_return_url(query: dict[str, str]) -> str:
    base = "/admin/social/platforms"
    return f"{base}?{urlencode(query)}" if query else base


async def _get_tiktok_connection_and_token(db: PostgresConnection) -> tuple[dict, str]:
    connection = await get_connection(db, provider="tiktok", account_type=TIKTOK_ACCOUNT_TYPE)
    if not connection or connection["status"] == "disconnected":
        raise ValueError("TikTok account is not connected")
    if connection["status"] == "pending_review":
        raise ValueError("TikTok app review or required scope approval is missing.")
    token = decrypt_token(connection.get("encrypted_access_token"))
    if not token:
        raise ValueError("TikTok token is unavailable")
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
        await mark_connection_checked(db, connection_id=connection["id"], status="expired", last_error="TikTok token expired. Reconnect TikTok.")
        raise ValueError("TikTok token expired. Reconnect TikTok.")
    provider = TikTokProvider()
    token_data = await provider.refresh_access_token(refresh_token)
    new_token = token_data.get("access_token")
    new_refresh_token = token_data.get("refresh_token") or refresh_token
    if not new_token:
        await mark_connection_checked(db, connection_id=connection["id"], status="expired", last_error="TikTok token refresh failed. Reconnect TikTok.")
        raise ValueError("TikTok token refresh failed. Reconnect TikTok.")
    token_expires_at = _seconds_from_now(token_data.get("expires_in"))
    refresh_token_expires_at = _seconds_from_now(token_data.get("refresh_expires_in"))
    await db.execute(
        """UPDATE social_connections
           SET encrypted_access_token = ?, encrypted_refresh_token = ?,
               token_expires_at = ?, refresh_token_expires_at = ?,
               scopes = COALESCE(?, scopes),
               status = 'connected', last_error = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?""",
        (
            encrypt_token(str(new_token)),
            encrypt_token(str(new_refresh_token)),
            token_expires_at,
            refresh_token_expires_at,
            json.dumps(provider._parse_scopes(token_data.get("scope"))) if token_data.get("scope") else None,
            connection["id"],
        ),
    )
    await db.commit()
    return str(new_token)


def _seconds_from_now(seconds: object) -> datetime | None:
    try:
        value = int(seconds)
    except (TypeError, ValueError):
        return None
    return datetime.now(timezone.utc) + timedelta(seconds=value)


def _metadata(connection: dict) -> dict:
    value = connection.get("metadata")
    if isinstance(value, dict):
        return dict(value)
    if not value:
        return {}
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _scopes(connection: dict) -> list[str]:
    raw = connection.get("scopes")
    if not raw:
        return []
    if isinstance(raw, list):
        return raw
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        return [part for part in str(raw).replace(" ", ",").split(",") if part]


def _safe_title(title: str | None) -> str:
    value = (title or "Test upload from the ecommerce social platform. This confirms TikTok upload is connected.").strip()
    if len(value) > TIKTOK_TITLE_LIMIT:
        raise ValueError(f"TikTok captions must be {TIKTOK_TITLE_LIMIT} characters or fewer.")
    return value


@router.get("/status")
async def tiktok_status(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    provider = TikTokProvider()
    connection = await get_serialized_connection(db, provider="tiktok", account_type=TIKTOK_ACCOUNT_TYPE)
    return {
        "configured": provider.configured,
        "direct_post_feature_enabled": provider.direct_post_enabled,
        "connection": connection,
    }


@router.get("/connect")
async def connect_tiktok(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    provider = TikTokProvider()
    try:
        state = await create_oauth_state(db, provider="tiktok", admin_user_id=user.get("sub"))
        return RedirectResponse(provider.build_authorization_url(state=state), status_code=302)
    except SocialProviderError as exc:
        return RedirectResponse(_admin_return_url({"tiktok_error": str(exc)}), status_code=302)


@router.get("/callback")
async def tiktok_callback(
    db: Annotated[PostgresConnection, Depends(get_db)],
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    scopes: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
):
    if error:
        return RedirectResponse(_admin_return_url({"tiktok_error": error_description or error}), status_code=302)
    if not code or not state:
        return RedirectResponse(_admin_return_url({"tiktok_error": "Missing OAuth callback parameters"}), status_code=302)
    state_row = await consume_oauth_state(db, state=state, provider="tiktok")
    if not state_row:
        return RedirectResponse(_admin_return_url({"tiktok_error": "Invalid or expired OAuth state"}), status_code=302)

    provider = TikTokProvider()
    try:
        token_data = await provider.exchange_code_for_access_token(code)
        if scopes and not token_data.get("scope"):
            token_data["scope"] = scopes
        access_token = token_data.get("access_token")
        if not access_token:
            raise SocialProviderError("TikTok did not return an access token")
        profile = await provider.get_current_user_profile(str(access_token))
        account = provider.account_from_token_data(token_data, profile)
        await store_oauth_accounts(db, oauth_state_id=state_row["id"], provider="tiktok", accounts=[account])
        connection = await select_account_connection(
            db,
            external_account_id=account.id,
            provider="tiktok",
            account_type=TIKTOK_ACCOUNT_TYPE,
            admin_user_id=state_row.get("admin_user_id"),
            external_user_id=account.id,
        )
        return RedirectResponse(
            _admin_return_url({"tiktok_oauth": "connected", "tiktok_user": connection["external_account_id"]}),
            status_code=302,
        )
    except (SocialProviderError, TokenCryptoError, ValueError) as exc:
        logger.warning("TikTok OAuth callback failed: %s", exc)
        return RedirectResponse(_admin_return_url({"tiktok_error": str(exc)}), status_code=302)


@router.get("/account")
async def tiktok_account(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    connection = await get_serialized_connection(db, provider="tiktok", account_type=TIKTOK_ACCOUNT_TYPE)
    if not connection:
        return {"connection": None}
    metadata = connection.get("metadata") or {}
    return {
        "connection": {
            "display_name": connection.get("display_name"),
            "open_id": metadata.get("open_id") or connection.get("external_account_id"),
            "avatar_url": metadata.get("avatar_url"),
            "profile_deep_link": metadata.get("profile_deep_link"),
            "status": connection.get("status"),
            "scopes": connection.get("scopes", []),
            "token_expires_at": connection.get("token_expires_at"),
            "refresh_token_expires_at": connection.get("refresh_token_expires_at"),
            "last_checked_at": connection.get("last_checked_at"),
            "last_synced_at": connection.get("last_synced_at"),
            "last_error": connection.get("last_error"),
            "direct_post_enabled": metadata.get("direct_post_enabled", False),
            "upload_to_inbox_enabled": metadata.get("upload_to_inbox_enabled", False),
        }
    }


@router.post("/test-connection")
async def test_tiktok_connection(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    try:
        connection, token = await _get_tiktok_connection_and_token(db)
        token = await _refresh_if_expired(db, connection, token)
        result = await TikTokProvider().test_tiktok_connection(token)
        await mark_connection_checked(db, connection_id=connection["id"], status="connected")
        return {"ok": True, **result}
    except (ValueError, TokenCryptoError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SocialProviderError as exc:
        from app.database import db_connection

        status_value = "pending_review" if "scope" in str(exc).lower() or "review" in str(exc).lower() else "error"
        async with db_connection() as error_db:
            current = await get_serialized_connection(error_db, provider="tiktok", account_type=TIKTOK_ACCOUNT_TYPE)
            if current:
                await mark_connection_checked(error_db, connection_id=current["id"], status=status_value, last_error=str(exc))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.post("/upload-draft")
async def upload_tiktok_draft(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    body: TikTokVideoRequest,
):
    try:
        connection, token = await _get_tiktok_connection_and_token(db)
        token = await _refresh_if_expired(db, connection, token)
        if "video.upload" not in _scopes(connection):
            raise ValueError("TikTok video.upload scope is required for upload-to-inbox.")
        result = await TikTokProvider().init_video_upload_to_inbox(token, body.video_url)
        await mark_connection_checked(db, connection_id=connection["id"], status="connected")
        return {"ok": True, "publish_id": result.get("data", {}).get("publish_id"), "status": result.get("data", {})}
    except (ValueError, TokenCryptoError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SocialProviderError as exc:
        await _mark_current_tiktok_error(str(exc))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.post("/test-upload")
async def test_tiktok_upload(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    body: TikTokVideoRequest,
):
    body.title = _safe_title(body.title)
    return await upload_tiktok_draft(db=db, user=user, body=body)


@router.post("/direct-post")
async def direct_post_tiktok(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    body: TikTokDirectPostRequest,
):
    provider = TikTokProvider()
    if not provider.direct_post_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=TIKTOK_DIRECT_POST_DISABLED_ERROR)
    try:
        connection, token = await _get_tiktok_connection_and_token(db)
        token = await _refresh_if_expired(db, connection, token)
        if TIKTOK_DIRECT_POST_SCOPE not in _scopes(connection):
            raise ValueError(TIKTOK_DIRECT_POST_DISABLED_ERROR)
        creator_info = await provider.query_creator_info(token)
        privacy_options = creator_info.get("data", {}).get("privacy_level_options") or []
        if privacy_options and body.privacy_level not in privacy_options:
            raise ValueError("Selected TikTok privacy level is not available for this creator.")
        result = await provider.init_video_direct_post(
            token,
            body.video_url,
            _safe_title(body.title),
            body.privacy_level,
            disable_duet=body.disable_duet,
            disable_comment=body.disable_comment,
            disable_stitch=body.disable_stitch,
        )
        await mark_connection_checked(db, connection_id=connection["id"], status="connected")
        return {"ok": True, "publish_id": result.get("data", {}).get("publish_id"), "status": result.get("data", {})}
    except (ValueError, TokenCryptoError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SocialProviderError as exc:
        await _mark_current_tiktok_error(str(exc))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.get("/publish-status")
async def get_tiktok_publish_status(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    publish_id: str = Query(min_length=1),
):
    try:
        connection, token = await _get_tiktok_connection_and_token(db)
        token = await _refresh_if_expired(db, connection, token)
        result = await TikTokProvider().check_publish_status(token, publish_id)
        await mark_connection_checked(db, connection_id=connection["id"], status="connected")
        return {"ok": True, "status": result.get("data", {})}
    except (ValueError, TokenCryptoError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SocialProviderError as exc:
        await _mark_current_tiktok_error(str(exc))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.post("/publish-status")
async def post_tiktok_publish_status(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    body: TikTokPublishStatusRequest,
):
    return await get_tiktok_publish_status(db=db, user=user, publish_id=body.publish_id)


@router.post("/disconnect")
async def disconnect_tiktok(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    disconnected = await disconnect_connection(db, provider="tiktok", account_type=TIKTOK_ACCOUNT_TYPE)
    return {"disconnected": disconnected}


async def _mark_current_tiktok_error(message: str) -> None:
    from app.database import db_connection

    status_value = "pending_review" if "scope" in message.lower() or "review" in message.lower() else "error"
    async with db_connection() as error_db:
        current = await get_serialized_connection(error_db, provider="tiktok", account_type=TIKTOK_ACCOUNT_TYPE)
        if current:
            await mark_connection_checked(error_db, connection_id=current["id"], status=status_value, last_error=message)
