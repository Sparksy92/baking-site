"""Packing slip / invoice tests."""
import pytest
from httpx import AsyncClient


async def _create_order_for_slip(admin_client: AsyncClient) -> int:
    """Create a test order with items."""
    resp = await admin_client.post("/api/admin/products", json={"name": "Slip Tee", "slug": "slip-tee"})
    pid = resp.json()["id"]
    resp = await admin_client.post(f"/api/admin/products/{pid}/variants", json={
        "size": "M", "color": "Black", "price_cents": 4500, "stock_quantity": 10,
    })
    vid = resp.json()["id"]

    from app.database import db_connection
    async with db_connection() as db:
        cursor = await db.execute("""
            INSERT INTO orders (order_number, customer_name, customer_email, status, payment_status,
                               subtotal_cents, shipping_cents, discount_cents, total_cents,
                               shipping_address_line1, shipping_address_city, shipping_address_province, shipping_address_postal)
            VALUES ('ORD-SLIP-1', 'Print Test', 'print@test.com', 'processing', 'confirmed',
                    4500, 1000, 0, 5500, '42 Elm St', 'Montreal', 'QC', 'H2X1Y4')
        """)
        order_id = cursor.lastrowid
        await db.execute(
            "INSERT INTO order_items (order_id, variant_id, product_name, variant_size, variant_color, quantity, unit_price_cents, line_total_cents) VALUES (?, ?, 'Slip Tee', 'M', 'Black', 1, 4500, 4500)",
            (order_id, vid),
        )
    return order_id


@pytest.mark.asyncio
async def test_packing_slip_html(admin_client: AsyncClient):
    order_id = await _create_order_for_slip(admin_client)
    resp = await admin_client.get(f"/api/admin/orders/{order_id}/packing-slip")
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    assert "PACKING SLIP" in resp.text
    assert "Slip Tee" in resp.text
    assert "42 Elm St" in resp.text


@pytest.mark.asyncio
async def test_invoice_html(admin_client: AsyncClient):
    order_id = await _create_order_for_slip(admin_client)
    resp = await admin_client.get(f"/api/admin/orders/{order_id}/invoice")
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    assert "INVOICE" in resp.text
    assert "$45.00" in resp.text
    assert "print@test.com" in resp.text


@pytest.mark.asyncio
async def test_slip_not_found(admin_client: AsyncClient):
    resp = await admin_client.get("/api/admin/orders/99999/packing-slip")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_slip_requires_auth(client: AsyncClient):
    assert (await client.get("/api/admin/orders/1/packing-slip")).status_code == 401
    assert (await client.get("/api/admin/orders/1/invoice")).status_code == 401
