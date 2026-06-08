"""Social platform configuration API tests.

Sprint 1 — tests written before implementation (TDD).
Covers: list platforms, enable/disable, prompt editing, hashtag bank, auto-publish toggle,
setup status visibility, and authentication guards.
"""
import pytest
from httpx import AsyncClient


pytestmark = pytest.mark.asyncio

PLATFORMS = ["facebook", "instagram", "x", "linkedin", "tiktok", "youtube"]


@pytest.mark.xfail(reason="Social platform API not yet implemented — Sprint 1")
async def test_list_all_platforms(admin_client: AsyncClient):
    """GET /api/admin/social/platforms returns all 6 platforms seeded by migration."""
    resp = await admin_client.get("/api/admin/social/platforms")
    assert resp.status_code == 200
    data = resp.json()
    returned_platforms = [p["platform"] for p in data]
    for platform in PLATFORMS:
        assert platform in returned_platforms


@pytest.mark.xfail(reason="Social platform API not yet implemented — Sprint 1")
async def test_all_platforms_disabled_by_default(admin_client: AsyncClient):
    """All platforms are disabled by default after migration."""
    resp = await admin_client.get("/api/admin/social/platforms")
    for p in resp.json():
        assert p["enabled"] is False


@pytest.mark.xfail(reason="Social platform API not yet implemented — Sprint 1")
async def test_enable_platform(admin_client: AsyncClient):
    """PATCH /api/admin/social/platforms/facebook can enable a platform."""
    resp = await admin_client.patch("/api/admin/social/platforms/facebook", json={"enabled": True})
    assert resp.status_code == 200

    resp = await admin_client.get("/api/admin/social/platforms")
    fb = next(p for p in resp.json() if p["platform"] == "facebook")
    assert fb["enabled"] is True


@pytest.mark.xfail(reason="Social platform API not yet implemented — Sprint 1")
async def test_update_platform_prompt(admin_client: AsyncClient):
    """PATCH updates the prompt template for a platform."""
    custom_prompt = "Write a punchy 280-char tweet with 1-2 hashtags."
    resp = await admin_client.patch("/api/admin/social/platforms/x", json={
        "prompt_template": custom_prompt,
    })
    assert resp.status_code == 200

    resp = await admin_client.get("/api/admin/social/platforms")
    x = next(p for p in resp.json() if p["platform"] == "x")
    assert x["prompt_template"] == custom_prompt


@pytest.mark.xfail(reason="Social platform API not yet implemented — Sprint 1")
async def test_update_hashtag_bank(admin_client: AsyncClient):
    """PATCH updates the hashtag bank for a platform."""
    resp = await admin_client.patch("/api/admin/social/platforms/instagram", json={
        "hashtag_bank": "#indigenous\n#streetwear\n#nativefashion",
    })
    assert resp.status_code == 200

    resp = await admin_client.get("/api/admin/social/platforms")
    ig = next(p for p in resp.json() if p["platform"] == "instagram")
    assert "#indigenous" in ig["hashtag_bank"]


@pytest.mark.xfail(reason="Social platform API not yet implemented — Sprint 1")
async def test_setup_notes_visible_for_unconfigured_platform(admin_client: AsyncClient):
    """Setup notes are returned for platforms that require configuration or app review."""
    resp = await admin_client.get("/api/admin/social/platforms")
    tiktok = next(p for p in resp.json() if p["platform"] == "tiktok")
    assert tiktok["setup_status"] == "not_configured"
    assert tiktok["setup_notes"] is not None
    assert len(tiktok["setup_notes"]) > 0


@pytest.mark.xfail(reason="Social platform API not yet implemented — Sprint 1")
async def test_platforms_require_auth(client: AsyncClient):
    """Platform config endpoints reject unauthenticated requests."""
    assert (await client.get("/api/admin/social/platforms")).status_code == 401
    assert (await client.patch("/api/admin/social/platforms/facebook", json={})).status_code == 401


@pytest.mark.xfail(reason="Social platform API not yet implemented — Sprint 1")
async def test_auto_publish_toggle(admin_client: AsyncClient):
    """auto_publish can be toggled per platform."""
    await admin_client.patch("/api/admin/social/platforms/facebook", json={
        "enabled": True,
        "auto_publish": True,
    })
    resp = await admin_client.get("/api/admin/social/platforms")
    fb = next(p for p in resp.json() if p["platform"] == "facebook")
    assert fb["auto_publish"] is True

    await admin_client.patch("/api/admin/social/platforms/facebook", json={"auto_publish": False})
    resp = await admin_client.get("/api/admin/social/platforms")
    fb = next(p for p in resp.json() if p["platform"] == "facebook")
    assert fb["auto_publish"] is False
