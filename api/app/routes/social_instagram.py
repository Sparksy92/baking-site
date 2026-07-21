from __future__ import annotations
from typing import Annotated

import logging
from urllib.parse import urlencode, urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from app.auth import require_admin
from app.database import PostgresConnection, get_db
from app.services.social.oauth_state import consume_oauth_state, create_oauth_state
from app.services.social.providers.base import SocialProviderError
from app.services.social.providers.instagram import INSTAGRAM_CAPTION_LIMIT, InstagramProvider
from app.services.social.service import (
    disconnect_connection,
    get_connection,
    get_serialized_connection,
    list_available_accounts,
    mark_connection_checked,
    select_account_connection,
    store_oauth_accounts,
)
from app.services.social.token_crypto import TokenCryptoError, decrypt_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/social/instagram", tags=["social-instagram"])
INSTAGRAM_ACCOUNT_TYPE = "professional_account"


class SelectInstagramAccountRequest(BaseModel):
    ig_user_id: str = Field(min_length=1)
    linked_facebook_page_id: str | None = None


class InstagramTestPostRequest(BaseModel):
    image_url: str | None = None
    caption: str = "Test post from the ecommerce social platform. This confirms Instagram publishing is connected."


def _admin_return_url(query: dict[str, str]) -> str:
    base = "/admin/social/platforms"
    return f"{base}?{urlencode(query)}" if query else base


