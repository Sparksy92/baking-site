"""Tests for YouTube publish service (publish_to_youtube + helpers).

Covers:
  - publish_to_youtube: no video URL raises PublishError
  - publish_to_youtube short: no short_video_url AND no video_url raises PublishError
  - publish_to_youtube short: falls back to video_url when short_video_url is None
  - publish_to_youtube: not connected raises PublishError
  - publish_to_youtube: 401 from init gives clear error message
  - publish_to_youtube: 403 from init gives clear error message
  - publish_to_youtube: empty video bytes raises PublishError
  - publish_to_youtube: successful long-form video returns video ID
  - publish_to_youtube short: adds #Shorts to description and Shorts tag
  - publish_to_youtube: title strips hashtags
  - publish_to_youtube: title falls back to 'New Video' when content is all hashtags
  - _youtube_mime_type: detects webm, mov, mp4 correctly
  - _youtube_refresh_token_if_needed: returns token when not expired
  - _youtube_refresh_token_if_needed: refreshes when expired and updates DB
  - _youtube_refresh_token_if_needed: raises when no encrypted token
  - _youtube_refresh_token_if_needed: raises when expired + no refresh token
  - publish_post dispatcher: routes youtube platform correctly
  - publish_post dispatcher: routes youtube short with short_video_url
"""
from __future__ import annotations

import json
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch, call

from app.services.social_publish_service import (
    PublishError,
    _youtube_mime_type,
    publish_to_youtube,
    publish_post,
)


# ── _youtube_mime_type ────────────────────────────────────────────────────────

def test_mime_type_mp4_default():
    assert _youtube_mime_type("https://cdn.example.com/video.mp4") == "video/mp4"

def test_mime_type_webm():
    assert _youtube_mime_type("https://cdn.example.com/clip.webm") == "video/webm"

def test_mime_type_mov():
    assert _youtube_mime_type("https://cdn.example.com/clip.mov") == "video/quicktime"

def test_mime_type_avi():
    assert _youtube_mime_type("https://cdn.example.com/clip.avi") == "video/x-msvideo"

def test_mime_type_mkv():
    assert _youtube_mime_type("https://cdn.example.com/clip.mkv") == "video/x-matroska"

def test_mime_type_unknown_defaults_to_mp4():
    assert _youtube_mime_type("https://cdn.example.com/clip.flv") == "video/mp4"

def test_mime_type_ignores_query_string():
    assert _youtube_mime_type("https://cdn.example.com/clip.webm?token=abc") == "video/webm"


# ── _youtube_refresh_token_if_needed ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_refresh_token_returns_existing_when_not_expired():
    """Token not close to expiry → return as-is, no DB write."""
    future = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    connection = {
        "id": 1,
        "encrypted_access_token": "enc_token",
        "encrypted_refresh_token": "enc_refresh",
        "token_expires_at": future,
    }
    with patch("app.services.social.token_crypto.decrypt_token", return_value="ya29.live_token"):
        from app.services.social_publish_service import _youtube_refresh_token_if_needed
        result = await _youtube_refresh_token_if_needed(connection)
    assert result == "ya29.live_token"


@pytest.mark.asyncio
async def test_refresh_token_raises_when_no_encrypted_token():
    connection = {"id": 1, "encrypted_access_token": None, "token_expires_at": None}
    with patch("app.services.social.token_crypto.decrypt_token", return_value=None):
        from app.services.social_publish_service import _youtube_refresh_token_if_needed
        with pytest.raises(PublishError, match="unavailable"):
            await _youtube_refresh_token_if_needed(connection)


@pytest.mark.asyncio
async def test_refresh_token_raises_when_expired_no_refresh_token():
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    connection = {
        "id": 1,
        "encrypted_access_token": "enc_expired",
        "encrypted_refresh_token": None,
        "token_expires_at": past,
    }
    def mock_decrypt(val):
        if val == "enc_expired":
            return "ya29.expired"
        return None

    with patch("app.services.social.token_crypto.decrypt_token", side_effect=mock_decrypt):
        from app.services.social_publish_service import _youtube_refresh_token_if_needed
        with pytest.raises(PublishError, match="no refresh token"):
            await _youtube_refresh_token_if_needed(connection)


