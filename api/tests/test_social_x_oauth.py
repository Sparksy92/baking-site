from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest

from app.config import Settings
from app.services.social.oauth_state import consume_oauth_state, create_oauth_state
from app.services.social.providers.base import SocialAccount, SocialProviderError
from app.services.social.providers.x import (
    X_MEDIA_DISABLED_ERROR,
    X_MISSING_WRITE_SCOPE_ERROR,
    X_REQUIRED_SCOPES,
    X_WRITE_ACCESS_ERROR,
    XProvider,
)
from app.services.social.service import get_serialized_connection, select_account_connection, store_oauth_accounts
from app.services.social.token_crypto import decrypt_token


def test_x_oauth_url_includes_required_scopes_and_pkce():
    provider = XProvider()
    verifier = "test-verifier"
    challenge = provider.generate_pkce_code_challenge(verifier)
    url = provider.build_authorization_url(state="state123", code_challenge=challenge)
    params = parse_qs(urlparse(url).query)
    scopes = set(params["scope"][0].split(" "))
    assert set(X_REQUIRED_SCOPES).issubset(scopes)
    assert params["code_challenge"][0] == challenge
    assert params["code_challenge_method"][0] == "S256"
    assert params["redirect_uri"][0] == "http://test/api/social/x/callback"


def test_x_pkce_challenge_is_stable():
    provider = XProvider(Settings(x_client_id="client", x_redirect_uri="https://example.com/callback"))
    assert provider.generate_pkce_code_challenge("abc123") == provider.generate_pkce_code_challenge("abc123")
    assert provider.generate_pkce_code_challenge("abc123") != "abc123"


@pytest.mark.asyncio
async def test_x_oauth_state_stores_and_validates_pkce(client):
    from app.database import db_connection

    async with db_connection() as db:
        state = await create_oauth_state(db, provider="x", admin_user_id="admin", metadata={"code_verifier": "verifier123"})
        row = await consume_oauth_state(db, state=state, provider="x")
    assert row is not None
    assert "verifier123" in row["metadata"]


@pytest.mark.asyncio
async def test_x_callback_exchanges_code_and_stores_connection(admin_client, monkeypatch):
    from app.database import db_connection

    async def fake_exchange(self, code, code_verifier):
        assert code == "oauth-code"
        assert code_verifier == "pkce-verifier"
        return {
            "access_token": "x-access-token",
            "refresh_token": "x-refresh-token",
            "expires_in": 7200,
            "scope": "tweet.read tweet.write users.read offline.access",
        }

    async def fake_profile(self, access_token):
        assert access_token == "x-access-token"
        return {"data": {"id": "12345", "username": "BadAssElder", "name": "BadAss Elder", "profile_image_url": "https://example.com/x.jpg"}}

    monkeypatch.setattr(XProvider, "exchange_code_for_access_token", fake_exchange)
    monkeypatch.setattr(XProvider, "get_current_user_profile", fake_profile)

    async with db_connection() as db:
        state = await create_oauth_state(db, provider="x", admin_user_id="admin", metadata={"code_verifier": "pkce-verifier"})

    resp = await admin_client.get(f"/api/social/x/callback?code=oauth-code&state={state}")
    assert resp.status_code == 302
    assert "x_oauth=connected" in resp.headers["location"]

    async with db_connection() as db:
        connection = await get_serialized_connection(db, provider="x", account_type="user_account")
        assert connection["display_name"] == "BadAss Elder"
        assert connection["external_account_id"] == "12345"
        assert connection["metadata"]["username"] == "BadAssElder"
        assert "x-access-token" not in str(connection)


@pytest.mark.asyncio
async def test_select_x_account_stores_encrypted_tokens_and_expiry(client):
    from app.database import db_connection

    async with db_connection() as db:
        state = await create_oauth_state(db, provider="x", admin_user_id="admin")
        state_row = await consume_oauth_state(db, state=state, provider="x")
        await store_oauth_accounts(
            db,
            oauth_state_id=state_row["id"],
            provider="x",
            accounts=[
                SocialAccount(
                    id="12345",
                    name="BadAss Elder",
                    category="user_account",
                    access_token="x-access-token",
                    scopes=X_REQUIRED_SCOPES,
                    metadata={"username": "BadAssElder", "media_posts_enabled": False},
                    refresh_token="x-refresh-token",
                    token_expires_at="2027-01-01T00:00:00+00:00",
                )
            ],
        )
        response = await select_account_connection(
            db,
            external_account_id="12345",
            provider="x",
            account_type="user_account",
            admin_user_id="admin",
            external_user_id="12345",
        )
        assert response["provider"] == "x"
        assert response["token_expires_at"]
        assert "encrypted_access_token" not in response

        cursor = await db.execute("SELECT encrypted_access_token, encrypted_refresh_token FROM social_connections WHERE provider = 'x'")
        row = await cursor.fetchone()
        assert decrypt_token(row["encrypted_access_token"]) == "x-access-token"
        assert decrypt_token(row["encrypted_refresh_token"]) == "x-refresh-token"


@pytest.mark.asyncio
async def test_x_api_responses_never_return_tokens(admin_client):
    await _seed_x_connection()
    for url in ["/api/social/x/status", "/api/social/x/account"]:
        resp = await admin_client.get(url)
        assert resp.status_code == 200
        payload = str(resp.json())
        assert "x-access-token" not in payload
        assert "x-refresh-token" not in payload
        assert "encrypted_access_token" not in payload
        assert "encrypted_refresh_token" not in payload


