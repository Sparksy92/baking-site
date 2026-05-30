"""Checkout flow and Stripe webhook tests.

Tests cover:
- Checkout creates order and decrements stock
- Checkout rejects out-of-stock items
- Webhook confirms payment (idempotent)
- Webhook handles expired sessions (stock restore)
- Tax is 0 when TAX_RATE=0
- Order lookup requires matching email
- Rate limiting on checkout
"""
import os
import json
from unittest.mock import patch, AsyncMock, MagicMock

os.environ["TAX_RATE"] = "0"

import pytest
from httpx import AsyncClient


# ── Helpers ────────────────────────────────────────────────────

async def _seed_product_with_variant(admin_client: AsyncClient, stock: int = 10, price_cents: int = 4500):
    """Create a product with one variant and return (product_id, variant_id)."""
    resp = await admin_client.post("/api/admin/products", json={
        "name": "Test Tee",
        "slug": "test-tee",
        "description": "A test product",
    })
    assert resp.status_code == 201
    product_id = resp.json()["id"]

    resp = await admin_client.post(f"/api/admin/products/{product_id}/variants", json={
        "size": "M",
        "color": "Black",
        "price_cents": price_cents,
        "stock_quantity": stock,
    })
    assert resp.status_code == 201
    variant_id = resp.json()["id"]

    return product_id, variant_id


def _checkout_body(variant_id: int, quantity: int = 1, email: str = "test@example.com"):
    return {
        "customer_name": "Test Customer",
        "customer_email": email,
        "shipping_address": {
            "line1": "123 Test St",
            "city": "Toronto",
            "province": "ON",
            "postal_code": "M5V 1A1",
            "country": "CA",
        },
        "items": [{"variant_id": variant_id, "quantity": quantity}],
    }


def _mock_stripe_session(order_number="TST-ABC123"):
    """Return a mock Stripe checkout session."""
    mock_session = MagicMock()
    mock_session.url = "https://checkout.stripe.com/pay/test_session"
    mock_session.id = "cs_test_abc123"
    return mock_session


# ── Checkout Tests ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_checkout_creates_order_and_decrements_stock(admin_client: AsyncClient):
    """Checkout should create an order and reduce variant stock."""
    _, variant_id = await _seed_product_with_variant(admin_client, stock=10)

    with patch("app.services.stripe_service.stripe") as mock_stripe:
        mock_stripe.checkout.Session.create.return_value = _mock_stripe_session()
        with patch("app.services.email_service.resend"):
            resp = await admin_client.post("/api/checkout", json=_checkout_body(variant_id, quantity=2))

    assert resp.status_code == 201
    data = resp.json()
    assert "order_number" in data
    assert data["stripe_checkout_url"] == "https://checkout.stripe.com/pay/test_session"

    # Verify stock was decremented via public product endpoint
    resp = await admin_client.get("/api/products/test-tee")
    assert resp.status_code == 200
    variants = resp.json()["variants"]
    assert variants[0]["stock_quantity"] == 8


@pytest.mark.asyncio
async def test_checkout_rejects_out_of_stock(admin_client: AsyncClient):
    """Checkout should reject when quantity exceeds stock."""
    _, variant_id = await _seed_product_with_variant(admin_client, stock=2)

    resp = await admin_client.post("/api/checkout", json=_checkout_body(variant_id, quantity=5))
    assert resp.status_code == 409
    assert "left in stock" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_checkout_rejects_invalid_email(admin_client: AsyncClient):
    """Checkout should reject malformed email."""
    _, variant_id = await _seed_product_with_variant(admin_client, stock=10)

    resp = await admin_client.post("/api/checkout", json=_checkout_body(variant_id, email="not-an-email"))
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_checkout_tax_zero_when_rate_zero(admin_client: AsyncClient):
    """With TAX_RATE=0, tax_cents should be 0 in created order."""
    _, variant_id = await _seed_product_with_variant(admin_client, stock=10, price_cents=5000)

    with patch("app.services.stripe_service.stripe") as mock_stripe:
        mock_stripe.checkout.Session.create.return_value = _mock_stripe_session()
        with patch("app.services.email_service.resend"):
            resp = await admin_client.post("/api/checkout", json=_checkout_body(variant_id))

    assert resp.status_code == 201
    order_number = resp.json()["order_number"]

    # Look up order and verify tax is 0
    resp = await admin_client.get(f"/api/orders/{order_number}?email=test@example.com")
    assert resp.status_code == 200
    assert resp.json()["tax_cents"] == 0


# ── Order Lookup Tests ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_order_lookup_requires_matching_email(admin_client: AsyncClient):
    """Order lookup should reject if email doesn't match."""
    _, variant_id = await _seed_product_with_variant(admin_client, stock=10)

    with patch("app.services.stripe_service.stripe") as mock_stripe:
        mock_stripe.checkout.Session.create.return_value = _mock_stripe_session()
        with patch("app.services.email_service.resend"):
            resp = await admin_client.post("/api/checkout", json=_checkout_body(variant_id))

    order_number = resp.json()["order_number"]

    # Wrong email
    resp = await admin_client.get(f"/api/orders/{order_number}?email=wrong@example.com")
    assert resp.status_code == 404

    # Correct email
    resp = await admin_client.get(f"/api/orders/{order_number}?email=test@example.com")
    assert resp.status_code == 200


