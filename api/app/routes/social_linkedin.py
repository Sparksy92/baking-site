from __future__ import annotations
from typing import Annotated

import json
import logging
from datetime import datetime, timezone
from urllib.parse import urlencode, urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from app.auth import require_admin
from app.database import PostgresConnection, get_db
from app.services.social.oauth_state import consume_oauth_state, create_oauth_state
from app.services.social.providers.base import SocialProviderError
from app.services.social.providers.linkedin import (
    LINKEDIN_COMMENTARY_LIMIT,
    LINKEDIN_PERMISSION_ERROR,
    LinkedInProvider,
)
from app.services.social.service import (
    disconnect_connection,
    get_connection,
    get_serialized_connection,
    list_available_accounts,
    mark_connection_checked,
    select_account_connection,
    store_oauth_accounts,
)
from app.services.social.token_crypto import TokenCryptoError, decrypt_token, encrypt_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/social/linkedin", tags=["social-linkedin"])
LINKEDIN_ACCOUNT_TYPE = "organization_page"


class SelectLinkedInOrganizationRequest(BaseModel):
    organization_urn: str = Field(min_length=1)


class LinkedInTestPostRequest(BaseModel):
    commentary: str = "Test post from the ecommerce social platform. This confirms LinkedIn Organization publishing is connected."
    link_url: str | None = None


def _admin_return_url(query: dict[str, str]) -> str:
    base = "/admin/social/platforms"
    return f"{base}?{urlencode(query)}" if query else base


def _is_pending_review_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return "approved" in message or "permission" in message or "scope" in message


async def _get_linkedin_connection_and_token(db: PostgresConnection) -> tuple[dict, str]:
    connection = await get_connection(db, provider="linkedin", account_type=LINKEDIN_ACCOUNT_TYPE)
    if not connection or connection["status"] == "disconnected":
        raise ValueError("LinkedIn Organization Page is not connected")
    if connection["status"] == "pending_review":
        raise ValueError(LINKEDIN_PERMISSION_ERROR)
    token = decrypt_token(connection.get("encrypted_access_token"))
    if not token:
        raise ValueError("LinkedIn token is unavailable")
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
        raise ValueError("LinkedIn token expired. Reconnect LinkedIn.")
    provider = LinkedInProvider()
    token_data = await provider.refresh_access_token(refresh_token)
    new_token = token_data.get("access_token")
    if not new_token:
        raise ValueError("LinkedIn token refresh failed. Reconnect LinkedIn.")
    expires_in = token_data.get("expires_in")
    token_expires_at = None
    if expires_in:
        from datetime import timedelta

        token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))
    await db.execute(
        """UPDATE social_connections
           SET encrypted_access_token = ?, token_expires_at = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?""",
        (encrypt_token(new_token), token_expires_at, connection["id"]),
    )
    await db.commit()
    return str(new_token)


