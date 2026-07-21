"""Tests for Threads (Meta) OAuth integration.

Covers:
  - GET /social/threads/status — auth required, configured flag, no-connection state
  - GET /social/threads/connect — auth required, redirects when configured, error when not
  - GET /social/threads/callback — OAuth error param, missing code, missing state,
                                   invalid state, successful connection
  - POST /social/threads/disconnect — auth required, no-connection case
  - POST /social/threads/test-connection — no connection 400, auth required
  - ThreadsProvider unit — configured flag, authorization URL shape,
                           token exchange, user info fetch
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


# ── /status ───────────────────────────────────────────────────────────────────

async def test_threads_status_requires_auth(client: AsyncClient):
    resp = await client.get("/api/social/threads/status")
    assert resp.status_code == 401


async def test_threads_status_returns_configured_flag(admin_client: AsyncClient):
    with patch("app.routes.social_threads.ThreadsProvider") as MockProvider:
        MockProvider.return_value.configured = False
        with patch("app.routes.social_threads.get_serialized_connection", AsyncMock(return_value=None)):
            resp = await admin_client.get("/api/social/threads/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "configured" in data
    assert "connection" in data


async def test_threads_status_no_connection_initially(admin_client: AsyncClient):
    with patch("app.routes.social_threads.ThreadsProvider") as MockProvider:
        MockProvider.return_value.configured = True
        with patch("app.routes.social_threads.get_serialized_connection", AsyncMock(return_value=None)):
            resp = await admin_client.get("/api/social/threads/status")
    assert resp.status_code == 200
    assert resp.json()["connection"] is None


# ── /connect ──────────────────────────────────────────────────────────────────

async def test_threads_connect_requires_auth(client: AsyncClient):
    resp = await client.get("/api/social/threads/connect", follow_redirects=False)
    assert resp.status_code == 401


async def test_threads_connect_redirects_when_configured(admin_client: AsyncClient):
    with patch("app.routes.social_threads.ThreadsProvider") as MockProvider:
        instance = MockProvider.return_value
        instance.configured = True
        instance.assert_configured = MagicMock()
        instance.build_authorization_url = MagicMock(return_value="https://www.threads.net/oauth/authorize?state=abc")
        with patch("app.routes.social_threads.create_oauth_state", AsyncMock(return_value="mock_state")):
            resp = await admin_client.get("/api/social/threads/connect", follow_redirects=False)
    assert resp.status_code == 302
    assert "threads.net" in resp.headers["location"] or "instagram.com" in resp.headers["location"] or "facebook.com" in resp.headers["location"]


async def test_threads_connect_redirects_to_error_when_not_configured(admin_client: AsyncClient):
    from app.services.social.providers.base import SocialProviderError
    with patch("app.routes.social_threads.ThreadsProvider") as MockProvider:
        instance = MockProvider.return_value
        instance.assert_configured = MagicMock(side_effect=SocialProviderError("META_APP_ID not set"))
        with patch("app.routes.social_threads.create_oauth_state", AsyncMock(return_value="mock_state")):
            resp = await admin_client.get("/api/social/threads/connect", follow_redirects=False)
    assert resp.status_code == 302
    assert "threads_error" in resp.headers["location"]


# ── /callback ─────────────────────────────────────────────────────────────────

async def test_threads_callback_with_oauth_error_redirects(client: AsyncClient):
    resp = await client.get(
        "/api/social/threads/callback?error=access_denied&error_description=User+denied+access",
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert "threads_error" in resp.headers["location"]


async def test_threads_callback_missing_code_redirects(client: AsyncClient):
    resp = await client.get("/api/social/threads/callback?state=abc", follow_redirects=False)
    assert resp.status_code == 302
    assert "threads_error" in resp.headers["location"]


async def test_threads_callback_missing_state_redirects(client: AsyncClient):
    resp = await client.get("/api/social/threads/callback?code=abc123", follow_redirects=False)
    assert resp.status_code == 302
    assert "threads_error" in resp.headers["location"]


async def test_threads_callback_invalid_state_redirects(client: AsyncClient):
    with patch("app.routes.social_threads.consume_oauth_state", AsyncMock(return_value=None)):
        resp = await client.get(
            "/api/social/threads/callback?code=abc123&state=invalid_state",
            follow_redirects=False,
        )
    assert resp.status_code == 302
    assert "threads_error" in resp.headers["location"]


async def test_threads_callback_success_path(client: AsyncClient):
    fake_state_row = {"id": 1, "admin_user_id": "admin@test.com"}
    fake_token_data = {
        "access_token": "THR_access_token_123",
        "user_id": "9876543210",
    }
    fake_user_info = {
        "id": "9876543210",
        "username": "testbrand",
        "name": "Test Brand",
        "threads_biography": "Official brand account",
        "threads_profile_picture_url": "https://cdn.threads.net/avatar.jpg",
    }

    with patch("app.routes.social_threads.consume_oauth_state", AsyncMock(return_value=fake_state_row)), \
         patch("app.routes.social_threads.ThreadsProvider") as MockProvider, \
         patch("app.routes.social_threads.store_oauth_accounts", AsyncMock()), \
         patch("app.routes.social_threads.select_account_connection", AsyncMock(return_value={"id": 1})):

        instance = MockProvider.return_value
        instance.exchange_code_for_token = AsyncMock(return_value=fake_token_data)
        instance.get_user_info = AsyncMock(return_value=fake_user_info)

        resp = await client.get(
            "/api/social/threads/callback?code=valid_code&state=valid_state",
            follow_redirects=False,
        )

    assert resp.status_code == 302
    assert "threads_connected=1" in resp.headers["location"]
    assert "Test+Brand" in resp.headers["location"] or "testbrand" in resp.headers["location"] or "Test" in resp.headers["location"]


# ── /disconnect ───────────────────────────────────────────────────────────────

async def test_threads_disconnect_requires_auth(client: AsyncClient):
    resp = await client.post("/api/social/threads/disconnect")
    assert resp.status_code == 401


async def test_threads_disconnect_with_no_connection(admin_client: AsyncClient):
    with patch("app.routes.social_threads.disconnect_connection", AsyncMock(return_value=False)):
        resp = await admin_client.post("/api/social/threads/disconnect")
    assert resp.status_code == 200
    assert resp.json()["disconnected"] is False


# ── /test-connection ──────────────────────────────────────────────────────────

async def test_threads_test_connection_requires_auth(client: AsyncClient):
    resp = await client.post("/api/social/threads/test-connection")
    assert resp.status_code == 401


async def test_threads_test_connection_no_connection_returns_400(admin_client: AsyncClient):
    with patch("app.routes.social_threads.get_connection", AsyncMock(return_value=None)):
        resp = await admin_client.post("/api/social/threads/test-connection")
    assert resp.status_code == 400
    assert "not connected" in resp.json()["detail"].lower()


async def test_threads_test_connection_success(admin_client: AsyncClient):
    fake_connection = {
        "id": 1,
        "status": "connected",
        "encrypted_access_token": "enc_token",
    }
    fake_user_info = {"id": "123", "username": "testbrand", "name": "Test Brand"}

    with patch("app.routes.social_threads.get_connection", AsyncMock(return_value=fake_connection)), \
         patch("app.routes.social_threads.decrypt_token", return_value="THR_live_token"), \
         patch("app.routes.social_threads.ThreadsProvider") as MockProvider, \
         patch("app.routes.social_threads.mark_connection_checked", AsyncMock()):
        instance = MockProvider.return_value
        instance.get_user_info = AsyncMock(return_value=fake_user_info)
        resp = await admin_client.post("/api/social/threads/test-connection")

    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["user"]["username"] == "testbrand"


# ── ThreadsProvider unit tests ────────────────────────────────────────────────

def test_threads_provider_configured_false_without_credentials():
    with patch("app.services.social.providers.threads.get_settings") as mock_settings:
        mock_settings.return_value.meta_app_id = None
        mock_settings.return_value.meta_app_secret = None
        mock_settings.return_value.meta_threads_redirect_uri = None
        from app.services.social.providers.threads import ThreadsProvider
        provider = ThreadsProvider()
        assert provider.configured is False


def test_threads_provider_configured_true_with_credentials():
    with patch("app.services.social.providers.threads.get_settings") as mock_settings:
        mock_settings.return_value.meta_app_id = "123456789"
        mock_settings.return_value.meta_app_secret = "secret_abc"
        mock_settings.return_value.meta_threads_redirect_uri = "https://example.com/api/social/threads/callback"
        from app.services.social.providers.threads import ThreadsProvider
        provider = ThreadsProvider()
        assert provider.configured is True


def test_threads_provider_build_authorization_url():
    with patch("app.services.social.providers.threads.get_settings") as mock_settings:
        mock_settings.return_value.meta_app_id = "123456789"
        mock_settings.return_value.meta_app_secret = "secret_abc"
        mock_settings.return_value.meta_threads_redirect_uri = "https://example.com/api/social/threads/callback"
        from app.services.social.providers.threads import ThreadsProvider
        provider = ThreadsProvider()
        url = provider.build_authorization_url(state="test_state_xyz")
    assert "state=test_state_xyz" in url
    assert "123456789" in url


@pytest.mark.asyncio
async def test_threads_provider_exchange_code_calls_token_endpoint():
    with patch("app.services.social.providers.threads.get_settings") as mock_settings:
        mock_settings.return_value.meta_app_id = "123456789"
        mock_settings.return_value.meta_app_secret = "secret_abc"
        mock_settings.return_value.meta_threads_redirect_uri = "https://example.com/callback"

        short_token_resp = MagicMock()
        short_token_resp.json.return_value = {"access_token": "THR_short", "user_id": "999"}

        long_token_resp = MagicMock()
        long_token_resp.json.return_value = {"access_token": "THR_long", "token_type": "bearer", "expires_in": 5184000}

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=short_token_resp)
        mock_client.get = AsyncMock(return_value=long_token_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        from app.services.social.providers.threads import ThreadsProvider
        provider = ThreadsProvider()

        with patch("app.services.social.providers.threads.httpx.AsyncClient", return_value=mock_client):
            result = await provider.exchange_code_for_token("auth_code_xyz")

    assert result["access_token"] == "THR_long"
    assert result["user_id"] == "999"


@pytest.mark.asyncio
async def test_threads_provider_get_user_info():
    with patch("app.services.social.providers.threads.get_settings") as mock_settings:
        mock_settings.return_value.meta_app_id = "123456789"
        mock_settings.return_value.meta_app_secret = "secret_abc"
        mock_settings.return_value.meta_threads_redirect_uri = "https://example.com/callback"

        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {
            "id": "9876543210",
            "username": "testbrand",
            "name": "Test Brand",
            "threads_biography": "Official account",
        }

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        from app.services.social.providers.threads import ThreadsProvider
        provider = ThreadsProvider()

        with patch("app.services.social.providers.threads.httpx.AsyncClient", return_value=mock_client):
            result = await provider.get_user_info("THR_live_token")

    assert result["username"] == "testbrand"
    assert result["id"] == "9876543210"
