"""Admin reports tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_sales_report(admin_client: AsyncClient):
    resp = await admin_client.get("/api/admin/reports/sales?from_date=2020-01-01&to_date=2030-12-31")
    assert resp.status_code == 200
    data = resp.json()
    assert "order_count" in data
    assert "gross_revenue_cents" in data
    assert "net_revenue_cents" in data
    assert "refund_count" in data
    assert "unique_customers" in data
    assert "repeat_customers" in data
    assert "repeat_customer_rate" in data
    assert "daily" in data
    assert "top_products" in data
    assert "utm_attribution" in data


@pytest.mark.asyncio
async def test_reports_require_auth(client: AsyncClient):
    assert (await client.get("/api/admin/reports/sales?from_date=2020-01-01&to_date=2030-12-31")).status_code == 401
