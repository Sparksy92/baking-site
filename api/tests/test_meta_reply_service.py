"""Tests for meta_reply_service — publish_facebook_reply, publish_instagram_reply,
and send_reply_to_platform error branches."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ── publish_facebook_reply ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_publish_facebook_reply_to_comment():
    from app.services.meta_reply_service import publish_facebook_reply

    mock_resp = MagicMock()
    mock_resp.json.return_value = {"id": "comment_123"}

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(return_value=mock_resp)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await publish_facebook_reply(
            page_access_token="PAGE_TOKEN",
            post_id="post_456",
            comment_id="thread_789",
            message="Thanks for your comment!",
        )

    assert result == "comment_123"
    call_args = mock_client.post.call_args
    assert "thread_789" in call_args[0][0]


@pytest.mark.asyncio
async def test_publish_facebook_reply_to_post_no_comment_id():
    from app.services.meta_reply_service import publish_facebook_reply

    mock_resp = MagicMock()
    mock_resp.json.return_value = {"id": "new_comment_999"}

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(return_value=mock_resp)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await publish_facebook_reply(
            page_access_token="TOKEN",
            post_id="post_123",
            comment_id=None,
            message="Replying to post",
        )

    assert result == "new_comment_999"
    call_args = mock_client.post.call_args
    assert "post_123" in call_args[0][0]


@pytest.mark.asyncio
async def test_publish_facebook_reply_api_error_raises():
    from app.services.meta_reply_service import publish_facebook_reply, PublishReplyError

    mock_resp = MagicMock()
    mock_resp.json.return_value = {
        "error": {"message": "Invalid OAuth token", "code": 190}
    }

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(return_value=mock_resp)

    with patch("httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(PublishReplyError, match="Facebook API error"):
            await publish_facebook_reply("TOKEN", "post_1", None, "Hi")


@pytest.mark.asyncio
async def test_publish_facebook_reply_no_id_returned_raises():
    from app.services.meta_reply_service import publish_facebook_reply, PublishReplyError

    mock_resp = MagicMock()
    mock_resp.json.return_value = {}  # No "id" key

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(return_value=mock_resp)

    with patch("httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(PublishReplyError, match="No comment ID"):
            await publish_facebook_reply("TOKEN", "post_1", None, "Hello")


# ── publish_instagram_reply ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_publish_instagram_reply_success():
    from app.services.meta_reply_service import publish_instagram_reply

    mock_resp = MagicMock()
    mock_resp.json.return_value = {"id": "ig_reply_456"}

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(return_value=mock_resp)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await publish_instagram_reply(
            ig_account_id="ig_account_001",
            media_id="media_789",
            comment_id=None,
            message="Thank you!",
            access_token="IG_TOKEN",
        )

    assert result == "ig_reply_456"


@pytest.mark.asyncio
async def test_publish_instagram_reply_api_error_raises():
    from app.services.meta_reply_service import publish_instagram_reply, PublishReplyError

    mock_resp = MagicMock()
    mock_resp.json.return_value = {"error": {"message": "Permission denied", "code": 200}}

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(return_value=mock_resp)

    with patch("httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(PublishReplyError, match="Instagram API error"):
            await publish_instagram_reply("acc", "media", None, "Hi", "TOKEN")


# ── send_reply_to_platform error branches ─────────────────────────────────────

@pytest.mark.asyncio
async def test_send_reply_unknown_platform_raises(client):
    from app.services.meta_reply_service import send_reply_to_platform, PublishReplyError
    from app.database import db_connection

    async with db_connection() as db:
        cursor = await db.execute(
            """INSERT INTO social_engagement_events
               (platform, event_type, message)
               VALUES ($1, $2, $3) RETURNING id""",
            ("pinterest", "comment", "test comment"),
        )
        row = await cursor.fetchone()
        event_id = row["id"]

    with pytest.raises(PublishReplyError, match="Unknown platform"):
        await send_reply_to_platform(event_id, "Hello")


@pytest.mark.asyncio
async def test_send_reply_linkedin_raises(client):
    from app.services.meta_reply_service import send_reply_to_platform, PublishReplyError
    from app.database import db_connection

    async with db_connection() as db:
        cursor = await db.execute(
            """INSERT INTO social_engagement_events
               (platform, event_type, message)
               VALUES ($1, $2, $3) RETURNING id""",
            ("linkedin", "comment", "nice post"),
        )
        row = await cursor.fetchone()
        event_id = row["id"]

    with pytest.raises(PublishReplyError, match="LinkedIn replies not yet implemented"):
        await send_reply_to_platform(event_id, "Thank you!")


@pytest.mark.asyncio
async def test_send_reply_event_not_found_raises():
    from app.services.meta_reply_service import send_reply_to_platform

    with pytest.raises(ValueError, match="not found"):
        await send_reply_to_platform(99999999, "Hello")
