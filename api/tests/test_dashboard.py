"""Admin dashboard stats endpoint tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_dashboard_stats_empty(admin_client: AsyncClient):
    """Dashboard returns stats structure even with no data."""
    resp = await admin_client.get("/api/admin/dashboard/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_orders"] == 0
    assert data["total_revenue_cents"] == 0
    assert data["pending_orders"] == 0
    assert data["processing_orders"] == 0
    assert data["shipped_orders"] == 0
    assert data["monthly_revenue_cents"] == 0
    assert data["weekly_revenue_cents"] == 0
    assert data["top_products"] == []
    assert data["low_stock"] == []
    assert data["customer_count"] == 0
    assert data["subscriber_count"] == 0


@pytest.mark.asyncio
async def test_dashboard_stats_with_data(admin_client: AsyncClient):
    """Dashboard counts products, orders, stock correctly."""
    # Create a product with a low-stock variant
    resp = await admin_client.post("/api/admin/products", json={"name": "Dash Tee", "slug": "dash-tee"})
    pid = resp.json()["id"]
    await admin_client.post(f"/api/admin/products/{pid}/variants", json={
        "size": "M", "color": "Black", "price_cents": 4500, "stock_quantity": 3,
    })

    resp = await admin_client.get("/api/admin/dashboard/stats")
    data = resp.json()
    # Low stock should show the variant (stock <= 5)
    assert len(data["low_stock"]) >= 1
    found = any(v["product_name"] == "Dash Tee" and v["stock_quantity"] == 3 for v in data["low_stock"])
    assert found


@pytest.mark.asyncio
async def test_dashboard_requires_auth(client: AsyncClient):
    resp = await client.get("/api/admin/dashboard/stats")
    assert resp.status_code == 401
