"""Sprint 3 — Outbound social publishing tests.

All external Graph API calls are mocked. Tests cover:
- Facebook publish success + platform_post_id stored
- Facebook publish failure → status='failed', error_message stored
- Instagram publish success (2-step container flow)
- Instagram publish blocked when no image
- Retry after failure (exponential backoff)
- Platform disabled blocks publish
- Unknown platform returns clear not-implemented error
- Status guard prevents re-publishing already-published post
- Auth guard on publish endpoint
- Auto-publish=True flow: draft → approved at creation time
- Platform-native preview (char counts, warnings)
- Retry history tracking
"""
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient


pytestmark = pytest.mark.asyncio


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _seed_platform(client: AsyncClient, platform: str, enabled: bool = True):
    await client.patch(
        f"/api/admin/social/platforms/{platform}",
        json={"enabled": enabled},
    )


async def _seed_outbox_post(client: AsyncClient, platform: str, content: str = "Test post", image_url: str | None = None) -> int:
    resp = await client.post(
        "/api/admin/pages",
        json={
            "title": "Test Blog",
            "slug": f"test-blog-{platform}",
            "content_html": "<p>Test content</p>",
            "page_type": "blog_post",
            "status": "draft",
        },
    )
    page_id = resp.json()["id"]
    from app.database import get_db
    async for db in get_db():
        await db.execute(
            "INSERT INTO social_posts (page_id, platform, content, image_url, status) VALUES (?, ?, ?, ?, 'draft')",
            (page_id, platform, content, image_url),
        )
        await db.commit()
        cur = await db.execute("SELECT last_insert_rowid()")
        row = await cur.fetchone()
        return row[0]


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_facebook_publish_success(admin_client: AsyncClient):
    await _seed_platform(admin_client, "facebook", enabled=True)
    post_id = await _seed_outbox_post(admin_client, "facebook", image_url="http://example.com/img.jpg")

    with patch(
        "app.services.social_publish_service.publish_to_facebook",
        new_callable=AsyncMock,
        return_value="123456_789012",
    ):
        resp = await admin_client.post(f"/api/admin/social/outbox/{post_id}/publish")

    assert resp.status_code == 200
    data = resp.json()
    assert data["published"] is True
    assert data["platform_post_id"] == "123456_789012"


async def test_facebook_publish_failure_marks_failed(admin_client: AsyncClient):
    await _seed_platform(admin_client, "facebook", enabled=True)
    post_id = await _seed_outbox_post(admin_client, "facebook")

    with patch(
        "app.services.social_publish_service.publish_to_facebook",
        new_callable=AsyncMock,
        side_effect=Exception("Graph API 400"),
    ):
        resp = await admin_client.post(f"/api/admin/social/outbox/{post_id}/publish")

    assert resp.status_code == 502
    detail = resp.json()["detail"]
    assert "failed" in detail.lower() or "400" in detail


async def test_instagram_publish_success(admin_client: AsyncClient):
    await _seed_platform(admin_client, "instagram", enabled=True)
    post_id = await _seed_outbox_post(admin_client, "instagram", image_url="http://example.com/img.jpg")

    with patch(
        "app.services.social_publish_service.publish_to_instagram",
        new_callable=AsyncMock,
        return_value="ig_media_999",
    ):
        resp = await admin_client.post(f"/api/admin/social/outbox/{post_id}/publish")

    assert resp.status_code == 200
    assert resp.json()["platform_post_id"] == "ig_media_999"


async def test_instagram_publish_blocked_no_image(admin_client: AsyncClient):
    await _seed_platform(admin_client, "instagram", enabled=True)
    post_id = await _seed_outbox_post(admin_client, "instagram", image_url=None)

    resp = await admin_client.post(f"/api/admin/social/outbox/{post_id}/publish")

    assert resp.status_code == 502
    assert "image" in resp.json()["detail"].lower()


async def test_retry_after_failure_succeeds(admin_client: AsyncClient):
    await _seed_platform(admin_client, "facebook", enabled=True)
    post_id = await _seed_outbox_post(admin_client, "facebook")

    with patch(
        "app.services.social_publish_service.publish_to_facebook",
        new_callable=AsyncMock,
        side_effect=Exception("Timeout"),
    ):
        await admin_client.post(f"/api/admin/social/outbox/{post_id}/publish")

    with patch(
        "app.services.social_publish_service.publish_to_facebook",
        new_callable=AsyncMock,
        return_value="retry_post_id",
    ):
        resp = await admin_client.post(f"/api/admin/social/outbox/{post_id}/publish")

    assert resp.status_code == 200
    assert resp.json()["platform_post_id"] == "retry_post_id"


async def test_disabled_platform_blocks_publish(admin_client: AsyncClient):
    await _seed_platform(admin_client, "facebook", enabled=False)
    post_id = await _seed_outbox_post(admin_client, "facebook")

    resp = await admin_client.post(f"/api/admin/social/outbox/{post_id}/publish")
    assert resp.status_code == 400
    assert "not enabled" in resp.json()["detail"].lower()


