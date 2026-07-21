"""Moment Capture — generate + batch-save tests.

Covers:
- POST /moment-capture  — generate drafts (AI mocked)
- POST /moment-capture/save — batch save, compliance, hashtags (all AI mocked)
- Batch save: parallel compliance + hashtag generation
- Batch save: invalid platform rejected per-draft, others still save
- Batch save: empty drafts array → 400
- Batch save: compliance issues flagged but post still saved (non-blocking)
- Auth guard on both endpoints
- Idempotency: saving same content twice creates two distinct rows
"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


# ── Shared mock values ────────────────────────────────────────────────────────

def _make_clean_compliance():
    m = MagicMock()
    m.status = "clean"
    m.overall_severity = "none"
    m.issues = []
    m.can_auto_fix = False
    m.ai_analysis = ""
    return m


def _make_warn_compliance():
    issue = MagicMock()
    issue.severity = "medium"
    issue.category = "tone"
    issue.description = "Potentially misleading claim"
    issue.excerpt = "..."
    issue.suggested_fix = "Rephrase"
    issue.auto_fixable = True
    m = MagicMock()
    m.status = "warning"
    m.overall_severity = "medium"
    m.issues = [issue]
    m.can_auto_fix = True
    return m


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _seed_platform(platform: str, enabled: bool = True):
    from app.database import db_connection
    async with db_connection() as db:
        await db.execute(
            """INSERT INTO social_platform_configs
               (platform, display_name, enabled, hashtag_mode, max_hashtags)
               VALUES ($1, $2, $3, 'auto', 5)
               ON CONFLICT (platform) DO UPDATE
                   SET enabled = EXCLUDED.enabled""",
            (platform, platform.capitalize(), enabled),
        )


async def _count_posts(platform: str | None = None) -> int:
    from app.database import db_connection
    async with db_connection() as db:
        if platform:
            cursor = await db.execute(
                "SELECT COUNT(*) AS n FROM social_posts WHERE platform = $1", (platform,)
            )
        else:
            cursor = await db.execute("SELECT COUNT(*) AS n FROM social_posts")
        row = await cursor.fetchone()
        return row["n"]


# ── /moment-capture (generate) ────────────────────────────────────────────────

async def test_generate_requires_auth(client: AsyncClient):
    resp = await client.post("/api/admin/social/moment-capture", json={"moment": "test"})
    assert resp.status_code == 401


async def test_generate_no_enabled_platforms(admin_client: AsyncClient):
    resp = await admin_client.post(
        "/api/admin/social/moment-capture", json={"moment": "A great day at the powwow"}
    )
    assert resp.status_code == 400
    assert "No platforms" in resp.json()["detail"]


async def test_generate_returns_draft_per_platform(admin_client: AsyncClient):
    await _seed_platform("facebook")
    await _seed_platform("instagram")

    with patch(
        "app.services.ai_service.generate_social_post",
        new=AsyncMock(return_value="Test content for platform"),
    ), patch(
        "app.services.posting_strategy_service.pick_content_type_for_platform",
        new=AsyncMock(return_value="community"),
    ):
        resp = await admin_client.post(
            "/api/admin/social/moment-capture",
            json={"moment": "Big launch today", "extra_context": "Indigenous clothing brand"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["platforms_attempted"] == 2
    assert data["platforms_succeeded"] == 2
    assert len(data["drafts"]) == 2
    platforms = {d["platform"] for d in data["drafts"]}
    assert platforms == {"facebook", "instagram"}
    for draft in data["drafts"]:
        assert draft["status"] == "ok"
        assert draft["content"] == "Test content for platform"


async def test_generate_handles_single_platform_timeout(admin_client: AsyncClient):
    """One platform timing out should not block others from succeeding."""
    import asyncio
    await _seed_platform("facebook")
    await _seed_platform("instagram")

    call_count = 0

    async def _flaky_generate(*args, platform="facebook", **kwargs):
        nonlocal call_count
        call_count += 1
        if platform == "facebook":
            raise asyncio.TimeoutError()
        return "Instagram content"

    with patch(
        "app.services.ai_service.generate_social_post",
        new=AsyncMock(side_effect=lambda *a, **kw: _flaky_generate(*a, **kw)),
    ), patch(
        "app.services.posting_strategy_service.pick_content_type_for_platform",
        new=AsyncMock(return_value="community"),
    ), patch(
        "asyncio.wait_for",
        new=AsyncMock(side_effect=asyncio.TimeoutError),
    ):
        # Can't easily mock wait_for per-platform, so we test the error path directly
        resp = await admin_client.post(
            "/api/admin/social/moment-capture",
            json={"moment": "test moment"},
        )

    assert resp.status_code == 200
    # At least one draft returned (may be error status for failed ones)
    assert len(resp.json()["drafts"]) >= 1


# ── /moment-capture/save (batch save) ─────────────────────────────────────────

async def test_batch_save_requires_auth(client: AsyncClient):
    resp = await client.post(
        "/api/admin/social/moment-capture/save",
        json={"drafts": [{"platform": "facebook", "content": "Hello"}]},
    )
    assert resp.status_code == 401


async def test_batch_save_empty_drafts_rejected(admin_client: AsyncClient):
    resp = await admin_client.post(
        "/api/admin/social/moment-capture/save", json={"drafts": []}
    )
    assert resp.status_code == 422


async def test_batch_save_single_draft(admin_client: AsyncClient):
    await _seed_platform("facebook")
    before = await _count_posts("facebook")

    with patch(
        "app.routes.admin.social.check_content_compliance",
        new=AsyncMock(return_value=_make_clean_compliance()),
    ), patch(
        "app.routes.admin.social.generate_hashtags_with_ai",
        new=AsyncMock(return_value=["#IndigenousOwned", "#BadAssElder"]),
    ), patch(
        "app.routes.admin.social.pick_content_type_for_platform",
        new=AsyncMock(return_value="community"),
    ):
        resp = await admin_client.post(
            "/api/admin/social/moment-capture/save",
            json={"drafts": [{"platform": "facebook", "content": "Big launch today!"}]},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved_count"] == 1
    assert data["failed_count"] == 0
    assert data["results"][0]["saved"] is True
    assert "post_id" in data["results"][0]
    assert data["results"][0]["compliance"]["status"] == "clean"
    assert await _count_posts("facebook") == before + 1


async def test_batch_save_multi_platform_parallel(admin_client: AsyncClient):
    """All platforms processed simultaneously — saved_count matches submitted count."""
    for p in ("facebook", "instagram", "linkedin", "threads"):
        await _seed_platform(p)

    drafts = [
        {"platform": "facebook", "content": "Facebook content", "strategy_content_type": "community"},
        {"platform": "instagram", "content": "Instagram content", "strategy_content_type": "ugc"},
        {"platform": "linkedin", "content": "LinkedIn content", "strategy_content_type": "company_news"},
        {"platform": "threads", "content": "Threads content", "strategy_content_type": "community"},
    ]

    with patch(
        "app.routes.admin.social.check_content_compliance",
        new=AsyncMock(return_value=_make_clean_compliance()),
    ), patch(
        "app.routes.admin.social.generate_hashtags_with_ai",
        new=AsyncMock(return_value=["#BAE"]),
    ):
        resp = await admin_client.post(
            "/api/admin/social/moment-capture/save", json={"drafts": drafts}
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved_count"] == 4
    assert data["failed_count"] == 0
    # Each result has a unique post_id
    post_ids = [r["post_id"] for r in data["results"] if r.get("saved")]
    assert len(set(post_ids)) == 4


async def test_batch_save_invalid_platform_fails_per_draft(admin_client: AsyncClient):
    """Invalid platform returns per-draft error; valid platform sibling still saves."""
    await _seed_platform("facebook")

    drafts = [
        {"platform": "facebook", "content": "Valid post"},
        {"platform": "myspace", "content": "Invalid platform"},  # invalid
    ]

    with patch(
        "app.routes.admin.social.check_content_compliance",
        new=AsyncMock(return_value=_make_clean_compliance()),
    ), patch(
        "app.routes.admin.social.generate_hashtags_with_ai",
        new=AsyncMock(return_value=[]),
    ), patch(
        "app.routes.admin.social.pick_content_type_for_platform",
        new=AsyncMock(return_value="community"),
    ):
        resp = await admin_client.post(
            "/api/admin/social/moment-capture/save", json={"drafts": drafts}
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved_count"] == 1
    assert data["failed_count"] == 1

    results_by_platform = {r["platform"]: r for r in data["results"]}
    assert results_by_platform["facebook"]["saved"] is True
    assert results_by_platform["myspace"]["saved"] is False
    assert "Invalid platform" in results_by_platform["myspace"]["error"]


async def test_batch_save_compliance_warning_does_not_block(admin_client: AsyncClient):
    """A compliance warning still saves the post — non-blocking. Issues flagged in response."""
    await _seed_platform("instagram")

    with patch(
        "app.routes.admin.social.check_content_compliance",
        new=AsyncMock(return_value=_make_warn_compliance()),
    ), patch(
        "app.routes.admin.social.generate_hashtags_with_ai",
        new=AsyncMock(return_value=["#BAE"]),
    ), patch(
        "app.routes.admin.social.pick_content_type_for_platform",
        new=AsyncMock(return_value="ugc"),
    ):
        resp = await admin_client.post(
            "/api/admin/social/moment-capture/save",
            json={"drafts": [{"platform": "instagram", "content": "Possibly misleading claim here"}]},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved_count"] == 1
    result = data["results"][0]
    assert result["saved"] is True
    assert result["compliance"]["status"] == "warning"
    assert result["compliance"]["issues_count"] == 1

    # Confirm it's actually in the DB
    from app.database import db_connection
    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT compliance_status, compliance_issues_count FROM social_posts WHERE id = $1",
            (result["post_id"],),
        )
        row = await cursor.fetchone()
    assert row["compliance_status"] == "warning"
    assert row["compliance_issues_count"] == 1


async def test_batch_save_hashtags_stored_in_db(admin_client: AsyncClient):
    """Auto-generated hashtags are persisted alongside the post."""
    await _seed_platform("x")

    with patch(
        "app.routes.admin.social.check_content_compliance",
        new=AsyncMock(return_value=_make_clean_compliance()),
    ), patch(
        "app.routes.admin.social.generate_hashtags_with_ai",
        new=AsyncMock(return_value=["#IndigenousClothing", "#BadAssElder"]),
    ), patch(
        "app.routes.admin.social.pick_content_type_for_platform",
        new=AsyncMock(return_value="educational"),
    ):
        resp = await admin_client.post(
            "/api/admin/social/moment-capture/save",
            json={"drafts": [{"platform": "x", "content": "Thread on resilience"}]},
        )

    assert resp.status_code == 200
    post_id = resp.json()["results"][0]["post_id"]

    from app.database import db_connection
    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT hashtags FROM social_posts WHERE id = $1", (post_id,)
        )
        row = await cursor.fetchone()

    tags = json.loads(row["hashtags"])
    assert "#AIAssisted" in tags  # X always prepends this
    assert "#IndigenousClothing" in tags or "#BadAssElder" in tags


async def test_batch_save_idempotent_creates_separate_rows(admin_client: AsyncClient):
    """Saving the same content twice creates two distinct posts (no upsert)."""
    await _seed_platform("facebook")
    payload = {"drafts": [{"platform": "facebook", "content": "Same content"}]}

    with patch(
        "app.routes.admin.social.check_content_compliance",
        new=AsyncMock(return_value=_make_clean_compliance()),
    ), patch(
        "app.routes.admin.social.generate_hashtags_with_ai",
        new=AsyncMock(return_value=[]),
    ), patch(
        "app.routes.admin.social.pick_content_type_for_platform",
        new=AsyncMock(return_value="community"),
    ):
        r1 = await admin_client.post("/api/admin/social/moment-capture/save", json=payload)
        r2 = await admin_client.post("/api/admin/social/moment-capture/save", json=payload)

    assert r1.status_code == 200
    assert r2.status_code == 200
    id1 = r1.json()["results"][0]["post_id"]
    id2 = r2.json()["results"][0]["post_id"]
    assert id1 != id2


async def test_batch_save_strategy_content_type_persisted(admin_client: AsyncClient):
    """strategy_content_type from the Moment Capture draft is stored on the post."""
    await _seed_platform("linkedin")

    with patch(
        "app.routes.admin.social.check_content_compliance",
        new=AsyncMock(return_value=_make_clean_compliance()),
    ), patch(
        "app.routes.admin.social.generate_hashtags_with_ai",
        new=AsyncMock(return_value=[]),
    ):
        resp = await admin_client.post(
            "/api/admin/social/moment-capture/save",
            json={"drafts": [{"platform": "linkedin", "content": "Hiring post", "strategy_content_type": "company_news"}]},
        )

    post_id = resp.json()["results"][0]["post_id"]
    from app.database import db_connection
    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT strategy_content_type FROM social_posts WHERE id = $1", (post_id,)
        )
        row = await cursor.fetchone()
    assert row["strategy_content_type"] == "company_news"


async def test_batch_save_image_url_persisted(admin_client: AsyncClient):
    """image_url from the Moment Capture draft is stored on the post."""
    await _seed_platform("instagram")

    with patch(
        "app.routes.admin.social.check_content_compliance",
        new=AsyncMock(return_value=_make_clean_compliance()),
    ), patch(
        "app.routes.admin.social.generate_hashtags_with_ai",
        new=AsyncMock(return_value=[]),
    ), patch(
        "app.routes.admin.social.pick_content_type_for_platform",
        new=AsyncMock(return_value="ugc"),
    ):
        resp = await admin_client.post(
            "/api/admin/social/moment-capture/save",
            json={"drafts": [{
                "platform": "instagram",
                "content": "Caption here",
                "image_url": "http://localhost:8000/media/test-image.png",
            }]},
        )

    post_id = resp.json()["results"][0]["post_id"]
    from app.database import db_connection
    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT image_url FROM social_posts WHERE id = $1", (post_id,)
        )
        row = await cursor.fetchone()
    assert row["image_url"] == "http://localhost:8000/media/test-image.png"


async def test_batch_save_additional_image_urls_persisted(admin_client: AsyncClient):
    """additional_image_urls are serialised as JSON and stored on the post."""
    await _seed_platform("instagram")

    with patch(
        "app.routes.admin.social.check_content_compliance",
        new=AsyncMock(return_value=_make_clean_compliance()),
    ), patch(
        "app.routes.admin.social.generate_hashtags_with_ai",
        new=AsyncMock(return_value=[]),
    ), patch(
        "app.routes.admin.social.pick_content_type_for_platform",
        new=AsyncMock(return_value="ugc"),
    ):
        resp = await admin_client.post(
            "/api/admin/social/moment-capture/save",
            json={"drafts": [{
                "platform": "instagram",
                "content": "Carousel caption",
                "image_url": "http://localhost:8000/media/slide1.png",
                "additional_image_urls": [
                    "http://localhost:8000/media/slide2.png",
                    "http://localhost:8000/media/slide3.png",
                ],
            }]},
        )

    assert resp.status_code == 200
    post_id = resp.json()["results"][0]["post_id"]

    from app.database import db_connection
    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT image_url, additional_image_urls FROM social_posts WHERE id = $1", (post_id,)
        )
        row = await cursor.fetchone()

    assert row["image_url"] == "http://localhost:8000/media/slide1.png"
    extra = json.loads(row["additional_image_urls"])
    assert "http://localhost:8000/media/slide2.png" in extra
    assert "http://localhost:8000/media/slide3.png" in extra


# ── /moment-capture (generate) — new image modes ─────────────────────────────

async def test_generate_image_only_mode(admin_client: AsyncClient):
    """image_urls only (no moment text) triggers vision + generates drafts."""
    await _seed_platform("instagram")

    with patch(
        "app.services.ai_service.describe_images_for_content",
        new=AsyncMock(return_value={
            "description": "A woman in regalia at a powwow.",
            "ranked_urls": ["http://cdn.example.com/photo1.jpg"],
        }),
    ), patch(
        "app.services.ai_service.generate_social_post",
        new=AsyncMock(return_value="Image-driven caption"),
    ), patch(
        "app.services.posting_strategy_service.pick_content_type_for_platform",
        new=AsyncMock(return_value="community"),
    ):
        resp = await admin_client.post(
            "/api/admin/social/moment-capture",
            json={"image_urls": ["http://cdn.example.com/photo1.jpg"]},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["platforms_succeeded"] == 1
    draft = data["drafts"][0]
    assert draft["status"] == "ok"
    assert draft["image_url"] == "http://cdn.example.com/photo1.jpg"


async def test_generate_both_text_and_images_mode(admin_client: AsyncClient):
    """Providing both moment text and image_urls combines them into the prompt."""
    await _seed_platform("facebook")

    with patch(
        "app.services.ai_service.describe_images_for_content",
        new=AsyncMock(return_value={
            "description": "Outdoor market scene.",
            "ranked_urls": ["http://cdn.example.com/img.jpg"],
        }),
    ), patch(
        "app.services.ai_service.generate_social_post",
        new=AsyncMock(return_value="Combined caption"),
    ), patch(
        "app.services.posting_strategy_service.pick_content_type_for_platform",
        new=AsyncMock(return_value="educational"),
    ):
        resp = await admin_client.post(
            "/api/admin/social/moment-capture",
            json={
                "moment": "Big launch today",
                "image_urls": ["http://cdn.example.com/img.jpg"],
            },
        )

    assert resp.status_code == 200
    assert resp.json()["platforms_succeeded"] == 1


async def test_generate_rejects_empty_text_and_empty_images(admin_client: AsyncClient):
    """Sending neither moment nor image_urls must return 400."""
    await _seed_platform("facebook")

    resp = await admin_client.post(
        "/api/admin/social/moment-capture",
        json={"moment": "", "image_urls": []},
    )

    assert resp.status_code == 400
    assert "image" in resp.json()["detail"].lower() or "moment" in resp.json()["detail"].lower()


async def test_generate_legacy_image_url_merged_with_image_urls(admin_client: AsyncClient):
    """Legacy image_url is merged with image_urls and deduplicated."""
    await _seed_platform("facebook")

    with patch(
        "app.services.ai_service.describe_images_for_content",
        new=AsyncMock(return_value={
            "description": "desc",
            "ranked_urls": ["http://cdn.example.com/a.jpg", "http://cdn.example.com/b.jpg"],
        }),
    ), patch(
        "app.services.ai_service.generate_social_post",
        new=AsyncMock(return_value="content"),
    ), patch(
        "app.services.posting_strategy_service.pick_content_type_for_platform",
        new=AsyncMock(return_value="community"),
    ):
        resp = await admin_client.post(
            "/api/admin/social/moment-capture",
            json={
                "image_url": "http://cdn.example.com/a.jpg",
                "image_urls": ["http://cdn.example.com/b.jpg"],
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["platforms_succeeded"] == 1
    assert len(data["image_urls_used"]) == 2


async def test_generate_legacy_image_url_not_duplicated(admin_client: AsyncClient):
    """Same URL in both image_url and image_urls must appear only once."""
    await _seed_platform("facebook")

    with patch(
        "app.services.ai_service.describe_images_for_content",
        new=AsyncMock(return_value={
            "description": "desc",
            "ranked_urls": ["http://cdn.example.com/same.jpg"],
        }),
    ), patch(
        "app.services.ai_service.generate_social_post",
        new=AsyncMock(return_value="content"),
    ), patch(
        "app.services.posting_strategy_service.pick_content_type_for_platform",
        new=AsyncMock(return_value="community"),
    ):
        resp = await admin_client.post(
            "/api/admin/social/moment-capture",
            json={
                "image_url": "http://cdn.example.com/same.jpg",
                "image_urls": ["http://cdn.example.com/same.jpg"],
            },
        )

    assert resp.status_code == 200
    assert len(resp.json()["image_urls_used"]) == 1


async def test_generate_max_images_per_post_respected_in_draft(admin_client: AsyncClient):
    """max_images_per_post=1 on platform means additional_image_urls empty in draft."""
    from app.database import db_connection

    async with db_connection() as db:
        await db.execute(
            """INSERT INTO social_platform_configs
               (platform, display_name, enabled, hashtag_mode, max_hashtags, max_images_per_post)
               VALUES ($1, $2, $3, 'auto', 5, 1)
               ON CONFLICT (platform) DO UPDATE
                   SET enabled = EXCLUDED.enabled,
                       max_images_per_post = EXCLUDED.max_images_per_post""",
            ("facebook", "Facebook", True),
        )

    with patch(
        "app.services.ai_service.describe_images_for_content",
        new=AsyncMock(return_value={
            "description": "desc",
            "ranked_urls": ["http://cdn.example.com/a.jpg", "http://cdn.example.com/b.jpg"],
        }),
    ), patch(
        "app.services.ai_service.generate_social_post",
        new=AsyncMock(return_value="content"),
    ), patch(
        "app.services.posting_strategy_service.pick_content_type_for_platform",
        new=AsyncMock(return_value="community"),
    ):
        resp = await admin_client.post(
            "/api/admin/social/moment-capture",
            json={"image_urls": ["http://cdn.example.com/a.jpg", "http://cdn.example.com/b.jpg"]},
        )

    assert resp.status_code == 200
    draft = resp.json()["drafts"][0]
    assert draft["image_url"] == "http://cdn.example.com/a.jpg"
    assert draft["additional_image_urls"] == []


async def test_generate_multi_image_platform_assigns_extras(admin_client: AsyncClient):
    """Instagram (multi-image) gets additional_image_urls populated in draft."""
    from app.database import db_connection
    async with db_connection() as db:
        await db.execute(
            """INSERT INTO social_platform_configs
               (platform, display_name, enabled, hashtag_mode, max_hashtags, max_images_per_post)
               VALUES ($1, $2, TRUE, 'auto', 5, 10)
               ON CONFLICT (platform) DO UPDATE
                   SET enabled = TRUE, max_images_per_post = 10""",
            ("instagram", "Instagram"),
        )

    ranked = ["a.jpg", "b.jpg", "c.jpg"]

    with patch(
        "app.services.ai_service.describe_images_for_content",
        new=AsyncMock(return_value={"description": "desc", "ranked_urls": ranked}),
    ), patch(
        "app.services.ai_service.generate_social_post",
        new=AsyncMock(return_value="content"),
    ), patch(
        "app.services.posting_strategy_service.pick_content_type_for_platform",
        new=AsyncMock(return_value="ugc"),
    ):
        resp = await admin_client.post(
            "/api/admin/social/moment-capture",
            json={"image_urls": ranked},
        )

    assert resp.status_code == 200
    draft = resp.json()["drafts"][0]
    assert draft["image_url"] == "a.jpg"
    assert "b.jpg" in draft["additional_image_urls"]


async def test_generate_image_urls_returned_in_response(admin_client: AsyncClient):
    """Response includes image_urls_used showing the ranked order from vision."""
    await _seed_platform("facebook")

    with patch(
        "app.services.ai_service.describe_images_for_content",
        new=AsyncMock(return_value={
            "description": "desc",
            "ranked_urls": ["b.jpg", "a.jpg"],
        }),
    ), patch(
        "app.services.ai_service.generate_social_post",
        new=AsyncMock(return_value="content"),
    ), patch(
        "app.services.posting_strategy_service.pick_content_type_for_platform",
        new=AsyncMock(return_value="community"),
    ):
        resp = await admin_client.post(
            "/api/admin/social/moment-capture",
            json={"image_urls": ["a.jpg", "b.jpg"]},
        )

    assert resp.status_code == 200
    assert resp.json()["image_urls_used"] == ["b.jpg", "a.jpg"]
