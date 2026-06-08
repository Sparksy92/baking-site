"""Order editing tests."""
import pytest
from httpx import AsyncClient


async def _create_order(admin_client: AsyncClient) -> tuple[int, int, int]:
    """Create product + order. Returns (order_id, item_id, variant_id)."""
    resp = await admin_client.post("/api/admin/products", json={"name": "Edit Tee", "slug": "edit-tee"})
    pid = resp.json()["id"]
    resp = await admin_client.post(f"/api/admin/products/{pid}/variants", json={
        "size": "M", "color": "Red", "price_cents": 3000, "stock_quantity": 20,
    })
    vid = resp.json()["id"]

    from app.database import db_connection
    async with db_connection() as db:
        cursor = await db.execute("""
            INSERT INTO orders (order_number, customer_name, customer_email, status, payment_status,
                               subtotal_cents, total_cents, shipping_cents, discount_cents,
                               shipping_address_line1, shipping_address_city, shipping_address_province, shipping_address_postal)
            VALUES ('ORD-EDIT-1', 'Editor', 'editor@test.com', 'pending', 'confirmed',
                    6000, 6000, 0, 0, '1 Main', 'Ottawa', 'ON', 'K1A0A6')
        """)
        order_id = cursor.lastrowid
        cursor = await db.execute(
            "INSERT INTO order_items (order_id, variant_id, product_name, variant_size, variant_color, quantity, unit_price_cents, line_total_cents) VALUES (?, ?, 'Edit Tee', 'M', 'Red', 2, 3000, 6000)",
            (order_id, vid),
        )
        item_id = cursor.lastrowid

    return order_id, item_id, vid


@pytest.mark.asyncio
async def test_edit_order_item_quantity(admin_client: AsyncClient):
    order_id, item_id, _ = await _create_order(admin_client)

    resp = await admin_client.patch(f"/api/admin/orders/{order_id}/items/{item_id}", json={"quantity": 1})
    assert resp.status_code == 200
    assert resp.json()["new_total_cents"] == 3000


@pytest.mark.asyncio
async def test_remove_order_item(admin_client: AsyncClient):
    order_id, item_id, _ = await _create_order(admin_client)

    resp = await admin_client.patch(f"/api/admin/orders/{order_id}/items/{item_id}", json={"quantity": 0})
    assert resp.status_code == 200
    assert resp.json()["new_total_cents"] == 0


@pytest.mark.asyncio
async def test_add_item_to_order(admin_client: AsyncClient):
    order_id, _, vid = await _create_order(admin_client)

    resp = await admin_client.post(f"/api/admin/orders/{order_id}/items", json={
        "variant_id": vid, "quantity": 1,
    })
    assert resp.status_code == 201
    assert resp.json()["new_total_cents"] == 9000  # 6000 + 3000


@pytest.mark.asyncio
async def test_edit_shipped_order_rejected(admin_client: AsyncClient):
    order_id, item_id, _ = await _create_order(admin_client)

    # Change status to shipped
    from app.database import db_connection
    async with db_connection() as db:
        await db.execute("UPDATE orders SET status = 'shipped' WHERE id = ?", (order_id,))

    resp = await admin_client.patch(f"/api/admin/orders/{order_id}/items/{item_id}", json={"quantity": 1})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_order_edit_requires_auth(client: AsyncClient):
    assert (await client.patch("/api/admin/orders/1/items/1", json={"quantity": 1})).status_code == 401
