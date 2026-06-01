"""Admin order management tests — list, detail, status update, tracking, notes."""
from unittest.mock import patch, MagicMock

import pytest
from httpx import AsyncClient


# ── Helpers ───────────────────────────────────────────────────

async def _seed_product(admin_client: AsyncClient, slug: str = "admin-order-tee"):
    resp = await admin_client.post("/api/admin/products", json={
        "name": "Admin Order Tee", "slug": slug,
    })
    pid = resp.json()["id"]
    resp2 = await admin_client.post(f"/api/admin/products/{pid}/variants", json={
        "size": "M", "color": "Black", "price_cents": 4000, "stock_quantity": 50,
    })
    return pid, resp2.json()["id"]


def _mock_stripe():
    mock = MagicMock()
    mock.url = "https://checkout.stripe.com/pay/test"
    mock.id = "cs_test_admin_orders"
    return mock


async def _create_order(admin_client: AsyncClient, variant_id: int, email: str = "buyer@test.com"):
    with patch("app.services.stripe_service.stripe") as ms:
        ms.checkout.Session.create.return_value = _mock_stripe()
        with patch("app.services.email_service.resend"):
            resp = await admin_client.post("/api/checkout", json={
                "customer_name": "Buyer",
                "customer_email": email,
                "shipping_address": {
                    "line1": "100 Admin St", "city": "Toronto",
                    "province": "ON", "postal_code": "M5V 1A1", "country": "CA",
                },
                "items": [{"variant_id": variant_id, "quantity": 1}],
            })
    assert resp.status_code == 201
    return resp.json()["order_number"]


# ── List ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_list_orders_empty(admin_client: AsyncClient):
    resp = await admin_client.get("/api/admin/orders")
    assert resp.status_code == 200
    data = resp.json()
    assert data["orders"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_admin_list_orders(admin_client: AsyncClient):
    _, vid = await _seed_product(admin_client)
    await _create_order(admin_client, vid, "a@test.com")
    await _create_order(admin_client, vid, "b@test.com")

    resp = await admin_client.get("/api/admin/orders")
    data = resp.json()
    assert data["total"] == 2
    assert len(data["orders"]) == 2


@pytest.mark.asyncio
async def test_admin_list_orders_status_filter(admin_client: AsyncClient):
    _, vid = await _seed_product(admin_client)
    await _create_order(admin_client, vid)

    # Default status is "received"
    resp = await admin_client.get("/api/admin/orders?status=received")
    assert resp.json()["total"] == 1

    resp2 = await admin_client.get("/api/admin/orders?status=shipped")
    assert resp2.json()["total"] == 0


@pytest.mark.asyncio
async def test_admin_list_orders_pagination(admin_client: AsyncClient):
    _, vid = await _seed_product(admin_client)
    for i in range(5):
        await _create_order(admin_client, vid, f"page{i}@test.com")

    resp = await admin_client.get("/api/admin/orders?limit=2&page=1")
    data = resp.json()
    assert data["total"] == 5
    assert len(data["orders"]) == 2
    assert data["page"] == 1


@pytest.mark.asyncio
async def test_admin_list_orders_requires_auth(client: AsyncClient):
    resp = await client.get("/api/admin/orders")
    assert resp.status_code == 401


# ── Detail ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_get_order_detail(admin_client: AsyncClient):
    _, vid = await _seed_product(admin_client)
    await _create_order(admin_client, vid)

    # Get order list to find the ID
    orders = (await admin_client.get("/api/admin/orders")).json()["orders"]
    order_id = orders[0]["id"]

    resp = await admin_client.get(f"/api/admin/orders/{order_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert "order" in data
    assert "items" in data
    assert data["order"]["id"] == order_id
    assert len(data["items"]) == 1
    assert data["items"][0]["product_name"] == "Admin Order Tee"


@pytest.mark.asyncio
async def test_admin_get_order_not_found(admin_client: AsyncClient):
    resp = await admin_client.get("/api/admin/orders/9999")
    assert resp.status_code == 404


# ── Update Status ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_update_order_status(admin_client: AsyncClient):
    _, vid = await _seed_product(admin_client)
    await _create_order(admin_client, vid)
    orders = (await admin_client.get("/api/admin/orders")).json()["orders"]
    order_id = orders[0]["id"]

    resp = await admin_client.patch(f"/api/admin/orders/{order_id}", json={
        "status": "processing",
    })
    assert resp.status_code == 200
    assert resp.json()["updated"] is True

    # Verify
    detail = (await admin_client.get(f"/api/admin/orders/{order_id}")).json()
    assert detail["order"]["status"] == "processing"


@pytest.mark.asyncio
async def test_admin_update_order_tracking(admin_client: AsyncClient):
    _, vid = await _seed_product(admin_client)
    await _create_order(admin_client, vid)
    orders = (await admin_client.get("/api/admin/orders")).json()["orders"]
    order_id = orders[0]["id"]

    with patch("app.services.email_service.resend"):
        resp = await admin_client.patch(f"/api/admin/orders/{order_id}", json={
            "status": "shipped",
            "tracking_number": "CP123456789",
            "tracking_carrier": "Canada Post",
        })
    assert resp.status_code == 200

    detail = (await admin_client.get(f"/api/admin/orders/{order_id}")).json()
    assert detail["order"]["tracking_number"] == "CP123456789"
    assert detail["order"]["tracking_carrier"] == "Canada Post"
    assert detail["order"]["status"] == "shipped"


@pytest.mark.asyncio
async def test_admin_update_order_notes(admin_client: AsyncClient):
    _, vid = await _seed_product(admin_client)
    await _create_order(admin_client, vid)
    orders = (await admin_client.get("/api/admin/orders")).json()["orders"]
    order_id = orders[0]["id"]

    resp = await admin_client.patch(f"/api/admin/orders/{order_id}", json={
        "admin_notes": "Customer called to confirm address",
    })
    assert resp.status_code == 200

    detail = (await admin_client.get(f"/api/admin/orders/{order_id}")).json()
    assert detail["order"]["admin_notes"] == "Customer called to confirm address"


@pytest.mark.asyncio
async def test_admin_update_order_empty_body(admin_client: AsyncClient):
    _, vid = await _seed_product(admin_client)
    await _create_order(admin_client, vid)
    orders = (await admin_client.get("/api/admin/orders")).json()["orders"]
    order_id = orders[0]["id"]

    resp = await admin_client.patch(f"/api/admin/orders/{order_id}", json={})
    assert resp.status_code == 400
    assert "No fields" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_admin_update_order_not_found(admin_client: AsyncClient):
    resp = await admin_client.patch("/api/admin/orders/9999", json={
        "status": "shipped",
    })
    assert resp.status_code == 404
