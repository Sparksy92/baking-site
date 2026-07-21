"""Tests for A/B test service and admin API endpoints.

Covers: create, list, start, cancel, get results, winner selection,
auto-complete expired tests, and input validation.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient


# ── Helpers ──────────────────────────────────────────────────────────────────

VALID_VARIANTS = [
    {"variant_name": "A", "content": "Check out our new summer collection!"},
    {"variant_name": "B", "content": "Summer styles are here — shop now!"},
]


async def _create_test(admin_client: AsyncClient, **overrides) -> dict:
    payload = {
        "name": "Test Campaign",
        "platform": "instagram",
        "test_type": "headline",
        "variants": VALID_VARIANTS,
        "metric_criteria": "engagement",
        "duration_hours": 48,
        **overrides,
    }
    resp = await admin_client.post("/api/admin/social/ab-tests", json=payload)
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


# ── Create ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_ab_test_returns_test_id(admin_client: AsyncClient):
    data = await _create_test(admin_client)
    assert "test_id" in data
    assert data["test_id"] > 0
    assert data["name"] == "Test Campaign"
    assert len(data["variants"]) == 2


@pytest.mark.asyncio
async def test_create_ab_test_schedules_variants(admin_client: AsyncClient):
    data = await _create_test(admin_client)
    for v in data["variants"]:
        assert "variant_id" in v
        assert "social_post_id" in v
        assert "scheduled_at" in v


@pytest.mark.asyncio
async def test_create_ab_test_requires_two_variants(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/social/ab-tests", json={
        "name": "Bad Test",
        "platform": "instagram",
        "test_type": "headline",
        "variants": [{"variant_name": "A", "content": "Only one variant"}],
    })
    assert resp.status_code in (400, 422)


@pytest.mark.asyncio
async def test_create_ab_test_invalid_metric_rejected(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/social/ab-tests", json={
        "name": "Bad Metric",
        "platform": "instagram",
        "test_type": "headline",
        "variants": VALID_VARIANTS,
        "metric_criteria": "unicorns",
    })
    assert resp.status_code in (400, 422)


@pytest.mark.asyncio
async def test_create_ab_test_all_metric_types(admin_client: AsyncClient):
    for metric in ("engagement", "reach", "clicks", "revenue"):
        data = await _create_test(admin_client, metric_criteria=metric, name=f"Test {metric}")
        assert data["test_id"] > 0


@pytest.mark.asyncio
async def test_create_ab_test_all_test_types(admin_client: AsyncClient):
    for test_type in ("headline", "image", "cta", "time"):
        data = await _create_test(admin_client, test_type=test_type, name=f"Test {test_type}")
        assert data["test_id"] > 0


# ── List ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_ab_tests(admin_client: AsyncClient):
    await _create_test(admin_client, name="List Test 1")
    await _create_test(admin_client, name="List Test 2")
    resp = await admin_client.get("/api/admin/social/ab-tests")
    assert resp.status_code == 200
    data = resp.json()
    assert "tests" in data
    assert len(data["tests"]) >= 2


@pytest.mark.asyncio
async def test_list_ab_tests_requires_auth(client: AsyncClient):
    resp = await client.get("/api/admin/social/ab-tests")
    assert resp.status_code == 401


# ── Start ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_start_ab_test(admin_client: AsyncClient):
    data = await _create_test(admin_client)
    test_id = data["test_id"]
    resp = await admin_client.post(f"/api/admin/social/ab-tests/{test_id}/start")
    assert resp.status_code == 200
    assert resp.json()["status"] == "running"


@pytest.mark.asyncio
async def test_start_already_running_test_fails(admin_client: AsyncClient):
    data = await _create_test(admin_client)
    test_id = data["test_id"]
    await admin_client.post(f"/api/admin/social/ab-tests/{test_id}/start")
    resp = await admin_client.post(f"/api/admin/social/ab-tests/{test_id}/start")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_start_nonexistent_test_fails(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/social/ab-tests/999999/start")
    assert resp.status_code == 404


# ── Cancel ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cancel_draft_test(admin_client: AsyncClient):
    data = await _create_test(admin_client)
    test_id = data["test_id"]
    resp = await admin_client.post(f"/api/admin/social/ab-tests/{test_id}/cancel")
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_cancel_running_test(admin_client: AsyncClient):
    data = await _create_test(admin_client)
    test_id = data["test_id"]
    await admin_client.post(f"/api/admin/social/ab-tests/{test_id}/start")
    resp = await admin_client.post(f"/api/admin/social/ab-tests/{test_id}/cancel")
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_cancel_cancels_variant_posts(admin_client: AsyncClient):
    """Variant social posts should be rejected when test is cancelled."""
    data = await _create_test(admin_client)
    test_id = data["test_id"]
    post_ids = [v["social_post_id"] for v in data["variants"]]

    await admin_client.post(f"/api/admin/social/ab-tests/{test_id}/cancel")

    for post_id in post_ids:
        resp = await admin_client.get(f"/api/admin/social/outbox/{post_id}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "rejected"


@pytest.mark.asyncio
async def test_cancel_already_cancelled_fails(admin_client: AsyncClient):
    data = await _create_test(admin_client)
    test_id = data["test_id"]
    await admin_client.post(f"/api/admin/social/ab-tests/{test_id}/cancel")
    resp = await admin_client.post(f"/api/admin/social/ab-tests/{test_id}/cancel")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_cancel_nonexistent_test_fails(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/social/ab-tests/999999/cancel")
    assert resp.status_code == 404


# ── Results ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_ab_test_results(admin_client: AsyncClient):
    data = await _create_test(admin_client)
    test_id = data["test_id"]
    resp = await admin_client.get(f"/api/admin/social/ab-tests/{test_id}/results")
    assert resp.status_code == 200
    result = resp.json()
    assert "test" in result
    assert "variants" in result
    assert result["test"]["id"] == test_id
    assert len(result["variants"]) == 2


@pytest.mark.asyncio
async def test_get_results_nonexistent_test_fails(admin_client: AsyncClient):
    resp = await admin_client.get("/api/admin/social/ab-tests/999999/results")
    assert resp.status_code == 404


# ── Service-layer unit tests ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_service_create_ab_test(client):
    from app.services.ab_test_service import create_ab_test
    result = await create_ab_test(
        name="Service Test",
        platform="instagram",
        test_type="headline",
        variants=VALID_VARIANTS,
        metric_criteria="engagement",
        duration_hours=24,
    )
    assert result["test_id"] > 0
    assert len(result["variants"]) == 2
    for v in result["variants"]:
        assert v["variant_id"] > 0
        assert v["social_post_id"] > 0


@pytest.mark.asyncio
async def test_service_start_and_cancel(client):
    from app.services.ab_test_service import create_ab_test, start_ab_test, cancel_ab_test
    created = await create_ab_test(
        name="Start/Cancel Test",
        platform="facebook",
        test_type="cta",
        variants=VALID_VARIANTS,
    )
    test_id = created["test_id"]
    started = await start_ab_test(test_id)
    assert started["status"] == "running"
    cancelled = await cancel_ab_test(test_id)
    assert cancelled["status"] == "cancelled"


@pytest.mark.asyncio
async def test_service_cannot_start_cancelled_test(client):
    from app.services.ab_test_service import create_ab_test, cancel_ab_test, start_ab_test
    created = await create_ab_test(
        name="Cannot Start After Cancel",
        platform="linkedin",
        test_type="image",
        variants=VALID_VARIANTS,
    )
    test_id = created["test_id"]
    await cancel_ab_test(test_id)
    with pytest.raises(ValueError):
        await start_ab_test(test_id)


@pytest.mark.asyncio
async def test_service_complete_ab_test(client):
    from app.services.ab_test_service import create_ab_test, start_ab_test, complete_ab_test
    created = await create_ab_test(
        name="Complete Test",
        platform="instagram",
        test_type="headline",
        variants=VALID_VARIANTS,
    )
    test_id = created["test_id"]
    await start_ab_test(test_id)
    result = await complete_ab_test(test_id)
    assert result["status"] == "completed"
    assert "winner" in result
    assert "results" in result
    assert len(result["results"]) == 2


@pytest.mark.asyncio
async def test_service_auto_complete_finds_expired(client):
    """auto_complete_expired_tests should not crash even with no expired tests."""
    from app.services.ab_test_service import auto_complete_expired_tests
    count = await auto_complete_expired_tests()
    assert isinstance(count, int)
    assert count >= 0
