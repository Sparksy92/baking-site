from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest

from app.config import Settings
from app.services.social.oauth_state import consume_oauth_state, create_oauth_state
from app.services.social.providers.base import SocialAccount, SocialProviderError
from app.services.social.providers.tiktok import (
    TIKTOK_BASE_SCOPES,
    TIKTOK_DIRECT_POST_DISABLED_ERROR,
    TIKTOK_DIRECT_POST_SCOPE,
    TikTokProvider,
)
from app.services.social.service import get_serialized_connection, select_account_connection, store_oauth_accounts
from app.services.social.token_crypto import decrypt_token


def test_tiktok_oauth_url_includes_required_scopes():
    url = TikTokProvider().build_authorization_url(state="state123")
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    scopes = set(params["scope"][0].split(","))
    assert set(TIKTOK_BASE_SCOPES).issubset(scopes)
    assert TIKTOK_DIRECT_POST_SCOPE not in scopes
    assert params["redirect_uri"][0] == "http://test/api/social/tiktok/callback"


def test_tiktok_oauth_url_includes_video_publish_when_feature_enabled():
    settings = Settings(
        tiktok_client_key="client",
        tiktok_client_secret="secret",
        tiktok_redirect_uri="https://example.com/api/social/tiktok/callback",
        tiktok_enable_direct_post=True,
    )
    url = TikTokProvider(settings).build_authorization_url(state="state123")
    scopes = set(parse_qs(urlparse(url).query)["scope"][0].split(","))
    assert TIKTOK_DIRECT_POST_SCOPE in scopes


@pytest.mark.asyncio
async def test_tiktok_callback_exchanges_code_and_stores_connection(admin_client, monkeypatch):
    from app.database import db_connection

    async def fake_exchange(self, code):
        assert code == "oauth-code"
        return {
            "open_id": "tt_open_123",
            "access_token": "tiktok-access-token",
            "refresh_token": "tiktok-refresh-token",
            "expires_in": 86400,
            "refresh_expires_in": 31536000,
            "scope": "user.info.basic,video.upload",
        }

    async def fake_profile(self, access_token):
        assert access_token == "tiktok-access-token"
        return {"data": {"user": {"open_id": "tt_open_123", "display_name": "TikTok Brand", "avatar_url": "https://example.com/a.jpg"}}}

    monkeypatch.setattr(TikTokProvider, "exchange_code_for_access_token", fake_exchange)
    monkeypatch.setattr(TikTokProvider, "get_current_user_profile", fake_profile)

    async with db_connection() as db:
        state = await create_oauth_state(db, provider="tiktok", admin_user_id="admin")

    resp = await admin_client.get(f"/api/social/tiktok/callback?code=oauth-code&state={state}")
    assert resp.status_code == 302
    assert "tiktok_oauth=connected" in resp.headers["location"]

    async with db_connection() as db:
        connection = await get_serialized_connection(db, provider="tiktok", account_type="tiktok_user")
        assert connection["display_name"] == "TikTok Brand"
        assert connection["external_account_id"] == "tt_open_123"
        assert connection["metadata"]["upload_to_inbox_enabled"] is True
        assert "tiktok-access-token" not in str(connection)