@pytest.mark.asyncio
async def test_refresh_token_refreshes_when_expired():
    """Expired token with valid refresh token → calls Google, updates DB, returns new token."""
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    connection = {
        "id": 42,
        "encrypted_access_token": "enc_expired",
        "encrypted_refresh_token": "enc_refresh",
        "token_expires_at": past,
    }

    def mock_decrypt(val):
        if val == "enc_expired":
            return "ya29.expired"
        if val == "enc_refresh":
            return "1//refresh_token"
        return None

    mock_provider = MagicMock()
    mock_provider.refresh_access_token = AsyncMock(return_value={
        "access_token": "ya29.new_token",
        "expires_in": 3600,
    })

    mock_db = AsyncMock()
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)
    mock_db.execute = AsyncMock()
    mock_db.commit = AsyncMock()

    with patch("app.services.social.token_crypto.decrypt_token", side_effect=mock_decrypt), \
         patch("app.services.social.token_crypto.encrypt_token", return_value="enc_new"), \
         patch("app.services.social.providers.youtube.YouTubeProvider", return_value=mock_provider), \
         patch("app.database.db_connection", return_value=mock_db):
        from app.services.social_publish_service import _youtube_refresh_token_if_needed
        result = await _youtube_refresh_token_if_needed(connection)

    assert result == "ya29.new_token"
    mock_db.execute.assert_called_once()
    mock_db.commit.assert_called_once()


# ── publish_to_youtube ────────────────────────────────────────────────────────

def _mock_connection(status: str = "connected") -> dict:
    return {
        "id": 1,
        "status": status,
        "encrypted_access_token": "enc_token",
        "encrypted_refresh_token": "enc_refresh",
        "token_expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
    }


def _make_http_mock(
    init_status: int = 200,
    init_headers: dict | None = None,
    video_status: int = 200,
    video_bytes: bytes = b"fake_video_data",
    upload_status: int = 200,
    upload_json: dict | None = None,
) -> MagicMock:
    init_resp = MagicMock()
    init_resp.status_code = init_status
    init_resp.headers = {"Location": "https://upload.youtube.com/resumable/upload/abc123", **(init_headers or {})}
    init_resp.json.return_value = {"error": {"message": "mock error", "code": init_status}} if init_status not in (200, 201) else {}
    init_resp.text = "mock error text"

    video_resp = MagicMock()
    video_resp.status_code = video_status
    video_resp.content = video_bytes

    upload_resp = MagicMock()
    upload_resp.status_code = upload_status
    upload_resp.json.return_value = upload_json or {"id": "dQw4w9WgXcQ", "kind": "youtube#video"}

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=init_resp)
    mock_client.get = AsyncMock(return_value=video_resp)
    mock_client.put = AsyncMock(return_value=upload_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    return mock_client


@pytest.mark.asyncio
async def test_publish_youtube_no_video_url_raises():
    with pytest.raises(PublishError, match="requires a video URL"):
        await publish_to_youtube(content="Hello", video_url=None, image_url=None)


@pytest.mark.asyncio
async def test_publish_youtube_short_no_video_at_all_raises():
    with pytest.raises(PublishError, match="Short requires a video URL"):
        await publish_to_youtube(
            content="Short content", video_url=None, image_url=None,
            content_type="short", short_video_url=None,
        )


@pytest.mark.asyncio
async def test_publish_youtube_short_falls_back_to_video_url():
    """short_video_url=None but video_url set → uses video_url."""
    connection = _mock_connection()
    mock_client = _make_http_mock()

    with patch("app.database.db_connection") as mock_db_ctx, \
         patch("app.services.social.service.get_connection", AsyncMock(return_value=connection)), \
         patch("app.services.social_publish_service._youtube_refresh_token_if_needed", AsyncMock(return_value="ya29.token")), \
         patch("app.config.get_settings") as mock_settings, \
         patch("httpx.AsyncClient", return_value=mock_client):
        mock_db_ctx.return_value.__aenter__ = AsyncMock(return_value=MagicMock())
        mock_db_ctx.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_settings.return_value.store_domain = "http://localhost:8000"
        result = await publish_to_youtube(
            content="Short post",
            video_url="http://localhost:8000/media/video.mp4",
            image_url=None,
            content_type="short",
            short_video_url=None,
        )
    assert result == "dQw4w9WgXcQ"


@pytest.mark.asyncio
async def test_publish_youtube_not_connected_raises():
    mock_db = AsyncMock()
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)
    with patch("app.database.db_connection", return_value=mock_db), \
         patch("app.services.social.service.get_connection", AsyncMock(return_value=None)):
        with pytest.raises(PublishError, match="not connected"):
            await publish_to_youtube(content="Hello", video_url="http://example.com/v.mp4", image_url=None)


@pytest.mark.asyncio
async def test_publish_youtube_401_gives_clear_message():
    connection = _mock_connection()
    mock_client = _make_http_mock(init_status=401)

    mock_db = AsyncMock()
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)
    with patch("app.database.db_connection", return_value=mock_db), \
         patch("app.services.social.service.get_connection", AsyncMock(return_value=connection)), \
         patch("app.services.social_publish_service._youtube_refresh_token_if_needed", AsyncMock(return_value="ya29.bad")), \
         patch("app.config.get_settings") as mock_settings, \
         patch("httpx.AsyncClient", return_value=mock_client):
        mock_settings.return_value.store_domain = "http://localhost:8000"
        with pytest.raises(PublishError, match="401"):
            await publish_to_youtube(content="Hello", video_url="http://localhost:8000/v.mp4", image_url=None)


