"""Wishlist endpoint tests."""
import pytest
from httpx import AsyncClient


async def _create_product(admin_client: AsyncClient) -> int:
    resp = await admin_client.post("/api/admin/products", json={"name": "Wish Tee", "slug": "wish-tee"})
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_wishlist_empty(customer_client: AsyncClient):
    resp = await customer_client.get("/api/customers/me/wishlist")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_add_to_wishlist(admin_client: AsyncClient, customer_client: AsyncClient):
    pid = await _create_product(admin_client)
    resp = await customer_client.post(f"/api/customers/me/wishlist/{pid}")
    assert resp.status_code == 201
    assert resp.json()["added"] is True

    # Verify in list
    items = await customer_client.get("/api/customers/me/wishlist")
    assert len(items.json()) == 1
    assert items.json()[0]["product_id"] == pid


@pytest.mark.asyncio
async def test_add_duplicate_idempotent(admin_client: AsyncClient, customer_client: AsyncClient):
    pid = await _create_product(admin_client)
    await customer_client.post(f"/api/customers/me/wishlist/{pid}")
    resp = await customer_client.post(f"/api/customers/me/wishlist/{pid}")
    assert resp.status_code == 201  # Idempotent


@pytest.mark.asyncio
async def test_add_nonexistent_product(customer_client: AsyncClient):
    resp = await customer_client.post("/api/customers/me/wishlist/9999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_remove_from_wishlist(admin_client: AsyncClient, customer_client: AsyncClient):
    pid = await _create_product(admin_client)
    await customer_client.post(f"/api/customers/me/wishlist/{pid}")
    resp = await customer_client.delete(f"/api/customers/me/wishlist/{pid}")
    assert resp.status_code == 200
    assert resp.json()["removed"] is True

    items = await customer_client.get("/api/customers/me/wishlist")
    assert len(items.json()) == 0


@pytest.mark.asyncio
async def test_wishlist_requires_auth(client: AsyncClient):
    assert (await client.get("/api/customers/me/wishlist")).status_code == 401
    assert (await client.post("/api/customers/me/wishlist/1")).status_code == 401
    assert (await client.delete("/api/customers/me/wishlist/1")).status_code == 401
