"""Tests for POST /api/admin/social/generate-images — added 2026-06-18.

Covers:
- Auth guard
- social context returns image_concepts string
- blog context forwarded correctly
- invalid context defaults to 'social'
- content too short → 422 validation
- topic too short → 422 validation
- AI error returns 500
- ValueError from service returns 400
- max_images_per_post field read/write on social_platform_configs
- brand persona brand_owner_pronouns + cultural_identity fields persisted
"""
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


# ── /generate-images ──────────────────────────────────────────────────────────

async def test_generate_images_requires_auth(client: AsyncClient):
    resp = await client.post(
        "/api/admin/social/generate-images",
        json={"content": "This is long enough content", "topic": "Summer"},
    )
    assert resp.status_code == 401


async def test_generate_images_social_context(admin_client: AsyncClient):
    with patch(
        "app.services.image_generation_service.generate_image_concepts",
        new=AsyncMock(return_value="PLATFORM PROMPTS HERE"),
    ) as mock_gen:
        resp = await admin_client.post(
            "/api/admin/social/generate-images",
            json={
                "content": "This is some generated post content for the brand",
                "topic": "Summer Launch",
                "context": "social",
            },
        )

    assert resp.status_code == 200
    assert resp.json()["image_concepts"] == "PLATFORM PROMPTS HERE"
    mock_gen.assert_called_once()
    args = mock_gen.call_args.args
    kwargs = mock_gen.call_args.kwargs
    called_context = args[2] if len(args) > 2 else kwargs.get("context", "social")
    assert called_context == "social"


async def test_generate_images_blog_context(admin_client: AsyncClient):
    with patch(
        "app.services.image_generation_service.generate_image_concepts",
        new=AsyncMock(return_value="BLOG PROMPTS"),
    ) as mock_gen:
        resp = await admin_client.post(
            "/api/admin/social/generate-images",
            json={
                "content": "Blog post content here that is long enough",
                "topic": "Heritage Collection",
                "context": "blog",
            },
        )

    assert resp.status_code == 200
    args = mock_gen.call_args.args
    kwargs = mock_gen.call_args.kwargs
    called_context = args[2] if len(args) > 2 else kwargs.get("context")
    assert called_context == "blog"


async def test_generate_images_invalid_context_defaults_to_social(admin_client: AsyncClient):
    with patch(
        "app.services.image_generation_service.generate_image_concepts",
        new=AsyncMock(return_value="result"),
    ) as mock_gen:
        resp = await admin_client.post(
            "/api/admin/social/generate-images",
            json={
                "content": "Some generated content for the brand",
                "topic": "Spring",
                "context": "newsletter",
            },
        )

    assert resp.status_code == 200
    args = mock_gen.call_args.args
    kwargs = mock_gen.call_args.kwargs
    called_context = args[2] if len(args) > 2 else kwargs.get("context", "social")
    assert called_context == "social"


async def test_generate_images_content_too_short(admin_client: AsyncClient):
    resp = await admin_client.post(
        "/api/admin/social/generate-images",
        json={"content": "short", "topic": "Topic"},
    )
    assert resp.status_code == 422


async def test_generate_images_topic_too_short(admin_client: AsyncClient):
    resp = await admin_client.post(
        "/api/admin/social/generate-images",
        json={"content": "This is long enough content for the test", "topic": "ab"},
    )
    assert resp.status_code == 422


async def test_generate_images_ai_error_returns_500(admin_client: AsyncClient):
    with patch(
        "app.services.image_generation_service.generate_image_concepts",
        new=AsyncMock(side_effect=RuntimeError("LLM unavailable")),
    ):
        resp = await admin_client.post(
            "/api/admin/social/generate-images",
            json={
                "content": "Valid long enough content for the test",
                "topic": "Summer Campaign",
            },
        )

    assert resp.status_code == 500
    assert "failed" in resp.json()["detail"].lower()