@pytest.mark.asyncio
async def test_select_tiktok_account_stores_encrypted_tokens_and_expiry(client):
    from app.database import db_connection

    async with db_connection() as db:
        state = await create_oauth_state(db, provider="tiktok", admin_user_id="admin")
        state_row = await consume_oauth_state(db, state=state, provider="tiktok")
        await store_oauth_accounts(
            db,
            oauth_state_id=state_row["id"],
            provider="tiktok",
            accounts=[
                SocialAccount(
                    id="tt_open_123",
                    name="TikTok Brand",
                    category="tiktok_user",
                    access_token="tiktok-access-token",
                    scopes=["user.info.basic", "video.upload"],
                    metadata={"open_id": "tt_open_123", "display_name": "TikTok Brand"},
                    refresh_token="tiktok-refresh-token",
                    token_expires_at="2027-01-01T00:00:00+00:00",
                    refresh_token_expires_at="2027-03-01T00:00:00+00:00",
                )
            ],
        )
        response = await select_account_connection(
            db,
            external_account_id="tt_open_123",
            provider="tiktok",
            account_type="tiktok_user",
            admin_user_id="admin",
            external_user_id="tt_open_123",
        )
        assert response["provider"] == "tiktok"
        assert response["token_expires_at"]
        assert response["refresh_token_expires_at"]
        assert "encrypted_access_token" not in response

        cursor = await db.execute("SELECT encrypted_access_token, encrypted_refresh_token FROM social_connections WHERE provider = 'tiktok'")
        row = await cursor.fetchone()
        assert decrypt_token(row["encrypted_access_token"]) == "tiktok-access-token"
        assert decrypt_token(row["encrypted_refresh_token"]) == "tiktok-refresh-token"


@pytest.mark.asyncio
async def test_tiktok_api_responses_never_return_tokens(admin_client):
    await _seed_tiktok_connection(admin_client)
    for method, url in [
        ("get", "/api/social/tiktok/status"),
        ("get", "/api/social/tiktok/account"),
    ]:
        resp = await getattr(admin_client, method)(url)
        assert resp.status_code == 200
        payload = str(resp.json())
        assert "tiktok-access-token" not in payload
        assert "tiktok-refresh-token" not in payload
        assert "encrypted_access_token" not in payload
        assert "encrypted_refresh_token" not in payload


@pytest.mark.asyncio
async def test_tiktok_test_connection_success(admin_client, monkeypatch):
    await _seed_tiktok_connection(admin_client)

    async def fake_test(self, token):
        assert token == "tiktok-access-token"
        return {"open_id": "tt_open_123", "display_name": "TikTok Brand"}

    monkeypatch.setattr(TikTokProvider, "test_tiktok_connection", fake_test)
    resp = await admin_client.post("/api/social/tiktok/test-connection")
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "TikTok Brand"


@pytest.mark.asyncio
async def test_tiktok_test_connection_handles_expired_token(admin_client):
    await _seed_tiktok_connection(admin_client, token_expires_at="2020-01-01T00:00:00+00:00", refresh_token=None)
    resp = await admin_client.post("/api/social/tiktok/test-connection")
    assert resp.status_code == 400
    assert "token expired" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_tiktok_test_upload_requires_video_url(admin_client):
    await _seed_tiktok_connection(admin_client)
    resp = await admin_client.post("/api/social/tiktok/test-upload", json={})
    assert resp.status_code == 400
    assert "public HTTPS video URL" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_tiktok_test_upload_rejects_non_https_video_url(admin_client):
    await _seed_tiktok_connection(admin_client)
    resp = await admin_client.post("/api/social/tiktok/test-upload", json={"video_url": "http://example.com/video.mp4"})
    assert resp.status_code == 400
    assert "public HTTPS" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_tiktok_test_upload_success(admin_client, monkeypatch):
    await _seed_tiktok_connection(admin_client)

    async def fake_upload(self, token, video_url):
        assert token == "tiktok-access-token"
        assert video_url == "https://example.com/video.mp4"
        return {"data": {"publish_id": "publish_123", "status": "PROCESSING_DOWNLOAD"}, "error": {"code": "ok"}}

    monkeypatch.setattr(TikTokProvider, "init_video_upload_to_inbox", fake_upload)
    resp = await admin_client.post("/api/social/tiktok/test-upload", json={"video_url": "https://example.com/video.mp4"})
    assert resp.status_code == 200
    assert resp.json()["publish_id"] == "publish_123"


