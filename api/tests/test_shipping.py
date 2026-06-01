"""Shipping rate endpoint tests."""
from unittest.mock import patch, AsyncMock

import pytest
from httpx import AsyncClient

from app.services.canadapost_service import ShippingRate


@pytest.mark.asyncio
async def test_shipping_rates_flat_rate_fallback(client: AsyncClient):
    """When Canada Post is not configured, returns flat rate."""
    resp = await client.get("/api/shipping/rates?postal_code=M5V1A1&subtotal_cents=5000")
    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "flat_rate"
    assert len(data["rates"]) == 1
    assert data["rates"][0]["service_code"] == "FLAT"
    assert data["rates"][0]["price_cents"] == 1200  # default flat rate


@pytest.mark.asyncio
async def test_shipping_rates_free_shipping(client: AsyncClient):
    """When subtotal meets threshold, returns free shipping."""
    resp = await client.get("/api/shipping/rates?postal_code=M5V1A1&subtotal_cents=20000")
    assert resp.status_code == 200
    data = resp.json()
    assert data["rates"][0]["service_code"] == "FREE"
    assert data["rates"][0]["price_cents"] == 0


@pytest.mark.asyncio
async def test_shipping_rates_canadapost_configured(client: AsyncClient):
    """When Canada Post is configured and returns rates, use them."""
    mock_rates = [
        ShippingRate(service_code="DOM.RP", service_name="Regular Parcel", price_cents=1450, expected_transit_days=5),
        ShippingRate(service_code="DOM.EP", service_name="Expedited Parcel", price_cents=1890, expected_transit_days=3),
    ]

    with patch("app.routes.shipping.is_configured", return_value=True):
        with patch("app.routes.shipping.get_shipping_rates", new_callable=AsyncMock, return_value=mock_rates):
            resp = await client.get("/api/shipping/rates?postal_code=K1A0B1&subtotal_cents=5000")

    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "canadapost"
    assert len(data["rates"]) == 2
    assert data["rates"][0]["service_code"] == "DOM.RP"
    assert data["rates"][0]["price_cents"] == 1450
    assert data["rates"][0]["expected_transit_days"] == 5
    assert data["rates"][1]["service_code"] == "DOM.EP"


@pytest.mark.asyncio
async def test_shipping_rates_canadapost_failure_falls_back(client: AsyncClient):
    """When Canada Post API returns empty (failure), fall back to flat rate."""
    with patch("app.routes.shipping.is_configured", return_value=True):
        with patch("app.routes.shipping.get_shipping_rates", new_callable=AsyncMock, return_value=[]):
            resp = await client.get("/api/shipping/rates?postal_code=K1A0B1&subtotal_cents=5000")

    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "flat_rate"
    assert data["rates"][0]["service_code"] == "FLAT"


@pytest.mark.asyncio
async def test_shipping_rates_invalid_postal_code(client: AsyncClient):
    """Short postal codes are rejected by validation."""
    resp = await client.get("/api/shipping/rates?postal_code=AB&subtotal_cents=5000")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_checkout_uses_canadapost_rate(admin_client: AsyncClient):
    """Verify checkout uses Canada Post rate when configured."""
    # Create product
    resp = await admin_client.post("/api/admin/products", json={"name": "Ship Tee", "slug": "ship-tee"})
    pid = resp.json()["id"]
    resp2 = await admin_client.post(f"/api/admin/products/{pid}/variants", json={
        "size": "M", "color": "Black", "price_cents": 5000, "stock_quantity": 10,
    })
    vid = resp2.json()["id"]

    # Mock Canada Post to return 1899 cents
    with patch("app.services.canadapost_service.get_shipping_rates", new_callable=AsyncMock, return_value=[ShippingRate(service_code='DOM.RP', service_name='Regular', price_cents=1899)]):
        with patch("app.services.stripe_service.stripe") as ms:
            mock_session = type("S", (), {"url": "https://stripe.com/test", "id": "cs_test_ship"})()
            ms.checkout.Session.create.return_value = mock_session
            with patch("app.services.email_service.resend"):
                resp = await admin_client.post("/api/checkout", json={
                    "customer_name": "Ship Test",
                    "customer_email": "ship@test.com",
                    "shipping_address": {
                        "line1": "123 Main", "city": "Ottawa",
                        "province": "ON", "postal_code": "K1A0B1", "country": "CA",
                    },
                    "items": [{"variant_id": vid, "quantity": 1}],
                })

    assert resp.status_code == 201
    # Verify the order was created with Canada Post rate
    import os
    from app.database import get_db
    db_path = os.environ["DATABASE_PATH"]
    async for db in get_db():
        pass
        cursor = await db.execute(
            "SELECT shipping_cents FROM orders WHERE order_number = ?",
            (resp.json()["order_number"],),
        )
        row = await cursor.fetchone()
        assert row["shipping_cents"] == 1899


@pytest.mark.asyncio
async def test_checkout_falls_back_to_flat_rate(admin_client: AsyncClient):
    """When Canada Post returns None, checkout uses flat rate."""
    resp = await admin_client.post("/api/admin/products", json={"name": "Flat Tee", "slug": "flat-tee"})
    pid = resp.json()["id"]
    resp2 = await admin_client.post(f"/api/admin/products/{pid}/variants", json={
        "size": "L", "color": "White", "price_cents": 4000, "stock_quantity": 10,
    })
    vid = resp2.json()["id"]

    # Mock Canada Post returning empty (not configured or API failure)
    with patch("app.services.canadapost_service.get_shipping_rates", new_callable=AsyncMock, return_value=[]):
        with patch("app.services.stripe_service.stripe") as ms:
            mock_session = type("S", (), {"url": "https://stripe.com/test", "id": "cs_test_flat"})()
            ms.checkout.Session.create.return_value = mock_session
            with patch("app.services.email_service.resend"):
                resp = await admin_client.post("/api/checkout", json={
                    "customer_name": "Flat Test",
                    "customer_email": "flat@test.com",
                    "shipping_address": {
                        "line1": "456 Oak", "city": "Toronto",
                        "province": "ON", "postal_code": "M5V1A1", "country": "CA",
                    },
                    "items": [{"variant_id": vid, "quantity": 1}],
                })

    assert resp.status_code == 201
    import os
    from app.database import get_db
    db_path = os.environ["DATABASE_PATH"]
    async for db in get_db():
        pass
        cursor = await db.execute(
            "SELECT shipping_cents FROM orders WHERE order_number = ?",
            (resp.json()["order_number"],),
        )
        row = await cursor.fetchone()
        assert row["shipping_cents"] == 1200  # flat rate default
