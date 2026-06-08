"""Partial fulfillment tests."""
import pytest
from httpx import AsyncClient


async def _create_order_with_items(admin_client: AsyncClient) -> tuple[int, list[int]]:
    """Create a product, variant, and order. Returns (order_id, [item_ids])."""
    # Create product + variant
    resp = await admin_client.post("/api/admin/products", json={"name": "Ship Tee", "slug": "ship-tee"})
    pid = resp.json()["id"]
    resp = await admin_client.post(f"/api/admin/products/{pid}/variants", json={
        "size": "M", "color": "Black", "price_cents": 4500, "stock_quantity": 20,
    })
    vid1 = resp.json()["id"]
    resp = await admin_client.post(f"/api/admin/products/{pid}/variants", json={
        "size": "L", "color": "Black", "price_cents": 4500, "stock_quantity": 20,
    })
    vid2 = resp.json()["id"]

    # Create order directly in DB via checkout-like flow
    # For test simplicity, use the admin order detail to verify (we'll insert raw)
    from app.database import db_connection
    async with db_connection() as db:
        cursor = await db.execute("""
            INSERT INTO orders (order_number, customer_name, customer_email, status, payment_status,
                               subtotal_cents, total_cents, shipping_address_line1, shipping_address_city,
                               shipping_address_province, shipping_address_postal)
            VALUES ('ORD-FULFILL-1', 'Test', 'test@test.com', 'processing', 'confirmed',
                    9000, 9000, '123 Main', 'Toronto', 'ON', 'M5V1A1')
        """)
        order_id = cursor.lastrowid
        cursor = await db.execute(
            "INSERT INTO order_items (order_id, variant_id, product_name, variant_size, variant_color, quantity, unit_price_cents, line_total_cents) VALUES (?, ?, 'Ship Tee', 'M', 'Black', 2, 4500, 9000)",
            (order_id, vid1),
        )
        item1 = cursor.lastrowid
        cursor = await db.execute(
            "INSERT INTO order_items (order_id, variant_id, product_name, variant_size, variant_color, quantity, unit_price_cents, line_total_cents) VALUES (?, ?, 'Ship Tee', 'L', 'Black', 3, 4500, 13500)",
            (order_id, vid2),
        )
        item2 = cursor.lastrowid

    return order_id, [item1, item2]


@pytest.mark.asyncio
async def test_list_fulfillments_empty(admin_client: AsyncClient):
    order_id, _ = await _create_order_with_items(admin_client)
    resp = await admin_client.get(f"/api/admin/orders/{order_id}/fulfillments")
    assert resp.status_code == 200
    data = resp.json()
    assert data["fulfillments"] == []
    assert len(data["unfulfilled_items"]) == 2


@pytest.mark.asyncio
async def test_create_partial_fulfillment(admin_client: AsyncClient):
    order_id, item_ids = await _create_order_with_items(admin_client)

    resp = await admin_client.post(f"/api/admin/orders/{order_id}/fulfillments", json={
        "items": [{"order_item_id": item_ids[0], "quantity": 1}],
        "tracking_number": "CP123456789",
        "tracking_carrier": "Canada Post",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "shipped"
    assert data["order_status"] == "partially_shipped"


@pytest.mark.asyncio
async def test_full_fulfillment(admin_client: AsyncClient):
    order_id, item_ids = await _create_order_with_items(admin_client)

    # Fulfill all items
    await admin_client.post(f"/api/admin/orders/{order_id}/fulfillments", json={
        "items": [
            {"order_item_id": item_ids[0], "quantity": 2},
            {"order_item_id": item_ids[1], "quantity": 3},
        ],
        "tracking_number": "CP999999999",
    })

    resp = await admin_client.get(f"/api/admin/orders/{order_id}/fulfillments")
    assert resp.json()["unfulfilled_items"] == []


@pytest.mark.asyncio
async def test_over_fulfill_rejected(admin_client: AsyncClient):
    order_id, item_ids = await _create_order_with_items(admin_client)

    resp = await admin_client.post(f"/api/admin/orders/{order_id}/fulfillments", json={
        "items": [{"order_item_id": item_ids[0], "quantity": 99}],
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_update_fulfillment(admin_client: AsyncClient):
    order_id, item_ids = await _create_order_with_items(admin_client)

    create_resp = await admin_client.post(f"/api/admin/orders/{order_id}/fulfillments", json={
        "items": [{"order_item_id": item_ids[0], "quantity": 1}],
    })
    fid = create_resp.json()["id"]

    resp = await admin_client.patch(f"/api/admin/orders/{order_id}/fulfillments/{fid}", json={
        "tracking_number": "NEW123", "status": "delivered",
    })
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_fulfillments_require_auth(client: AsyncClient):
    assert (await client.get("/api/admin/orders/1/fulfillments")).status_code == 401
