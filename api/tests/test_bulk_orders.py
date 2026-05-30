"""Bulk order actions tests."""
import pytest
from httpx import AsyncClient


async def _create_orders(admin_client: AsyncClient, count: int = 3) -> list[int]:
    """Create test orders via raw DB insert."""
    from app.database import get_db
    ids = []
    async for db in get_db():
        for i in range(count):
            cursor = await db.execute(f"""
                INSERT INTO orders (order_number, customer_name, customer_email, status, payment_status,
                                   subtotal_cents, total_cents, shipping_address_line1, shipping_address_city,
                                   shipping_address_province, shipping_address_postal)
                VALUES ('ORD-BULK-{i}', 'Bulk Test {i}', 'bulk{i}@test.com', 'pending', 'confirmed',
                        5000, 5000, '1 Main', 'Toronto', 'ON', 'M5V1A1')
            """)
            ids.append(cursor.lastrowid)
        await db.commit()
        break
    return ids


@pytest.mark.asyncio
async def test_bulk_update_status(admin_client: AsyncClient):
    ids = await _create_orders(admin_client)

    resp = await admin_client.post("/api/admin/orders/bulk/update-status", json={
        "order_ids": ids, "status": "processing",
    })
    assert resp.status_code == 200
    assert resp.json()["updated"] == len(ids)
    assert resp.json()["new_status"] == "processing"


@pytest.mark.asyncio
async def test_bulk_export_csv(admin_client: AsyncClient):
    await _create_orders(admin_client)

    resp = await admin_client.post("/api/admin/orders/bulk/export", json={"status": "pending"})
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "Order #" in resp.text


@pytest.mark.asyncio
async def test_bulk_export_by_ids(admin_client: AsyncClient):
    ids = await _create_orders(admin_client, 2)

    resp = await admin_client.post("/api/admin/orders/bulk/export", json={"order_ids": ids})
    assert resp.status_code == 200
    lines = resp.text.strip().split("\n")
    assert len(lines) >= 3  # header + 2 orders


@pytest.mark.asyncio
async def test_bulk_requires_auth(client: AsyncClient):
    assert (await client.post("/api/admin/orders/bulk/update-status", json={"order_ids": [1], "status": "x"})).status_code == 401
