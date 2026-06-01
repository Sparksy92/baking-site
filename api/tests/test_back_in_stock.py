"""Back-in-stock notification tests."""
import pytest
from httpx import AsyncClient


async def _create_out_of_stock_variant(admin_client: AsyncClient) -> tuple[int, int]:
    """Create product + variant with 0 stock. Returns (product_id, variant_id)."""
    resp = await admin_client.post("/api/admin/products", json={"name": "OOS Tee", "slug": "oos-tee"})
    pid = resp.json()["id"]
    resp = await admin_client.post(f"/api/admin/products/{pid}/variants", json={
        "size": "M", "color": "Black", "price_cents": 4500, "stock_quantity": 0,
    })
    vid = resp.json()["id"]
    return pid, vid


@pytest.mark.asyncio
async def test_subscribe_back_in_stock(admin_client: AsyncClient, client: AsyncClient):
    _, vid = await _create_out_of_stock_variant(admin_client)
    resp = await client.post("/api/notifications/back-in-stock", json={
        "email": "notify@test.com", "variant_id": vid,
    })
    assert resp.status_code == 201
    assert resp.json()["subscribed"] is True


@pytest.mark.asyncio
async def test_subscribe_idempotent(admin_client: AsyncClient, client: AsyncClient):
    _, vid = await _create_out_of_stock_variant(admin_client)
    await client.post("/api/notifications/back-in-stock", json={"email": "dup@test.com", "variant_id": vid})
    resp = await client.post("/api/notifications/back-in-stock", json={"email": "dup@test.com", "variant_id": vid})
    assert resp.status_code == 201  # Idempotent, no error


@pytest.mark.asyncio
async def test_subscribe_in_stock_rejected(admin_client: AsyncClient, client: AsyncClient):
    resp = await admin_client.post("/api/admin/products", json={"name": "In Stock", "slug": "in-stock-bis"})
    pid = resp.json()["id"]
    resp = await admin_client.post(f"/api/admin/products/{pid}/variants", json={
        "size": "L", "color": "Blue", "price_cents": 3000, "stock_quantity": 10,
    })
    vid = resp.json()["id"]

    resp = await client.post("/api/notifications/back-in-stock", json={"email": "x@test.com", "variant_id": vid})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_subscribe_nonexistent_variant(client: AsyncClient):
    resp = await client.post("/api/notifications/back-in-stock", json={"email": "x@test.com", "variant_id": 99999})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_check_subscription(admin_client: AsyncClient, client: AsyncClient):
    _, vid = await _create_out_of_stock_variant(admin_client)
    await client.post("/api/notifications/back-in-stock", json={"email": "check@test.com", "variant_id": vid})

    resp = await client.get(f"/api/notifications/back-in-stock/{vid}?email=check@test.com")
    assert resp.status_code == 200
    assert resp.json()["subscribed"] is True

    resp = await client.get(f"/api/notifications/back-in-stock/{vid}?email=other@test.com")
    assert resp.json()["subscribed"] is False