@pytest.mark.asyncio
async def test_publish_youtube_403_gives_clear_message():
    connection = _mock_connection()
    init_resp = MagicMock()
    init_resp.status_code = 403
    init_resp.headers = {}
    init_resp.json.return_value = {"error": {"message": "forbidden", "code": 403}}
    init_resp.text = "forbidden"

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=init_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    mock_db = AsyncMock()
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)
    with patch("app.database.db_connection", return_value=mock_db), \
         patch("app.services.social.service.get_connection", AsyncMock(return_value=connection)), \
         patch("app.services.social_publish_service._youtube_refresh_token_if_needed", AsyncMock(return_value="ya29.token")), \
         patch("app.config.get_settings") as mock_settings, \
         patch("httpx.AsyncClient", return_value=mock_client):
        mock_settings.return_value.store_domain = "http://localhost:8000"
        with pytest.raises(PublishError, match="403"):
            await publish_to_youtube(content="Hello", video_url="http://localhost:8000/v.mp4", image_url=None)


@pytest.mark.asyncio
async def test_publish_youtube_empty_video_bytes_raises():
    connection = _mock_connection()
    mock_client = _make_http_mock(video_bytes=b"")

    mock_db = AsyncMock()
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)
    with patch("app.database.db_connection", return_value=mock_db), \
         patch("app.services.social.service.get_connection", AsyncMock(return_value=connection)), \
         patch("app.services.social_publish_service._youtube_refresh_token_if_needed", AsyncMock(return_value="ya29.token")), \
         patch("app.config.get_settings") as mock_settings, \
         patch("httpx.AsyncClient", return_value=mock_client):
        mock_settings.return_value.store_domain = "http://localhost:8000"
        with pytest.raises(PublishError, match="empty"):
            await publish_to_youtube(content="Hello", video_url="http://localhost:8000/v.mp4", image_url=None)


@pytest.mark.asyncio
async def test_publish_youtube_success_long_form():
    connection = _mock_connection()
    mock_client = _make_http_mock()

    mock_db = AsyncMock()
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)
    with patch("app.database.db_connection", return_value=mock_db), \
         patch("app.services.social.service.get_connection", AsyncMock(return_value=connection)), \
         patch("app.services.social_publish_service._youtube_refresh_token_if_needed", AsyncMock(return_value="ya29.token")), \
         patch("app.config.get_settings") as mock_settings, \
         patch("httpx.AsyncClient", return_value=mock_client):
        mock_settings.return_value.store_domain = "http://localhost:8000"
        result = await publish_to_youtube(
            content="Check out our new gear drop!\n\n#BadAssElder #Gear",
            video_url="http://localhost:8000/media/promo.mp4",
            image_url=None,
        )
    assert result == "dQw4w9WgXcQ"
    # Verify Authorization header was sent
    call_kwargs = mock_client.post.call_args
    assert "Authorization" in call_kwargs.kwargs["headers"]
    assert call_kwargs.kwargs["headers"]["Authorization"] == "Bearer ya29.token"


@pytest.mark.asyncio
async def test_publish_youtube_short_adds_shorts_tag_and_description():
    """Short upload must have #Shorts in description and tags: ['Shorts']."""
    connection = _mock_connection()
    captured_body = {}

    async def capture_post(*args, **kwargs):
        captured_body.update(kwargs.get("json", {}))
        resp = MagicMock()
        resp.status_code = 200
        resp.headers = {"Location": "https://upload.youtube.com/resumable/abc"}
        resp.json.return_value = {}
        return resp

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(side_effect=capture_post)
    mock_client.get = AsyncMock(return_value=MagicMock(status_code=200, content=b"video"))
    mock_client.put = AsyncMock(return_value=MagicMock(
        status_code=200,
        json=MagicMock(return_value={"id": "shortVid123"}),
    ))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    mock_db = AsyncMock()
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)
    with patch("app.database.db_connection", return_value=mock_db), \
         patch("app.services.social.service.get_connection", AsyncMock(return_value=connection)), \
         patch("app.services.social_publish_service._youtube_refresh_token_if_needed", AsyncMock(return_value="ya29.token")), \
         patch("app.config.get_settings") as mock_settings, \
         patch("httpx.AsyncClient", return_value=mock_client):
        mock_settings.return_value.store_domain = "http://localhost:8000"
        result = await publish_to_youtube(
            content="Fast clip\n#BadAss",
            video_url=None,
            image_url=None,
            content_type="short",
            short_video_url="http://localhost:8000/media/short.mp4",
        )

    assert result == "shortVid123"
    assert "#Shorts" in captured_body["snippet"]["description"]
    assert "Shorts" in captured_body["snippet"]["tags"]