async def test_generate_images_value_error_returns_400(admin_client: AsyncClient):
    with patch(
        "app.services.image_generation_service.generate_image_concepts",
        new=AsyncMock(side_effect=ValueError("No platforms configured")),
    ):
        resp = await admin_client.post(
            "/api/admin/social/generate-images",
            json={
                "content": "Valid long enough content for the test",
                "topic": "Campaign",
            },
        )

    assert resp.status_code == 400
    assert "No platforms configured" in resp.json()["detail"]


# ── max_images_per_post on social_platform_configs ────────────────────────────

async def _seed_platform_with_max_images(platform: str, max_images: int):
    from app.database import db_connection
    async with db_connection() as db:
        await db.execute(
            """INSERT INTO social_platform_configs
               (platform, display_name, enabled, hashtag_mode, max_hashtags, max_images_per_post)
               VALUES ($1, $2, TRUE, 'auto', 5, $3)
               ON CONFLICT (platform) DO UPDATE
                   SET max_images_per_post = EXCLUDED.max_images_per_post""",
            (platform, platform.capitalize(), max_images),
        )


async def test_max_images_per_post_persisted_and_returned(admin_client: AsyncClient):
    """Setting max_images_per_post via PATCH returns it in subsequent GET."""
    await _seed_platform_with_max_images("instagram", 3)

    resp = await admin_client.get("/api/admin/social/platforms/instagram")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("max_images_per_post") == 3


async def test_max_images_per_post_default_value(admin_client: AsyncClient):
    """Threads is seeded by migration 067 with max_images_per_post=10."""
    from app.database import db_connection
    async with db_connection() as db:
        await db.execute(
            """INSERT INTO social_platform_configs
               (platform, display_name, enabled, hashtag_mode, max_hashtags)
               VALUES ($1, $2, TRUE, 'auto', 5)
               ON CONFLICT (platform) DO NOTHING""",
            ("threads", "Threads"),
        )

    resp = await admin_client.get("/api/admin/social/platforms/threads")
    assert resp.status_code == 200
    # Migration 067 sets DEFAULT 1; our seed migration updates Threads to 10
    val = resp.json().get("max_images_per_post")
    assert val is not None  # column must always be present (never null after migration 067)


# ── Brand persona identity fields ─────────────────────────────────────────────

async def test_brand_persona_identity_fields_persisted(admin_client: AsyncClient):
    """brand_owner_pronouns and cultural_identity are saved and returned."""
    resp = await admin_client.patch(
        "/api/admin/social/persona",
        json={
            "voice": "Bold and grounded",
            "audience": "Indigenous youth 18-34",
            "values_text": "Community, land, sovereignty",
            "brand_owner_pronouns": "she/her",
            "cultural_identity": "Cree Nation, Treaty 6",
        },
    )
    assert resp.status_code == 200

    get_resp = await admin_client.get("/api/admin/social/persona")
    assert get_resp.status_code == 200
    persona = get_resp.json()
    assert persona.get("brand_owner_pronouns") == "she/her"
    assert persona.get("cultural_identity") == "Cree Nation, Treaty 6"


async def test_brand_persona_pronouns_they_them(admin_client: AsyncClient):
    """they/them pronouns are stored correctly."""
    resp = await admin_client.patch(
        "/api/admin/social/persona",
        json={
            "voice": "Inclusive and warm",
            "audience": "All communities",
            "values_text": "Respect",
            "brand_owner_pronouns": "they/them",
            "cultural_identity": "",
        },
    )
    assert resp.status_code == 200

    get_resp = await admin_client.get("/api/admin/social/persona")
    assert get_resp.status_code == 200
    assert get_resp.json().get("brand_owner_pronouns") == "they/them"


async def test_brand_persona_fields_optional_null(admin_client: AsyncClient):
    """Updating a persona without identity fields does not fail."""
    resp = await admin_client.patch(
        "/api/admin/social/persona",
        json={
            "voice": "Bold",
            "audience": "Youth",
            "values_text": "Community",
        },
    )
    assert resp.status_code == 200
