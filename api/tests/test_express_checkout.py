"""Express checkout tests — PaymentIntent creation for Apple Pay / Google Pay."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


CHECKOUT_BODY = {
    "customer_name": "Express User",
    "customer_email": "express@example.com",
    "shipping_address": {
        "line1": "1 Test St",
        "city": "Toronto",
        "province": "ON",
        "postal_code": "M5V1A1",
        "country": "CA",
    },
    "items": [],  # populated per-test
    "payment_method": "stripe",
}


async def _make_variant(admin_client):
    """Helper: create a category, product and variant; return variant_id and price_cents."""
    cat = await admin_client.post("/api/admin/categories", json={"name": "Express Cat", "slug": "express-cat"})
    prod = await admin_client.post("/api/admin/products", json={
        "name": "Express Product", "slug": "express-product", "category_id": cat.json()["id"],
    })
    v = await admin_client.post(
        f"/api/admin/products/{prod.json()['id']}/variants",
        json={"size": "M", "color": "Black", "price_cents": 4000, "stock_quantity": 5},
    )
    return v.json()["id"], 4000


async def test_payment_intent_returns_client_secret(client, admin_client):
    """POST /checkout/payment-intent returns an order number and a Stripe client_secret."""
    variant_id, _ = await _make_variant(admin_client)

    fake_secret = "pi_test_secret_abc123"
    fake_pi_id = "pi_test_abc123"

    with patch(
        "app.services.stripe_service.create_payment_intent",
        new_callable=AsyncMock,
        return_value=(fake_secret, fake_pi_id),
    ):
        body = {**CHECKOUT_BODY, "items": [{"variant_id": variant_id, "quantity": 1}]}
        r = await client.post("/api/checkout/payment-intent", json=body)

    assert r.status_code == 201
    data = r.json()
    assert "order_number" in data
    assert data["client_secret"] == fake_secret
    assert data["total_cents"] > 0


async def test_payment_intent_creates_order_in_db(client, admin_client):
    """An order record is persisted before the client secret is returned."""
    variant_id, _ = await _make_variant(admin_client)

    with patch(
        "app.services.stripe_service.create_payment_intent",
        new_callable=AsyncMock,
        return_value=("pi_secret_xyz", "pi_xyz"),
    ):
        body = {**CHECKOUT_BODY, "items": [{"variant_id": variant_id, "quantity": 1}]}
        r = await client.post("/api/checkout/payment-intent", json=body)

    assert r.status_code == 201
    order_number = r.json()["order_number"]

    # Verify order exists via public lookup
    lookup = await client.get(
        f"/api/orders/{order_number}?email={CHECKOUT_BODY['customer_email']}"
    )
    assert lookup.status_code == 200
    assert lookup.json()["order_number"] == order_number
    assert lookup.json()["payment_method"] == "stripe"


async def test_payment_intent_decrements_stock(client, admin_client):
    """Stock is decremented when a payment intent order is created."""
    variant_id, _ = await _make_variant(admin_client)

    with patch(
        "app.services.stripe_service.create_payment_intent",
        new_callable=AsyncMock,
        return_value=("pi_secret_stock", "pi_stock"),
    ):
        body = {**CHECKOUT_BODY, "items": [{"variant_id": variant_id, "quantity": 2}]}
        r = await client.post("/api/checkout/payment-intent", json=body)

    assert r.status_code == 201

    # Check stock was decremented (started at 5, bought 2 → 3 left)
    prod_r = await client.get("/api/products/express-product")
    variant = next((v for v in prod_r.json()["variants"] if v["id"] == variant_id), None)
    assert variant is not None
    assert variant["stock_quantity"] == 3


async def test_payment_intent_out_of_stock_rejected(client, admin_client):
    """Ordering more than available stock returns 409."""
    variant_id, _ = await _make_variant(admin_client)

    with patch(
        "app.services.stripe_service.create_payment_intent",
        new_callable=AsyncMock,
        return_value=("pi_secret_oos", "pi_oos"),
    ):
        body = {**CHECKOUT_BODY, "items": [{"variant_id": variant_id, "quantity": 10}]}
        r = await client.post("/api/checkout/payment-intent", json=body)

    assert r.status_code == 409


async def test_payment_intent_stripe_failure_rolls_back(client, admin_client):
    """If Stripe PaymentIntent creation fails, the order is rolled back."""
    variant_id, _ = await _make_variant(admin_client)

    with patch(
        "app.services.stripe_service.create_payment_intent",
        new_callable=AsyncMock,
        side_effect=Exception("Stripe down"),
    ):
        body = {**CHECKOUT_BODY, "items": [{"variant_id": variant_id, "quantity": 1}]}
        r = await client.post("/api/checkout/payment-intent", json=body)

    assert r.status_code == 502

    # Stock should not have been decremented
    prod_r = await client.get("/api/products/express-product")
    variant = next((v for v in prod_r.json()["variants"] if v["id"] == variant_id), None)
    assert variant["stock_quantity"] == 5


async def test_payment_intent_with_promo_code(client, admin_client):
    """Promo codes apply correctly when creating a payment intent."""
    variant_id, price = await _make_variant(admin_client)

    # Create a 10% promo code
    await admin_client.post("/api/admin/promos", json={
        "code": "EXPRESSTEN",
        "discount_type": "percent",
        "discount_value": 10,
        "is_active": True,
    })

    with patch(
        "app.services.stripe_service.create_payment_intent",
        new_callable=AsyncMock,
        return_value=("pi_secret_promo", "pi_promo"),
    ) as mock_pi:
        body = {
            **CHECKOUT_BODY,
            "items": [{"variant_id": variant_id, "quantity": 1}],
            "promo_code": "EXPRESSTEN",
        }
        r = await client.post("/api/checkout/payment-intent", json=body)

    assert r.status_code == 201
    data = r.json()
    # Total must be less than undiscounted total (price + shipping + tax)
    # Get undiscounted total by running without promo
    with patch(
        "app.services.stripe_service.create_payment_intent",
        new_callable=AsyncMock,
        return_value=("pi_secret_nodiscount", "pi_nodiscount"),
    ):
        no_promo_r = await client.post("/api/checkout/payment-intent", json={
            **CHECKOUT_BODY,
            "items": [{"variant_id": variant_id, "quantity": 1}],
        })
    assert no_promo_r.status_code == 201
    assert data["total_cents"] < no_promo_r.json()["total_cents"]
    called_total = mock_pi.call_args.kwargs["total_cents"]
    assert called_total == data["total_cents"]
