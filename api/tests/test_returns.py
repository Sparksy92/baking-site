"""Return/exchange workflow tests."""
import pytest
from httpx import AsyncClient


async def _create_delivered_order(admin_client: AsyncClient, db) -> tuple[int, int]:
    """Create a delivered order with items. Returns (order_id, order_item_id)."""
    # Create product + variant
    resp = await admin_client.post("/api/admin/products", json={"name": "Return Tee", "slug": "return-tee"})
    pid = resp.json()["id"]
    resp = await admin_client.post(f"/api/admin/products/{pid}/variants", json={
        "size": "M", "color": "Black", "price_cents": 4500, "stock_quantity": 10,
    })
    vid = resp.json()["id"]

    # Create order directly in DB
    cursor = await db.execute("""
        INSERT INTO orders (order_number, customer_name, customer_email, status, payment_status,
                           subtotal_cents, total_cents, customer_id,
                           shipping_address_line1, shipping_address_city,
                           shipping_address_province, shipping_address_postal)
        VALUES ('ORD-RET-1', 'Return Test', 'customer@test.com', 'delivered', 'confirmed',
                4500, 4500, (SELECT id FROM customers LIMIT 1),
                '1 Main', 'Toronto', 'ON', 'M5V1A1')
    """)
    order_id = cursor.lastrowid

    cursor = await db.execute("""
        INSERT INTO order_items (order_id, product_id, variant_id, product_name,
                                variant_size, variant_color, unit_price_cents, quantity, line_total_cents)
        VALUES (?, ?, ?, 'Return Tee', 'M', 'Black', 4500, 1, 4500)
    """, (order_id, pid, vid))
    oi_id = cursor.lastrowid
    return order_id, oi_id


@pytest.mark.asyncio
async def test_customer_create_return(admin_client: AsyncClient, customer_client: AsyncClient):
    from app.database import db_connection
    async with db_connection() as db:
        order_id, oi_id = await _create_delivered_order(admin_client, db)

    resp = await customer_client.post("/api/returns", json={
        "order_id": order_id,
        "reason": "Doesn't fit",
        "resolution": "refund",
        "items": [{"order_item_id": oi_id, "quantity": 1}],
    })
    assert resp.status_code == 201
    assert resp.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_customer_list_returns(admin_client: AsyncClient, customer_client: AsyncClient):
    from app.database import db_connection
    async with db_connection() as db:
        order_id, oi_id = await _create_delivered_order(admin_client, db)
        # Use different order number
        await db.execute("UPDATE orders SET order_number = 'ORD-RET-2' WHERE id = ?", (order_id,))

    await customer_client.post("/api/returns", json={
        "order_id": order_id, "reason": "Wrong color", "items": [{"order_item_id": oi_id, "quantity": 1}],
    })
    resp = await customer_client.get("/api/returns")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_admin_list_returns(admin_client: AsyncClient):
    resp = await admin_client.get("/api/admin/returns")
    assert resp.status_code == 200
    assert "returns" in resp.json()


@pytest.mark.asyncio
async def test_admin_approve_return(admin_client: AsyncClient, customer_client: AsyncClient):
    from app.database import db_connection
    async with db_connection() as db:
        order_id, oi_id = await _create_delivered_order(admin_client, db)
        await db.execute("UPDATE orders SET order_number = 'ORD-RET-3' WHERE id = ?", (order_id,))

    resp = await customer_client.post("/api/returns", json={
        "order_id": order_id, "reason": "Defective", "items": [{"order_item_id": oi_id, "quantity": 1}],
    })
    rr_id = resp.json()["id"]

    # Approve
    resp = await admin_client.patch(f"/api/admin/returns/{rr_id}", json={"status": "approved"})
    assert resp.status_code == 200

    # Receive (should restock)
    resp = await admin_client.patch(f"/api/admin/returns/{rr_id}", json={"status": "received"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_admin_reject_return(admin_client: AsyncClient, customer_client: AsyncClient):
    from app.database import db_connection
    async with db_connection() as db:
        order_id, oi_id = await _create_delivered_order(admin_client, db)
        await db.execute("UPDATE orders SET order_number = 'ORD-RET-4' WHERE id = ?", (order_id,))

    resp = await customer_client.post("/api/returns", json={
        "order_id": order_id, "reason": "Changed mind", "items": [{"order_item_id": oi_id, "quantity": 1}],
    })
    rr_id = resp.json()["id"]

    resp = await admin_client.patch(f"/api/admin/returns/{rr_id}", json={
        "status": "rejected", "admin_notes": "Outside return window",
    })
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_invalid_transition_rejected(admin_client: AsyncClient, customer_client: AsyncClient):
    from app.database import db_connection
    async with db_connection() as db:
        order_id, oi_id = await _create_delivered_order(admin_client, db)
        await db.execute("UPDATE orders SET order_number = 'ORD-RET-5' WHERE id = ?", (order_id,))

    resp = await customer_client.post("/api/returns", json={
        "order_id": order_id, "reason": "Test", "items": [{"order_item_id": oi_id, "quantity": 1}],
    })
    rr_id = resp.json()["id"]

    # Can't go from pending → received
    resp = await admin_client.patch(f"/api/admin/returns/{rr_id}", json={"status": "received"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_returns_require_auth(client: AsyncClient):
    assert (await client.get("/api/returns")).status_code == 401
    assert (await client.get("/api/admin/returns")).status_code == 401
