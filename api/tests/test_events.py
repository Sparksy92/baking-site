"""Event tracking tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_track_product_viewed(client: AsyncClient):
    resp = await client.post("/api/events", json={
        "event_type": "product_viewed", "session_id": "sess-123", "product_id": 1,
    })
    assert resp.status_code == 202
    assert resp.json()["accepted"] is True


@pytest.mark.asyncio
async def test_track_add_to_cart(client: AsyncClient):
    resp = await client.post("/api/events", json={
        "event_type": "add_to_cart", "session_id": "sess-123", "variant_id": 1,
    })
    assert resp.status_code == 202


@pytest.mark.asyncio
async def test_reject_unknown_event(client: AsyncClient):
    resp = await client.post("/api/events", json={"event_type": "hacked"})
    assert resp.status_code == 202
    assert resp.json()["accepted"] is False


@pytest.mark.asyncio
async def test_funnel_report(admin_client: AsyncClient, client: AsyncClient):
    # Track some events
    for et in ["product_viewed", "add_to_cart", "checkout_started", "checkout_completed"]:
        await client.post("/api/events", json={"event_type": et, "session_id": "funnel-1"})

    resp = await admin_client.get("/api/admin/analytics/funnel?days=7")
    assert resp.status_code == 200
    assert resp.json()["product_viewed"] >= 1
    assert "view_to_cart_rate" in resp.json()


@pytest.mark.asyncio
async def test_admin_list_events(admin_client: AsyncClient, client: AsyncClient):
    await client.post("/api/events", json={"event_type": "page_viewed", "session_id": "list-1"})
    resp = await admin_client.get("/api/admin/analytics/events?days=1")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_analytics_require_auth(client: AsyncClient):
    assert (await client.get("/api/admin/analytics/funnel?days=7")).status_code == 401