@pytest.mark.asyncio
async def test_tiktok_direct_post_rejects_when_feature_disabled(admin_client):
    await _seed_tiktok_connection(admin_client, scopes=["user.info.basic", "video.upload", "video.publish"])
    resp = await admin_client.post(
        "/api/social/tiktok/direct-post",
        json={"video_url": "https://example.com/video.mp4", "privacy_level": "SELF_ONLY"},
    )
    assert resp.status_code == 400
    assert "Direct Post is not enabled" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_tiktok_direct_post_rejects_when_scope_missing(admin_client, monkeypatch):
    await _seed_tiktok_connection(admin_client, scopes=["user.info.basic", "video.upload"])
    monkeypatch.setattr(TikTokProvider, "direct_post_enabled", property(lambda self: True))
    resp = await admin_client.post(
        "/api/social/tiktok/direct-post",
        json={"video_url": "https://example.com/video.mp4", "privacy_level": "SELF_ONLY"},
    )
    assert resp.status_code == 400
    assert "Direct Post is not enabled" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_tiktok_api_errors_are_stored_safely(admin_client, monkeypatch):
    await _seed_tiktok_connection(admin_client)

    async def fake_upload(self, token, video_url):
        raise SocialProviderError("scope_not_authorized")

    monkeypatch.setattr(TikTokProvider, "init_video_upload_to_inbox", fake_upload)
    resp = await admin_client.post("/api/social/tiktok/test-upload", json={"video_url": "https://example.com/video.mp4"})
    assert resp.status_code == 502

    from app.database import db_connection

    async with db_connection() as db:
        connection = await get_serialized_connection(db, provider="tiktok", account_type="tiktok_user")
        assert connection["status"] == "pending_review"
        assert connection["last_error"] == "scope_not_authorized"
        assert "tiktok-access-token" not in str(connection)


@pytest.mark.asyncio
async def test_tiktok_publish_status_does_not_expose_token(admin_client, monkeypatch):
    await _seed_tiktok_connection(admin_client)

    async def fake_status(self, token, publish_id):
        assert token == "tiktok-access-token"
        assert publish_id == "publish_123"
        return {"data": {"status": "SEND_TO_USER_INBOX"}, "error": {"code": "ok"}}

    monkeypatch.setattr(TikTokProvider, "check_publish_status", fake_status)
    resp = await admin_client.get("/api/social/tiktok/publish-status?publish_id=publish_123")
    assert resp.status_code == 200
    payload = str(resp.json())
    assert "SEND_TO_USER_INBOX" in payload
    assert "tiktok-access-token" not in payload


async def _seed_tiktok_connection(
    admin_client,
    *,
    token_expires_at="2027-01-01T00:00:00+00:00",
    refresh_token="tiktok-refresh-token",
    scopes=None,
):
    from app.database import db_connection

    scopes = scopes or ["user.info.basic", "video.upload"]
    async with db_connection() as db:
        state = await create_oauth_state(db, provider="tiktok", admin_user_id="admin")
        state_row = await consume_oauth_state(db, state=state, provider="tiktok")
        await store_oauth_accounts(
            db,
            oauth_state_id=state_row["id"],
            provider="tiktok",
            accounts=[
                SocialAccount(
                    id="tt_open_123",
                    name="TikTok Brand",
                    category="tiktok_user",
                    access_token="tiktok-access-token",
                    scopes=scopes,
                    metadata={
                        "open_id": "tt_open_123",
                        "display_name": "TikTok Brand",
                        "upload_to_inbox_enabled": "video.upload" in scopes,
                        "direct_post_enabled": "video.publish" in scopes,
                    },
                    refresh_token=refresh_token,
                    token_expires_at=token_expires_at,
                    refresh_token_expires_at="2027-03-01T00:00:00+00:00" if refresh_token else None,
                )
            ],
        )
        await select_account_connection(
            db,
            external_account_id="tt_open_123",
            provider="tiktok",
            account_type="tiktok_user",
            admin_user_id="admin",
            external_user_id="tt_open_123",
        )
