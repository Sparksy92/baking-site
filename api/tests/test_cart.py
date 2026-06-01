"""Server-side cart tests."""
import pytest
from httpx import AsyncClient


async def _create_variant(admin_client: AsyncClient) -> int:
    resp = await admin_client.post("/api/admin/products", json={"name": "Cart Tee", "slug": "cart-tee"})
    pid = resp.json()["id"]
    resp = await admin_client.post(f"/api/admin/products/{pid}/variants", json={
        "size": "M", "color": "Black", "price_cents": 4500, "stock_quantity": 10,
    })
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_get_empty_cart(client: AsyncClient):
    resp = await client.get("/api/cart")
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["item_count"] == 0
    assert data["subtotal_cents"] == 0
    assert "cart_token" in data


@pytest.mark.asyncio
async def test_add_to_cart(admin_client: AsyncClient, client: AsyncClient):
    vid = await _create_variant(admin_client)
    resp = await client.post("/api/cart/items", json={"variant_id": vid, "quantity": 2})
    assert resp.status_code == 201
    assert resp.json()["added"] is True

    # Check cart
    cart_resp = await client.get("/api/cart")
    data = cart_resp.json()
    assert data["item_count"] == 2
    assert data["subtotal_cents"] == 9000
    assert len(data["items"]) == 1
    assert data["items"][0]["variant_id"] == vid


@pytest.mark.asyncio
async def test_add_same_variant_increments(admin_client: AsyncClient, client: AsyncClient):
    vid = await _create_variant(admin_client)
    await client.post("/api/cart/items", json={"variant_id": vid, "quantity": 1})
    await client.post("/api/cart/items", json={"variant_id": vid, "quantity": 3})

    cart = await client.get("/api/cart")
    assert cart.json()["item_count"] == 4


@pytest.mark.asyncio
async def test_update_cart_item(admin_client: AsyncClient, client: AsyncClient):
    vid = await _create_variant(admin_client)
    await client.post("/api/cart/items", json={"variant_id": vid, "quantity": 5})

    # Update to 2
    resp = await client.patch(f"/api/cart/items/{vid}", json={"quantity": 2})
    assert resp.status_code == 200

    cart = await client.get("/api/cart")
    assert cart.json()["item_count"] == 2


@pytest.mark.asyncio
async def test_remove_cart_item_zero_qty(admin_client: AsyncClient, client: AsyncClient):
    vid = await _create_variant(admin_client)
    await client.post("/api/cart/items", json={"variant_id": vid, "quantity": 1})

    # Remove by setting qty to 0
    resp = await client.patch(f"/api/cart/items/{vid}", json={"quantity": 0})
    assert resp.status_code == 200

    cart = await client.get("/api/cart")
    assert cart.json()["items"] == []


@pytest.mark.asyncio
async def test_add_nonexistent_variant(client: AsyncClient):
    resp = await client.post("/api/cart/items", json={"variant_id": 99999, "quantity": 1})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_capture_email(admin_client: AsyncClient, client: AsyncClient):
    vid = await _create_variant(admin_client)
    await client.post("/api/cart/items", json={"variant_id": vid, "quantity": 1})

    resp = await client.post("/api/cart/email", json={"email": "abandon@test.com", "name": "Test User"})
    assert resp.status_code == 200
    assert resp.json()["captured"] is True


@pytest.mark.asyncio
async def test_mark_converted(client: AsyncClient):
    # Get a cart first (creates one)
    await client.get("/api/cart")
    resp = await client.post("/api/cart/convert")
    assert resp.status_code == 200
    assert resp.json()["converted"] is True


@pytest.mark.asyncio
async def test_admin_list_abandoned(admin_client: AsyncClient):
    resp = await admin_client.get("/api/admin/carts?status=abandoned")
    assert resp.status_code == 200
    assert "carts" in resp.json()
    assert "total" in resp.json()


@pytest.mark.asyncio
async def test_admin_cart_stats(admin_client: AsyncClient):
    resp = await admin_client.get("/api/admin/carts/stats")
    assert resp.status_code == 200
    assert "total_abandoned" in resp.json()
    assert "recovery_rate" in resp.json()


@pytest.mark.asyncio
async def test_admin_process_abandoned(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/carts/process-abandoned")
    assert resp.status_code == 200
    assert "sent_1h" in resp.json()


@pytest.mark.asyncio
async def test_admin_carts_require_auth(client: AsyncClient):
    assert (await client.get("/api/admin/carts")).status_code == 401
    assert (await client.post("/api/admin/carts/process-abandoned")).status_code == 401
