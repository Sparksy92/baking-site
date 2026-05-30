"""Outbound webhook management tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_webhook(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/webhooks", json={
        "url": "https://example.com/hook", "events": "order.completed,customer.created",
    })
    assert resp.status_code == 201
    assert resp.json()["id"] > 0


@pytest.mark.asyncio
async def test_list_webhooks(admin_client: AsyncClient):
    await admin_client.post("/api/admin/webhooks", json={
        "url": "https://example.com/list", "events": "order.created",
    })
    resp = await admin_client.get("/api/admin/webhooks")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_invalid_events_rejected(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/webhooks", json={
        "url": "https://example.com/bad", "events": "fake.event",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_update_webhook(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/webhooks", json={
        "url": "https://example.com/update", "events": "order.completed",
    })
    wid = resp.json()["id"]
    resp = await admin_client.patch(f"/api/admin/webhooks/{wid}", json={"is_active": False})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_delete_webhook(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/webhooks", json={
        "url": "https://example.com/delete", "events": "order.cancelled",
    })
    wid = resp.json()["id"]
    resp = await admin_client.delete(f"/api/admin/webhooks/{wid}")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_list_deliveries(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/webhooks", json={
        "url": "https://example.com/deliveries", "events": "order.completed",
    })
    wid = resp.json()["id"]
    resp = await admin_client.get(f"/api/admin/webhooks/{wid}/deliveries")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_webhooks_require_auth(client: AsyncClient):
    assert (await client.get("/api/admin/webhooks")).status_code == 401