@router.get("/status")
async def linkedin_status(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    provider = LinkedInProvider()
    connection = await get_serialized_connection(
        db,
        provider="linkedin",
        account_type=LINKEDIN_ACCOUNT_TYPE,
    )
    return {"configured": provider.configured, "connection": connection}


@router.get("/connect")
async def connect_linkedin(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    provider = LinkedInProvider()
    try:
        state = await create_oauth_state(db, provider="linkedin", admin_user_id=user.get("sub"))
        return RedirectResponse(provider.build_authorization_url(state=state), status_code=302)
    except SocialProviderError as exc:
        return RedirectResponse(_admin_return_url({"linkedin_error": str(exc)}), status_code=302)


@router.get("/callback")
async def linkedin_callback(
    db: Annotated[PostgresConnection, Depends(get_db)],
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
):
    if error:
        return RedirectResponse(_admin_return_url({"linkedin_error": error_description or error}), status_code=302)
    if not code or not state:
        return RedirectResponse(_admin_return_url({"linkedin_error": "Missing OAuth callback parameters"}), status_code=302)

    state_row = await consume_oauth_state(db, state=state, provider="linkedin")
    if not state_row:
        return RedirectResponse(_admin_return_url({"linkedin_error": "Invalid or expired OAuth state"}), status_code=302)

    provider = LinkedInProvider()
    try:
        token_data = await provider.exchange_code_for_access_token(code)
        access_token = token_data.get("access_token")
        if not access_token:
            raise SocialProviderError("LinkedIn did not return an access token")
        profile = await provider.get_current_user_profile(access_token)
        organizations = await provider.list_admin_organizations(
            access_token,
            token_data=token_data,
            profile=profile,
        )
        await store_oauth_accounts(
            db,
            oauth_state_id=state_row["id"],
            provider="linkedin",
            accounts=organizations,
        )
        query = {"linkedin_oauth": "organizations", "linkedin_organizations": str(len(organizations))}
        if profile.get("sub"):
            query["linkedin_user"] = str(profile["sub"])
        if not organizations:
            query["linkedin_error"] = (
                "No LinkedIn Organization Pages found for this account. Make sure the connecting user is an admin "
                "of the LinkedIn Page and that the LinkedIn app has approved organization permissions."
            )
        return RedirectResponse(_admin_return_url(query), status_code=302)
    except (SocialProviderError, TokenCryptoError) as exc:
        logger.warning("LinkedIn OAuth callback failed: %s", exc)
        query = {"linkedin_error": str(exc)}
        if _is_pending_review_error(exc):
            query["linkedin_status"] = "pending_review"
        return RedirectResponse(_admin_return_url(query), status_code=302)


@router.get("/organizations")
async def linkedin_organizations(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    accounts = await list_available_accounts(
        db,
        provider="linkedin",
        account_type=LINKEDIN_ACCOUNT_TYPE,
    )
    return {
        "organizations": [
            {
                "organization_urn": account["external_account_id"],
                "organization_id": account["metadata"].get("organization_id"),
                "name": account["metadata"].get("localized_name") or account["name"],
                "vanity_name": account["metadata"].get("vanity_name"),
                "website_url": account["metadata"].get("website_url"),
                "connection_status": account.get("connection_status"),
                "connected": account.get("connected", False),
            }
            for account in accounts
        ]
    }


@router.post("/organizations/select")
async def select_linkedin_organization(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    body: SelectLinkedInOrganizationRequest,
):
    try:
        connection = await select_account_connection(
            db,
            external_account_id=body.organization_urn,
            provider="linkedin",
            account_type=LINKEDIN_ACCOUNT_TYPE,
            admin_user_id=user.get("sub"),
            external_user_id=None,
        )
        return {"connection": connection}
    except (ValueError, TokenCryptoError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/sync-organizations")
async def sync_linkedin_organizations(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    try:
        connection, token = await _get_linkedin_connection_and_token(db)
        token = await _refresh_if_expired(db, connection, token)
        provider = LinkedInProvider()
        details = await provider.get_organization_details(connection["external_account_id"], token)
        metadata = _connection_metadata(connection)
        organization_id = str(details.get("id") or metadata.get("organization_id"))
        metadata.update(
            {
                "organization_urn": details.get("$URN") or f"urn:li:organization:{organization_id}",
                "organization_id": organization_id,
                "vanity_name": details.get("vanityName") or metadata.get("vanity_name"),
                "localized_name": details.get("localizedName") or metadata.get("localized_name"),
                "website_url": details.get("localizedWebsite") or metadata.get("website_url"),
            }
        )
        await db.execute(
            """UPDATE social_connections
               SET display_name = ?, metadata = ?, last_synced_at = CURRENT_TIMESTAMP,
                   last_error = NULL, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (details.get("localizedName") or connection["display_name"], json.dumps(metadata), connection["id"]),
        )
        await db.commit()
        updated = await get_serialized_connection(db, provider="linkedin", account_type=LINKEDIN_ACCOUNT_TYPE)
        return {"connection": updated}
    except (ValueError, TokenCryptoError, SocialProviderError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/test-connection")
async def test_linkedin_connection(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    try:
        connection, token = await _get_linkedin_connection_and_token(db)
        token = await _refresh_if_expired(db, connection, token)
        provider = LinkedInProvider()
        result = await provider.test_organization_connection(token, connection["external_account_id"])
        await mark_connection_checked(db, connection_id=connection["id"], status="connected")
        return {"ok": True, **result}
    except (ValueError, TokenCryptoError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SocialProviderError as exc:
        from app.database import db_connection

        status_value = "pending_review" if _is_pending_review_error(exc) else "error"
        async with db_connection() as error_db:
            current = await get_serialized_connection(error_db, provider="linkedin", account_type=LINKEDIN_ACCOUNT_TYPE)
            if current:
                await mark_connection_checked(error_db, connection_id=current["id"], status=status_value, last_error=str(exc))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.post("/test-post")
async def test_linkedin_post(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    body: LinkedInTestPostRequest,
):
    try:
        commentary = (body.commentary or "").strip()
        if not commentary and not body.link_url:
            raise ValueError("LinkedIn test post needs commentary or a link URL")
        if len(commentary) > LINKEDIN_COMMENTARY_LIMIT:
            raise ValueError(f"LinkedIn commentary must be {LINKEDIN_COMMENTARY_LIMIT} characters or fewer")
        if body.link_url:
            parsed = urlparse(body.link_url)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                raise ValueError("LinkedIn link posts require a valid public HTTP or HTTPS URL")
        connection, token = await _get_linkedin_connection_and_token(db)
        token = await _refresh_if_expired(db, connection, token)
        provider = LinkedInProvider()
        metadata = _connection_metadata(connection)
        organization_urn = metadata.get("organization_urn") or connection["external_account_id"]
        if body.link_url:
            result = await provider.publish_link_post(token, organization_urn, commentary, body.link_url)
        else:
            result = await provider.publish_text_post(token, organization_urn, commentary)
        post_id = result.get("id")
        return {
            "ok": True,
            "post_id": post_id,
            "permalink": f"https://www.linkedin.com/feed/update/{post_id}/" if post_id else None,
        }
    except (ValueError, TokenCryptoError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SocialProviderError as exc:
        from app.database import db_connection

        status_value = "pending_review" if _is_pending_review_error(exc) else "error"
        async with db_connection() as error_db:
            current = await get_serialized_connection(error_db, provider="linkedin", account_type=LINKEDIN_ACCOUNT_TYPE)
            if current:
                await mark_connection_checked(error_db, connection_id=current["id"], status=status_value, last_error=str(exc))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.post("/disconnect")
async def disconnect_linkedin(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
):
    disconnected = await disconnect_connection(db, provider="linkedin", account_type=LINKEDIN_ACCOUNT_TYPE)
    return {"disconnected": disconnected}


def _connection_metadata(connection: dict) -> dict:
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