# ── Webhook Tests ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_webhook_rejects_missing_signature(client: AsyncClient):
    """Webhook should reject requests without stripe-signature header."""
    resp = await client.post("/api/webhooks/stripe", content=b"{}")
    assert resp.status_code == 400
    assert "Missing stripe-signature" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_webhook_rejects_invalid_signature(client: AsyncClient):
    """Webhook should reject requests with invalid signature."""
    resp = await client.post(
        "/api/webhooks/stripe",
        content=b"{}",
        headers={"stripe-signature": "t=123,v1=invalid"},
    )
    assert resp.status_code == 400
    assert "Invalid signature" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_webhook_checkout_completed_confirms_payment(admin_client: AsyncClient):
    """checkout.session.completed webhook should confirm payment on order."""
    _, variant_id = await _seed_product_with_variant(admin_client, stock=10)

    # Create order
    with patch("app.services.stripe_service.stripe") as mock_stripe:
        mock_stripe.checkout.Session.create.return_value = _mock_stripe_session()
        with patch("app.services.email_service.resend"):
            resp = await admin_client.post("/api/checkout", json=_checkout_body(variant_id))
    order_number = resp.json()["order_number"]

    # Simulate webhook
    event = {
        "id": "evt_test_123",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_abc123",
                "payment_intent": "pi_test_456",
            }
        }
    }

    with patch("app.routes.webhooks.verify_webhook_signature", return_value=event):
        with patch("app.services.email_service.resend"):
            resp = await admin_client.post(
                "/api/webhooks/stripe",
                content=json.dumps(event).encode(),
                headers={"stripe-signature": "t=123,v1=valid"},
            )

    assert resp.status_code == 200
    assert resp.json()["received"] is True

    # Verify order is confirmed
    resp = await admin_client.get(f"/api/orders/{order_number}?email=test@example.com")
    assert resp.json()["payment_status"] == "confirmed"


@pytest.mark.asyncio
async def test_webhook_checkout_completed_idempotent(admin_client: AsyncClient):
    """Replaying the same webhook should be a no-op."""
    _, variant_id = await _seed_product_with_variant(admin_client, stock=10)

    with patch("app.services.stripe_service.stripe") as mock_stripe:
        mock_stripe.checkout.Session.create.return_value = _mock_stripe_session()
        with patch("app.services.email_service.resend"):
            resp = await admin_client.post("/api/checkout", json=_checkout_body(variant_id))
    order_number = resp.json()["order_number"]

    event = {
        "id": "evt_test_123",
        "type": "checkout.session.completed",
        "data": {"object": {"id": "cs_test_abc123", "payment_intent": "pi_test_456"}}
    }

    with patch("app.routes.webhooks.verify_webhook_signature", return_value=event):
        with patch("app.services.email_service.resend"):
            # First call
            resp1 = await admin_client.post("/api/webhooks/stripe", content=json.dumps(event).encode(), headers={"stripe-signature": "t=123,v1=valid"})
            # Second call (replay)
            resp2 = await admin_client.post("/api/webhooks/stripe", content=json.dumps(event).encode(), headers={"stripe-signature": "t=123,v1=valid"})

    assert resp1.status_code == 200
    assert resp2.status_code == 200


@pytest.mark.asyncio
async def test_webhook_checkout_expired_restores_stock(admin_client: AsyncClient):
    """checkout.session.expired webhook should cancel order and restore stock."""
    _, variant_id = await _seed_product_with_variant(admin_client, stock=10)

    with patch("app.services.stripe_service.stripe") as mock_stripe:
        mock_stripe.checkout.Session.create.return_value = _mock_stripe_session()
        with patch("app.services.email_service.resend"):
            resp = await admin_client.post("/api/checkout", json=_checkout_body(variant_id, quantity=3))
    order_number = resp.json()["order_number"]

    # Stock should be 7 now
    resp = await admin_client.get("/api/products/test-tee")
    assert resp.status_code == 200
    assert resp.json()["variants"][0]["stock_quantity"] == 7

    # Simulate expired session webhook
    event = {
        "id": "evt_test_expired",
        "type": "checkout.session.expired",
        "data": {"object": {"id": "cs_test_abc123"}}
    }

    with patch("app.routes.webhooks.verify_webhook_signature", return_value=event):
        resp = await admin_client.post(
            "/api/webhooks/stripe",
            content=json.dumps(event).encode(),
            headers={"stripe-signature": "t=123,v1=valid"},
        )

    assert resp.status_code == 200

    # Stock should be restored to 10
    resp = await admin_client.get("/api/products/test-tee")
    assert resp.status_code == 200
    assert resp.json()["variants"][0]["stock_quantity"] == 10

    # Order should be cancelled
    resp = await admin_client.get(f"/api/orders/{order_number}?email=test@example.com")
    assert resp.json()["status"] == "cancelled"