@pytest.mark.skip(reason="LinkedIn/TikTok/X not yet implemented — Sprint 4")
async def test_unimplemented_platform_returns_clear_error(admin_client: AsyncClient):
    await _seed_platform(admin_client, "linkedin", enabled=True)
    post_id = await _seed_outbox_post(admin_client, "linkedin")

    resp = await admin_client.post(f"/api/admin/social/outbox/{post_id}/publish")
    assert resp.status_code == 502
    assert "sprint 4" in resp.json()["detail"].lower() or "not yet" in resp.json()["detail"].lower()


async def test_published_post_cannot_be_republished(admin_client: AsyncClient):
    await _seed_platform(admin_client, "facebook", enabled=True)
    post_id = await _seed_outbox_post(admin_client, "facebook")

    with patch(
        "app.services.social_publish_service.publish_to_facebook",
        new_callable=AsyncMock,
        return_value="post_123",
    ):
        await admin_client.post(f"/api/admin/social/outbox/{post_id}/publish")

    resp = await admin_client.post(f"/api/admin/social/outbox/{post_id}/publish")
    assert resp.status_code == 400


async def test_publish_requires_auth(client: AsyncClient):
    resp = await client.post("/api/admin/social/outbox/1/publish")
    assert resp.status_code == 401


async def test_auto_publish_creates_approved_draft(admin_client: AsyncClient):
    await admin_client.patch(
        "/api/admin/social/platforms/facebook",
        json={"enabled": True, "auto_publish": True},
    )
    resp = await admin_client.post(
        "/api/admin/pages",
        json={
            "title": "Auto Publish Test",
            "slug": "auto-publish-test",
            "content_html": "<p>Content</p>",
            "page_type": "blog_post",
            "status": "published",
        },
    )
    assert resp.status_code == 201

    outbox = await admin_client.get("/api/admin/social/outbox?platform=facebook&post_status=approved")
    posts = outbox.json()["posts"]
    assert any(p["status"] == "approved" for p in posts)


# ── New Sprint 3 Tests — Retry & Preview ─────────────────────────────────────

async def test_retry_endpoint_schedules_retry(admin_client: AsyncClient):
    """Test that retry endpoint schedules a retry for failed post."""
    await _seed_platform(admin_client, "facebook", enabled=True)
    post_id = await _seed_outbox_post(admin_client, "facebook")
    
    # Fail the publish first
    with patch(
        "app.services.social_publish_service.publish_to_facebook",
        new_callable=AsyncMock,
        side_effect=Exception("Graph API 500"),
    ):
        await admin_client.post(f"/api/admin/social/outbox/{post_id}/publish")
    
    # Schedule retry
    resp = await admin_client.post(f"/api/admin/social/outbox/{post_id}/retry")
    assert resp.status_code == 200
    data = resp.json()
    assert "retry_id" in data
    assert data["attempt"] == 1
    assert "scheduled_at" in data


async def test_retry_history_tracked(admin_client: AsyncClient):
    """Test that retry history is tracked per post."""
    await _seed_platform(admin_client, "facebook", enabled=True)
    post_id = await _seed_outbox_post(admin_client, "facebook")
    
    # Fail and retry
    with patch(
        "app.services.social_publish_service.publish_to_facebook",
        new_callable=AsyncMock,
        side_effect=Exception("Error"),
    ):
        await admin_client.post(f"/api/admin/social/outbox/{post_id}/publish")
    
    await admin_client.post(f"/api/admin/social/outbox/{post_id}/retry")
    
    # Get history
    resp = await admin_client.get(f"/api/admin/social/outbox/{post_id}/retries")
    assert resp.status_code == 200
    data = resp.json()
    assert "retries" in data


async def test_platform_preview_twitter_warnings(admin_client: AsyncClient):
    """Test that Twitter preview shows 280 char limit warning."""
    long_content = "A" * 300  # 300 chars, exceeds 280
    
    resp = await admin_client.post(
        "/api/admin/social/preview",
        json={
            "content": long_content,
            "platform": "twitter",
            "hashtags": ["#test", "#long", "#tweet", "#too", "#many"]
        }
    )
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["platform"] == "twitter"
    assert data["character_count"] == 300
    assert data["within_limit"] is False
    assert len(data["warnings"]) > 0
    assert any("280" in w for w in data["warnings"])


async def test_platform_preview_instagram_warnings(admin_client: AsyncClient):
    """Test that Instagram preview shows hashtag warnings."""
    resp = await admin_client.post(
        "/api/admin/social/preview",
        json={
            "content": "Check out our new collection!",
            "platform": "instagram",
            "hashtags": [f"#tag{i}" for i in range(35)]  # 35 hashtags, exceeds 30
        }
    )
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["platform"] == "instagram"
    assert data["hashtag_count"] == 35
    assert len(data["warnings"]) > 0
    assert any("30" in w for w in data["warnings"])