def _validate_public_https_image_url(image_url: str | None) -> str:
    if not image_url:
        raise ValueError("Instagram requires an image or video for feed publishing.")
    parsed = urlparse(image_url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("Instagram test posts require a public HTTPS image URL.")
    return image_url


async def _get_instagram_connection_and_token(db: PostgresConnection) -> tuple[dict, str]:
    connection = await get_connection(db, provider="instagram", account_type=INSTAGRAM_ACCOUNT_TYPE)
    if not connection or connection["status"] == "disconnected":
        raise ValueError("Instagram Professional account is not connected")
    token = decrypt_token(connection.get("encrypted_access_token"))
    if not token:
        raise ValueError("Instagram token is unavailable")
    return connection, token


@router.get("/status")
async def instagram_status(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    provider = InstagramProvider()
    connection = await get_serialized_connection(
        db,
        provider="instagram",
        account_type=INSTAGRAM_ACCOUNT_TYPE,
    )
    return {"configured": provider.configured, "connection": connection}


@router.get("/connect")
async def connect_instagram(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    provider = InstagramProvider()
    try:
        state = await create_oauth_state(db, provider="instagram", admin_user_id=user.get("sub"))
        return RedirectResponse(provider.build_authorization_url(state=state), status_code=302)
    except SocialProviderError as exc:
        return RedirectResponse(_admin_return_url({"instagram_error": str(exc)}), status_code=302)


@router.get("/callback")
async def instagram_callback(
    db: Annotated[PostgresConnection, Depends(get_db)],
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
):
    if error:
        return RedirectResponse(
            _admin_return_url({"instagram_error": error_description or error}),
            status_code=302,
        )
    if not code or not state:
        return RedirectResponse(
            _admin_return_url({"instagram_error": "Missing OAuth callback parameters"}),
            status_code=302,
        )

    state_row = await consume_oauth_state(db, state=state, provider="instagram")
    if not state_row:
        return RedirectResponse(
            _admin_return_url({"instagram_error": "Invalid or expired OAuth state"}),
            status_code=302,
        )

    provider = InstagramProvider()
    try:
        token_data = await provider.exchange_code_for_user_token(code)
        user_token = token_data.get("access_token")
        if not user_token:
            raise SocialProviderError("Meta did not return a user access token")
        long_lived = await provider.exchange_for_long_lived_user_token(user_token)
        user_token = long_lived.get("access_token") or user_token
        profile = await provider.get_user_profile(user_token)
        accounts = await provider.list_instagram_accounts(user_token)
        await store_oauth_accounts(db, oauth_state_id=state_row["id"], provider="instagram", accounts=accounts)
        query = {
            "instagram_oauth": "accounts",
            "instagram_accounts": str(len(accounts)),
        }
        if profile.get("id"):
            query["instagram_user"] = str(profile["id"])
        if not accounts:
            query["instagram_error"] = (
                "No connected Instagram Professional account found. Make sure the Instagram account is Business "
                "or Creator and connected to a Facebook Page you manage."
            )
        return RedirectResponse(_admin_return_url(query), status_code=302)
    except (SocialProviderError, TokenCryptoError) as exc:
        logger.warning("Instagram OAuth callback failed: %s", exc)
        return RedirectResponse(_admin_return_url({"instagram_error": str(exc)}), status_code=302)


@router.get("/accounts")
async def instagram_accounts(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    accounts = await list_available_accounts(
        db,
        provider="instagram",
        account_type=INSTAGRAM_ACCOUNT_TYPE,
    )
    return {
        "accounts": [
            {
                "ig_user_id": account["external_account_id"],
                "username": account["metadata"].get("instagram_username") or account["name"],
                "name": account["metadata"].get("instagram_account_name") or account["name"],
                "profile_picture_url": account["metadata"].get("instagram_profile_picture_url"),
                "linked_facebook_page_id": account["metadata"].get("linked_facebook_page_id"),
                "linked_facebook_page_name": account["metadata"].get("linked_facebook_page_name"),
                "connection_status": account.get("connection_status"),
                "connected": account.get("connected", False),
            }
            for account in accounts
        ]
    }


@router.post("/accounts/select")
async def select_instagram_account(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    body: SelectInstagramAccountRequest,
):
    try:
        connection = await select_account_connection(
            db,
            external_account_id=body.ig_user_id,
            provider="instagram",
            account_type=INSTAGRAM_ACCOUNT_TYPE,
            admin_user_id=user.get("sub"),
            external_user_id=None,
        )
        return {"connection": connection}
    except (ValueError, TokenCryptoError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/sync-accounts")
async def sync_instagram_accounts(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    try:
        connection, token = await _get_instagram_connection_and_token(db)
        provider = InstagramProvider()
        details = await provider.get_instagram_account_details(connection["external_account_id"], token)
        metadata = dict(connection.get("metadata") or {})
        metadata.update(
            {
                "instagram_username": details.get("username") or metadata.get("instagram_username"),
                "instagram_account_name": details.get("name") or metadata.get("instagram_account_name"),
                "instagram_profile_picture_url": details.get("profile_picture_url") or metadata.get("instagram_profile_picture_url"),
                "media_count": details.get("media_count", metadata.get("media_count")),
            }
        )
        import json

        await db.execute(
            """UPDATE social_connections
               SET display_name = ?, metadata = ?, last_synced_at = CURRENT_TIMESTAMP,
                   last_error = NULL, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (details.get("username") or connection["display_name"], json.dumps(metadata), connection["id"]),
        )
        await db.commit()
        updated = await get_serialized_connection(db, provider="instagram", account_type=INSTAGRAM_ACCOUNT_TYPE)
        return {"connection": updated}
    except (ValueError, TokenCryptoError, SocialProviderError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/test-connection")
async def test_instagram_connection(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    try:
        connection, token = await _get_instagram_connection_and_token(db)
        provider = InstagramProvider()
        result = await provider.test_instagram_connection(token, connection["external_account_id"])
        await mark_connection_checked(db, connection_id=connection["id"], status="connected")
        return {"ok": True, **result}
    except (ValueError, TokenCryptoError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SocialProviderError as exc:
        from app.database import db_connection

        async with db_connection() as error_db:
            current = await get_serialized_connection(error_db, provider="instagram", account_type=INSTAGRAM_ACCOUNT_TYPE)
            if current:
                await mark_connection_checked(error_db, connection_id=current["id"], status="error", last_error=str(exc))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.post("/test-post")
async def test_instagram_post(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    body: InstagramTestPostRequest,
):
    try:
        image_url = _validate_public_https_image_url(body.image_url)
        caption = body.caption or ""
        if len(caption) > INSTAGRAM_CAPTION_LIMIT:
            raise ValueError(f"Instagram captions must be {INSTAGRAM_CAPTION_LIMIT} characters or fewer")
        connection, token = await _get_instagram_connection_and_token(db)
        provider = InstagramProvider()
        result = await provider.publish_single_image_post(
            token,
            connection["external_account_id"],
            image_url,
            caption,
        )
        media_id = result.get("id")
        return {
            "ok": True,
            "media_id": media_id,
            "permalink": f"https://www.instagram.com/p/{media_id}/" if media_id else None,
        }
    except (ValueError, TokenCryptoError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SocialProviderError as exc:
        from app.database import db_connection

        async with db_connection() as error_db:
            current = await get_serialized_connection(error_db, provider="instagram", account_type=INSTAGRAM_ACCOUNT_TYPE)
            if current:
                await mark_connection_checked(error_db, connection_id=current["id"], status="error", last_error=str(exc))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.post("/disconnect")
async def disconnect_instagram(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    disconnected = await disconnect_connection(db, provider="instagram", account_type=INSTAGRAM_ACCOUNT_TYPE)
    return {"disconnected": disconnected}