@pytest.mark.asyncio
async def test_publish_youtube_title_strips_hashtags():
    """Hashtags on the first line should not appear in the YouTube video title."""
    connection = _mock_connection()
    captured_body = {}

    async def capture_post(*args, **kwargs):
        captured_body.update(kwargs.get("json", {}))
        resp = MagicMock()
        resp.status_code = 200
        resp.headers = {"Location": "https://upload.youtube.com/resumable/abc"}
        resp.json.return_value = {}
        return resp

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(side_effect=capture_post)
    mock_client.get = AsyncMock(return_value=MagicMock(status_code=200, content=b"video"))
    mock_client.put = AsyncMock(return_value=MagicMock(
        status_code=200,
        json=MagicMock(return_value={"id": "titleTest"}),
    ))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    mock_db = AsyncMock()
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)
    with patch("app.database.db_connection", return_value=mock_db), \
         patch("app.services.social.service.get_connection", AsyncMock(return_value=connection)), \
         patch("app.services.social_publish_service._youtube_refresh_token_if_needed", AsyncMock(return_value="ya29.token")), \
         patch("app.config.get_settings") as mock_settings, \
         patch("httpx.AsyncClient", return_value=mock_client):
        mock_settings.return_value.store_domain = "http://localhost:8000"
        await publish_to_youtube(
            content="Summer Sale is live! #Sale #BadAssElder\nShop now at badasselder.com",
            video_url="http://localhost:8000/media/sale.mp4",
            image_url=None,
        )

    title = captured_body["snippet"]["title"]
    assert "#" not in title
    assert "Summer Sale is live!" in title


@pytest.mark.asyncio
async def test_publish_youtube_title_fallback_when_all_hashtags():
    """If content is only hashtags, title should fall back to 'New Video'."""
    connection = _mock_connection()
    captured_body = {}

    async def capture_post(*args, **kwargs):
        captured_body.update(kwargs.get("json", {}))
        resp = MagicMock()
        resp.status_code = 200
        resp.headers = {"Location": "https://upload.youtube.com/resumable/abc"}
        resp.json.return_value = {}
        return resp

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(side_effect=capture_post)
    mock_client.get = AsyncMock(return_value=MagicMock(status_code=200, content=b"video"))
    mock_client.put = AsyncMock(return_value=MagicMock(
        status_code=200,
        json=MagicMock(return_value={"id": "fallbackTitle"}),
    ))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    mock_db = AsyncMock()
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)
    with patch("app.database.db_connection", return_value=mock_db), \
         patch("app.services.social.service.get_connection", AsyncMock(return_value=connection)), \
         patch("app.services.social_publish_service._youtube_refresh_token_if_needed", AsyncMock(return_value="ya29.token")), \
         patch("app.config.get_settings") as mock_settings, \
         patch("httpx.AsyncClient", return_value=mock_client):
        mock_settings.return_value.store_domain = "http://localhost:8000"
        await publish_to_youtube(
            content="#Sale #BadAssElder #Gear",
            video_url="http://localhost:8000/media/v.mp4",
            image_url=None,
        )

    assert captured_body["snippet"]["title"] == "New Video"


# ── publish_post dispatcher ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_publish_post_dispatcher_routes_youtube():
    with patch("app.services.social_publish_service.publish_to_youtube", new_callable=AsyncMock) as mock_yt:
        mock_yt.return_value = "yt_video_id_123"
        result = await publish_post(
            platform="youtube",
            content="Video post",
            image_url=None,
            video_url="http://localhost:8000/media/v.mp4",
            content_type="feed",
        )
    assert result == "yt_video_id_123"
    mock_yt.assert_called_once_with(
        "Video post",
        "http://localhost:8000/media/v.mp4",
        None,
        "feed",
        None,  # short_video_url
    )


@pytest.mark.asyncio
async def test_publish_post_dispatcher_routes_youtube_short_with_short_video_url():
    with patch("app.services.social_publish_service.publish_to_youtube", new_callable=AsyncMock) as mock_yt:
        mock_yt.return_value = "short_vid_456"
        result = await publish_post(
            platform="youtube",
            content="Short content #Shorts",
            image_url=None,
            video_url=None,
            content_type="short",
            short_video_url="http://localhost:8000/media/short.mp4",
        )
    assert result == "short_vid_456"
    mock_yt.assert_called_once_with(
        "Short content #Shorts",
        None,
        None,
        "short",
        "http://localhost:8000/media/short.mp4",
    )
