from __future__ import annotations
from typing import Annotated

import logging
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from app.auth import require_admin
from app.config import get_settings
from app.database import PostgresConnection, get_db
from app.services.social.oauth_state import consume_oauth_state, create_oauth_state
from app.services.social.providers.base import SocialProviderError
from app.services.social.providers.facebook import FacebookProvider
from app.services.social.service import (
    disconnect_connection,
    get_decrypted_page_token,
    get_serialized_connection,
    list_available_pages,
    mark_connection_checked,
    select_page_connection,
    store_oauth_pages,
)
from app.services.social.token_crypto import TokenCryptoError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/social/facebook", tags=["social-facebook"])


class SelectPageRequest(BaseModel):
    page_id: str = Field(min_length=1)


class TestPostRequest(BaseModel):
    message: str = "Test post from the ecommerce social platform. This confirms Facebook Page publishing is connected."
    link: str | None = None


def _admin_return_url(query: dict[str, str]) -> str:
    base = "/admin/social/platforms"
    if not query:
        return base
    return f"{base}?{urlencode(query)}"


@router.get("/status")
async def facebook_status(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    provider = FacebookProvider()
    connection = await get_serialized_connection(db, provider="facebook")
    return {
        "configured": provider.configured,
        "connection": connection,
    }


@router.get("/connect")
async def connect_facebook(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    provider = FacebookProvider()
    try:
        state = await create_oauth_state(
            db,
            provider="facebook",
            admin_user_id=user.get("sub"),
        )
        return RedirectResponse(provider.build_authorization_url(state=state), status_code=302)
    except SocialProviderError as exc:
        return RedirectResponse(
            _admin_return_url({"facebook_error": str(exc)}),
            status_code=302,
        )


@router.get("/callback")
async def facebook_callback(
    db: Annotated[PostgresConnection, Depends(get_db)],
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
):
    if error:
        return RedirectResponse(
            _admin_return_url({"facebook_error": error_description or error}),
            status_code=302,
        )
    if not code or not state:
        return RedirectResponse(
            _admin_return_url({"facebook_error": "Missing OAuth callback parameters"}),
            status_code=302,
        )

    state_row = await consume_oauth_state(db, state=state, provider="facebook")
    if not state_row:
        return RedirectResponse(
            _admin_return_url({"facebook_error": "Invalid or expired OAuth state"}),
            status_code=302,
        )

    provider = FacebookProvider()
    try:
        token_data = await provider.exchange_code_for_user_token(code)
        user_token = token_data.get("access_token")
        if not user_token:
            raise SocialProviderError("Facebook did not return a user access token")

        long_lived = await provider.exchange_for_long_lived_user_token(user_token)
        user_token = long_lived.get("access_token") or user_token
        profile = await provider.get_user_profile(user_token)
        pages = await provider.list_pages(user_token)
        if not pages:
            logger.warning(
                "Facebook OAuth returned no usable Pages for user_id=%s",
                profile.get("id"),
            )
            return RedirectResponse(
                _admin_return_url(
                    {
                        "facebook_error": (
                            "Facebook connected, but returned no Pages. "
                            "Confirm the Facebook user has full control of the Page and that the Page was selected in Business Integrations."
                        )
                    }
                ),
                status_code=302,
            )
        await store_oauth_pages(db, oauth_state_id=state_row["id"], provider="facebook", pages=pages)
        query = {
            "facebook_oauth": "pages",
            "facebook_pages": str(len(pages)),
        }
        if profile.get("id"):
            query["facebook_user"] = str(profile["id"])
        return RedirectResponse(_admin_return_url(query), status_code=302)
    except (SocialProviderError, TokenCryptoError) as exc:
        logger.warning("Facebook OAuth callback failed: %s", exc)
        return RedirectResponse(_admin_return_url({"facebook_error": str(exc)}), status_code=302)


@router.get("/pages")
async def facebook_pages(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    return {"pages": await list_available_pages(db, provider="facebook")}


@router.post("/pages/select")
async def select_facebook_page(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    body: SelectPageRequest,
):
    try:
        connection = await select_page_connection(
            db,
            page_id=body.page_id,
            provider="facebook",
            admin_user_id=user.get("sub"),
            external_user_id=None,
        )
        return {"connection": connection}
    except (ValueError, TokenCryptoError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/sync-pages")
async def sync_facebook_pages(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    try:
        connection, token = await get_decrypted_page_token(db, provider="facebook")
        provider = FacebookProvider()
        details = await provider.get_page_connection_details(connection["external_account_id"], token)
        await db.execute(
            """UPDATE social_connections
               SET display_name = ?, last_synced_at = CURRENT_TIMESTAMP, last_error = NULL, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (details.get("name") or connection["display_name"], connection["id"]),
        )
        await db.commit()
        updated = await get_serialized_connection(db, provider="facebook")
        return {"connection": updated}
    except (ValueError, TokenCryptoError, SocialProviderError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/test-connection")
async def test_facebook_connection(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    try:
        connection, token = await get_decrypted_page_token(db, provider="facebook")
        provider = FacebookProvider()
        result = await provider.test_page_connection(token, connection["external_account_id"])
        await mark_connection_checked(db, connection_id=connection["id"], status="connected")
        return {"ok": True, **result}
    except (ValueError, TokenCryptoError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SocialProviderError as exc:
        from app.database import db_connection

        async with db_connection() as error_db:
            current = await get_serialized_connection(error_db, provider="facebook")
            if current:
                await mark_connection_checked(error_db, connection_id=current["id"], status="error", last_error=str(exc))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.post("/test-post")
async def test_facebook_post(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    body: TestPostRequest,
):
    try:
        connection, token = await get_decrypted_page_token(db, provider="facebook")
        provider = FacebookProvider()
        if body.link:
            result = await provider.publish_link_post(token, connection["external_account_id"], body.message, body.link)
        else:
            result = await provider.publish_text_post(token, connection["external_account_id"], body.message)
        post_id = result.get("id")
        return {
            "ok": True,
            "post_id": post_id,
            "permalink": f"https://www.facebook.com/{post_id}" if post_id else None,
        }
    except (ValueError, TokenCryptoError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SocialProviderError as exc:
        from app.database import db_connection

        async with db_connection() as error_db:
            current = await get_serialized_connection(error_db, provider="facebook")
            if current:
                await mark_connection_checked(error_db, connection_id=current["id"], status="error", last_error=str(exc))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.post("/disconnect")
async def disconnect_facebook(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    disconnected = await disconnect_connection(db, provider="facebook")
    return {"disconnected": disconnected}
