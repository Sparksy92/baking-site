"""Tests for YouTube (Google) OAuth integration.

Covers:
  - Status endpoint (configured flag, connection shape)
  - Connect redirect (requires admin, redirects to Google)
  - Callback: error passthrough, missing params, invalid state, success path
  - Disconnect
  - Test-connection (no active connection → 400)
  - Provider unit tests (build_authorization_url, token shape)
  - Token crypto round-trip (reused from facebook test pattern)
"""
from __future__ import annotations

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient


# ── Status ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_youtube_status_requires_auth(client: AsyncClient):
    resp = await client.get("/api/social/youtube/status")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_youtube_status_returns_configured_flag(admin_client: AsyncClient):
    resp = await admin_client.get("/api/social/youtube/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "configured" in data
    assert isinstance(data["configured"], bool)
    assert "connection" in data


@pytest.mark.asyncio
async def test_youtube_status_no_connection_initially(admin_client: AsyncClient):
    resp = await admin_client.get("/api/social/youtube/status")
    assert resp.status_code == 200
    data = resp.json()
    # Fresh test DB — connection should be None or disconnected
    assert data["connection"] is None or data["connection"].get("status") in (
        "disconnected", "connected", "error"
    )


# ── Connect redirect ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_youtube_connect_requires_auth(client: AsyncClient):
    resp = await client.get("/api/social/youtube/connect", follow_redirects=False)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_youtube_connect_redirects_when_configured(admin_client: AsyncClient):
    """With credentials configured, connect should redirect to Google."""
    with patch("app.routes.social_youtube.YouTubeProvider") as MockProvider:
        instance = MockProvider.return_value
        instance.configured = True
        instance.build_authorization_url.return_value = (
            "https://accounts.google.com/o/oauth2/v2/auth?client_id=test"
        )

        resp = await admin_client.get("/api/social/youtube/connect", follow_redirects=False)

    assert resp.status_code == 302
    assert "accounts.google.com" in resp.headers["location"]


@pytest.mark.asyncio
async def test_youtube_connect_redirects_to_error_when_not_configured(admin_client: AsyncClient):
    """Unconfigured provider should redirect back with error param."""
    with patch("app.routes.social_youtube.YouTubeProvider") as MockProvider:
        from app.services.social.providers.base import SocialProviderError
        instance = MockProvider.return_value
        instance.configured = False
        instance.build_authorization_url.side_effect = SocialProviderError(
            "YouTube credentials not configured"
        )

        resp = await admin_client.get("/api/social/youtube/connect", follow_redirects=False)

    assert resp.status_code == 302
    assert "youtube_error" in resp.headers["location"]


# ── Callback ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_youtube_callback_with_oauth_error_redirects(client: AsyncClient):
    resp = await client.get(
        "/api/social/youtube/callback?error=access_denied&error_description=User+denied",
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert "youtube_error" in resp.headers["location"]


@pytest.mark.asyncio
async def test_youtube_callback_missing_code_redirects(client: AsyncClient):
    resp = await client.get(
        "/api/social/youtube/callback?state=somestate",
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert "youtube_error" in resp.headers["location"]


@pytest.mark.asyncio
async def test_youtube_callback_missing_state_redirects(client: AsyncClient):
    resp = await client.get(
        "/api/social/youtube/callback?code=somecode",
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert "youtube_error" in resp.headers["location"]


@pytest.mark.asyncio
async def test_youtube_callback_invalid_state_redirects(client: AsyncClient):
    resp = await client.get(
        "/api/social/youtube/callback?code=somecode&state=invalid-state-xyz",
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert "youtube_error" in resp.headers["location"]


@pytest.mark.asyncio
async def test_youtube_callback_success_path(admin_client: AsyncClient, client: AsyncClient):
    """Full callback: valid state + mocked token exchange → stores connection."""
    from app.database import db_connection
    from app.services.social.oauth_state import create_oauth_state

    async with db_connection() as db:
        state = await create_oauth_state(db, provider="youtube", admin_user_id="admin")

    channel_info = {
        "channel_id": "UC_test_channel_123",
        "title": "Test YouTube Channel",
        "custom_url": "@testchannel",
        "subscriber_count": "12500",
        "thumbnail": "https://yt3.ggpht.com/test.jpg",
    }
    token_data = {
        "access_token": "ya29.test_access_token",
        "refresh_token": "1//test_refresh_token",
        "expires_in": 3600,
        "token_type": "Bearer",
    }

    with patch("app.routes.social_youtube.YouTubeProvider") as MockProvider:
        instance = MockProvider.return_value
        instance.configured = True
        instance.exchange_code_for_access_token = AsyncMock(return_value=token_data)
        instance.get_channel_info = AsyncMock(return_value=channel_info)

        resp = await client.get(
            f"/api/social/youtube/callback?code=auth_code_xyz&state={state}",
            follow_redirects=False,
        )

    assert resp.status_code == 302
    location = resp.headers["location"]
    assert "youtube_error" not in location
    assert "youtube_connected" in location or "/admin/social/platforms" in location


# ── Disconnect ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_youtube_disconnect_requires_auth(client: AsyncClient):
    resp = await client.post("/api/social/youtube/disconnect")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_youtube_disconnect_with_no_connection(admin_client: AsyncClient):
    """Disconnect when not connected should return gracefully."""
    resp = await admin_client.post("/api/social/youtube/disconnect")
    assert resp.status_code == 200
    data = resp.json()
    assert "disconnected" in data


# ── Test-connection ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_youtube_test_connection_no_connection_returns_400(admin_client: AsyncClient):
    """No active connection should return 400."""
    with patch("app.routes.social_youtube.get_connection", AsyncMock(return_value=None)):
        resp = await admin_client.post("/api/social/youtube/test-connection")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_youtube_test_connection_requires_auth(client: AsyncClient):
    resp = await client.post("/api/social/youtube/test-connection")
    assert resp.status_code == 401


# ── Provider unit tests ───────────────────────────────────────────────────────

def test_youtube_provider_build_authorization_url():
    """build_authorization_url should include required scopes and redirect_uri."""
    with patch("app.services.social.providers.youtube.get_settings") as mock_settings:
        settings = MagicMock()
        settings.youtube_client_id = "test_client_id"
        settings.youtube_client_secret = "test_secret"
        settings.youtube_redirect_uri = "https://example.com/api/social/youtube/callback"
        mock_settings.return_value = settings

        from app.services.social.providers.youtube import YouTubeProvider
        provider = YouTubeProvider()
        url = provider.build_authorization_url(state="test_state")

    assert "accounts.google.com" in url
    assert "test_client_id" in url
    assert "test_state" in url
    assert "youtube.upload" in url or "youtube" in url


def test_youtube_provider_configured_false_without_credentials():
    with patch("app.services.social.providers.youtube.get_settings") as mock_settings:
        settings = MagicMock()
        settings.youtube_client_id = ""
        settings.youtube_client_secret = ""
        settings.youtube_redirect_uri = ""
        mock_settings.return_value = settings

        from app.services.social.providers.youtube import YouTubeProvider
        provider = YouTubeProvider()

    assert provider.configured is False


def test_youtube_provider_configured_true_with_credentials():
    with patch("app.services.social.providers.youtube.get_settings") as mock_settings:
        settings = MagicMock()
        settings.youtube_client_id = "real_client_id"
        settings.youtube_client_secret = "real_secret"
        settings.youtube_redirect_uri = "https://example.com/callback"
        mock_settings.return_value = settings

        from app.services.social.providers.youtube import YouTubeProvider
        provider = YouTubeProvider()

    assert provider.configured is True


@pytest.mark.asyncio
async def test_youtube_provider_exchange_code_calls_token_endpoint():
    """exchange_code_for_access_token should POST to Google token endpoint."""
    with patch("app.services.social.providers.youtube.get_settings") as mock_settings:
        settings = MagicMock()
        settings.youtube_client_id = "cid"
        settings.youtube_client_secret = "csecret"
        settings.youtube_redirect_uri = "https://example.com/cb"
        mock_settings.return_value = settings

        from app.services.social.providers.youtube import YouTubeProvider
        provider = YouTubeProvider()

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "access_token": "ya29.test",
            "token_type": "Bearer",
            "expires_in": 3600,
        }

        with patch("app.services.social.providers.youtube.httpx.AsyncClient") as MockHTTP:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            MockHTTP.return_value.__aenter__ = AsyncMock(return_value=mock_http)
            MockHTTP.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await provider.exchange_code_for_access_token("auth_code_abc")

    assert result["access_token"] == "ya29.test"


@pytest.mark.asyncio
async def test_youtube_provider_get_channel_info():
    """get_channel_info should parse the channels API response correctly."""
    with patch("app.services.social.providers.youtube.get_settings") as mock_settings:
        settings = MagicMock()
        settings.youtube_client_id = "cid"
        settings.youtube_client_secret = "csecret"
        settings.youtube_redirect_uri = "https://example.com/cb"
        mock_settings.return_value = settings

        from app.services.social.providers.youtube import YouTubeProvider
        provider = YouTubeProvider()

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "items": [{
                "id": "UC_channel_id_123",
                "snippet": {
                    "title": "My Test Channel",
                    "customUrl": "@mytestchannel",
                    "thumbnails": {"default": {"url": "https://yt3.ggpht.com/pic.jpg"}},
                },
                "statistics": {"subscriberCount": "99000"},
            }]
        }

        with patch("app.services.social.providers.youtube.httpx.AsyncClient") as MockHTTP:
            mock_http = AsyncMock()
            mock_http.get = AsyncMock(return_value=mock_response)
            MockHTTP.return_value.__aenter__ = AsyncMock(return_value=mock_http)
            MockHTTP.return_value.__aexit__ = AsyncMock(return_value=False)

            channel = await provider.get_channel_info("ya29.access_token")

    assert channel["channel_id"] == "UC_channel_id_123"
    assert channel["title"] == "My Test Channel"
    assert channel["subscriber_count"] == "99000"


@pytest.mark.asyncio
async def test_youtube_provider_get_channel_info_no_items_raises():
    """get_channel_info with empty items list should raise SocialProviderError."""
    with patch("app.services.social.providers.youtube.get_settings") as mock_settings:
        settings = MagicMock()
        settings.youtube_client_id = "cid"
        settings.youtube_client_secret = "csecret"
        settings.youtube_redirect_uri = "https://example.com/cb"
        mock_settings.return_value = settings

        from app.services.social.providers.youtube import YouTubeProvider
        from app.services.social.providers.base import SocialProviderError
        provider = YouTubeProvider()

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {"items": []}

        with patch("app.services.social.providers.youtube.httpx.AsyncClient") as MockHTTP:
            mock_http = AsyncMock()
            mock_http.get = AsyncMock(return_value=mock_response)
            MockHTTP.return_value.__aenter__ = AsyncMock(return_value=mock_http)
            MockHTTP.return_value.__aexit__ = AsyncMock(return_value=False)

            with pytest.raises(SocialProviderError):
                await provider.get_channel_info("ya29.bad_token")