@pytest.mark.asyncio
async def test_x_test_connection_success(admin_client, monkeypatch):
    await _seed_x_connection()

    async def fake_test(self, token):
        assert token == "x-access-token"
        return {"user_id": "12345", "username": "BadAssElder", "display_name": "BadAss Elder"}

    monkeypatch.setattr(XProvider, "test_x_connection", fake_test)
    resp = await admin_client.post("/api/social/x/test-connection")
    assert resp.status_code == 200
    assert resp.json()["username"] == "BadAssElder"


@pytest.mark.asyncio
async def test_x_test_connection_handles_expired_token(admin_client):
    await _seed_x_connection(token_expires_at="2020-01-01T00:00:00+00:00", refresh_token=None)
    resp = await admin_client.post("/api/social/x/test-connection")
    assert resp.status_code == 400
    assert "token expired" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_x_test_post_success(admin_client, monkeypatch):
    await _seed_x_connection()

    async def fake_post(self, token, text):
        assert token == "x-access-token"
        assert text == "Testing X"
        return {"data": {"id": "98765", "text": text}}

    monkeypatch.setattr(XProvider, "publish_text_post", fake_post)
    resp = await admin_client.post("/api/social/x/test-post", json={"text": "Testing X"})
    assert resp.status_code == 200
    assert resp.json()["post_id"] == "98765"
    assert resp.json()["url"] == "https://x.com/BadAssElder/status/98765"


@pytest.mark.asyncio
async def test_x_test_post_rejects_too_long_text(admin_client):
    await _seed_x_connection()
    resp = await admin_client.post("/api/social/x/test-post", json={"text": "x" * 281})
    assert resp.status_code == 400
    assert "280 characters" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_x_test_post_handles_missing_tweet_write_scope(admin_client):
    await _seed_x_connection(scopes=["tweet.read", "users.read", "offline.access"])
    resp = await admin_client.post("/api/social/x/test-post", json={"text": "Testing X"})
    assert resp.status_code == 400
    assert resp.json()["detail"] == X_MISSING_WRITE_SCOPE_ERROR


@pytest.mark.asyncio
async def test_x_test_post_handles_write_access_failure(admin_client, monkeypatch):
    await _seed_x_connection()

    async def fake_post(self, token, text):
        raise SocialProviderError(X_WRITE_ACCESS_ERROR)

    monkeypatch.setattr(XProvider, "publish_text_post", fake_post)
    resp = await admin_client.post("/api/social/x/test-post", json={"text": "Testing X"})
    assert resp.status_code == 502
    assert resp.json()["detail"] == X_WRITE_ACCESS_ERROR

    from app.database import db_connection

    async with db_connection() as db:
        connection = await get_serialized_connection(db, provider="x", account_type="user_account")
        assert connection["status"] == "pending_api_access"
        assert connection["last_error"] == X_WRITE_ACCESS_ERROR


@pytest.mark.asyncio
async def test_x_link_post_validates_url(admin_client):
    await _seed_x_connection()
    resp = await admin_client.post("/api/social/x/post-link", json={"text": "Read this", "link_url": "notaurl"})
    assert resp.status_code == 400
    assert "valid http or https" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_x_link_post_success(admin_client, monkeypatch):
    await _seed_x_connection()

    async def fake_link(self, token, text, link_url):
        assert token == "x-access-token"
        assert text == "Read this"
        assert link_url == "https://example.com"
        return {"data": {"id": "98765", "text": "Read this\nhttps://example.com"}}

    monkeypatch.setattr(XProvider, "publish_link_post", fake_link)
    resp = await admin_client.post("/api/social/x/post-link", json={"text": "Read this", "link_url": "https://example.com"})
    assert resp.status_code == 200
    assert resp.json()["post_id"] == "98765"


@pytest.mark.asyncio
async def test_x_media_post_rejects_when_disabled(admin_client):
    await _seed_x_connection()
    resp = await admin_client.post("/api/social/x/media-post", json={"text": "Photo", "media_url": "https://example.com/a.jpg"})
    assert resp.status_code == 400
    assert resp.json()["detail"] == X_MEDIA_DISABLED_ERROR


async def _seed_x_connection(
    *,
    token_expires_at="2027-01-01T00:00:00+00:00",
    refresh_token="x-refresh-token",
    scopes=None,
):
    from app.database import db_connection

    scopes = scopes or X_REQUIRED_SCOPES
    async with db_connection() as db:
        state = await create_oauth_state(db, provider="x", admin_user_id="admin")
        state_row = await consume_oauth_state(db, state=state, provider="x")
        await store_oauth_accounts(
            db,
            oauth_state_id=state_row["id"],
            provider="x",
            accounts=[
                SocialAccount(
                    id="12345",
                    name="BadAss Elder",
                    category="user_account",
                    access_token="x-access-token",
                    scopes=scopes,
                    metadata={"username": "BadAssElder", "media_posts_enabled": False},
                    refresh_token=refresh_token,
                    token_expires_at=token_expires_at,
                )
            ],
        )
        await select_account_connection(
            db,
            external_account_id="12345",
            provider="x",
            account_type="user_account",
            admin_user_id="admin",
            external_user_id="12345",
        )
