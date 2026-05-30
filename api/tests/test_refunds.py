"""Refund workflow tests — full refund, partial refund, validations, edge cases."""
import os
from unittest.mock import patch, MagicMock

import pytest
import aiosqlite
from httpx import AsyncClient


# ── Helpers ───────────────────────────────────────────────────

async def _seed_product(admin_client: AsyncClient, slug: str = "refund-tee"):
    resp = await admin_client.post("/api/admin/products", json={
        "name": "Refund Tee", "slug": slug,
    })
    pid = resp.json()["id"]
    resp2 = await admin_client.post(f"/api/admin/products/{pid}/variants", json={
        "size": "M", "color": "Black", "price_cents": 5000, "stock_quantity": 50,
    })
    return pid, resp2.json()["id"]


def _mock_stripe_session():
    mock = MagicMock()
    mock.url = "https://checkout.stripe.com/pay/test"
    mock.id = "cs_test_refund"
    return mock


async def _create_confirmed_order(admin_client: AsyncClient, variant_id: int):
    """Create an order and mark payment as confirmed with a payment intent."""
    with patch("app.services.stripe_service.stripe") as ms:
        ms.checkout.Session.create.return_value = _mock_stripe_session()
        with patch("app.services.email_service.resend"):
            resp = await admin_client.post("/api/checkout", json={
                "customer_name": "Refund Buyer",
                "customer_email": "refund@test.com",
                "shipping_address": {
                    "line1": "100 Refund St", "city": "Toronto",
                    "province": "ON", "postal_code": "M5V 1A1", "country": "CA",
                },
                "items": [{"variant_id": variant_id, "quantity": 1}],
            })
    assert resp.status_code == 201
    order_number = resp.json()["order_number"]

    # Simulate confirmed payment by updating DB directly
    db_path = os.environ["DATABASE_PATH"]
    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            """UPDATE orders
               SET payment_status = 'confirmed',
                   stripe_payment_intent_id = 'pi_test_refund_123'
               WHERE order_number = ?""",
            (order_number,),
        )
        await db.commit()
        cursor = await db.execute("SELECT id FROM orders WHERE order_number = ?", (order_number,))
        row = await cursor.fetchone()

    return row[0], order_number


# ── Full Refund ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_full_refund_success(admin_client: AsyncClient):
    _, vid = await _seed_product(admin_client)
    order_id, order_number = await _create_confirmed_order(admin_client, vid)

    mock_refund = MagicMock()
    mock_refund.id = "re_test_full_123"

    with patch("app.services.stripe_service.stripe") as ms:
        ms.Refund.create.return_value = mock_refund
        with patch("app.services.email_service.resend"):
            resp = await admin_client.post(f"/api/admin/orders/{order_id}/refund", json={
                "reason": "requested_by_customer",
            })

    assert resp.status_code == 200
    data = resp.json()
    assert data["refunded"] is True
    assert data["refund_amount_cents"] > 0  # full order total (item + shipping)
    assert data["stripe_refund_id"] == "re_test_full_123"

    # Verify DB state
    detail = (await admin_client.get(f"/api/admin/orders/{order_id}")).json()
    assert detail["order"]["status"] == "refunded"
    assert detail["order"]["payment_status"] == "refunded"
    assert detail["order"]["stripe_refund_id"] == "re_test_full_123"
    assert detail["order"]["refunded_at"] is not None


# ── Partial Refund ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_partial_refund(admin_client: AsyncClient):
    _, vid = await _seed_product(admin_client, slug="partial-refund-tee")
    order_id, _ = await _create_confirmed_order(admin_client, vid)

    mock_refund = MagicMock()
    mock_refund.id = "re_test_partial_123"

    with patch("app.services.stripe_service.stripe") as ms:
        ms.Refund.create.return_value = mock_refund
        with patch("app.services.email_service.resend"):
            resp = await admin_client.post(f"/api/admin/orders/{order_id}/refund", json={
                "amount_cents": 2000,
                "reason": "requested_by_customer",
            })

    assert resp.status_code == 200
    assert resp.json()["refund_amount_cents"] == 2000


# ── Validation ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_refund_rejects_pending_payment(admin_client: AsyncClient):
    """Cannot refund an order that hasn't been paid."""
    _, vid = await _seed_product(admin_client, slug="pending-refund-tee")
    with patch("app.services.stripe_service.stripe") as ms:
        ms.checkout.Session.create.return_value = _mock_stripe_session()
        with patch("app.services.email_service.resend"):
            resp = await admin_client.post("/api/checkout", json={
                "customer_name": "Pending",
                "customer_email": "pending@test.com",
                "shipping_address": {
                    "line1": "1 St", "city": "Toronto",
                    "province": "ON", "postal_code": "M5V 1A1", "country": "CA",
                },
                "items": [{"variant_id": vid, "quantity": 1}],
            })
    order_number = resp.json()["order_number"]
    db_path = os.environ["DATABASE_PATH"]
    async with aiosqlite.connect(db_path) as db:
        cursor = await db.execute("SELECT id FROM orders WHERE order_number = ?", (order_number,))
        order_id = (await cursor.fetchone())[0]

    resp2 = await admin_client.post(f"/api/admin/orders/{order_id}/refund", json={})
    assert resp2.status_code == 400
    assert "payment status" in resp2.json()["detail"].lower() or "Payment must be confirmed" in resp2.json()["detail"]


@pytest.mark.asyncio
async def test_refund_rejects_already_refunded(admin_client: AsyncClient):
    """Cannot refund an already-refunded order."""
    _, vid = await _seed_product(admin_client, slug="double-refund-tee")
    order_id, _ = await _create_confirmed_order(admin_client, vid)

    mock_refund = MagicMock()
    mock_refund.id = "re_test_double_123"

    with patch("app.services.stripe_service.stripe") as ms:
        ms.Refund.create.return_value = mock_refund
        with patch("app.services.email_service.resend"):
            await admin_client.post(f"/api/admin/orders/{order_id}/refund", json={})

    # Try again — payment_status is now 'refunded', so it fails the confirmed check
    resp = await admin_client.post(f"/api/admin/orders/{order_id}/refund", json={})
    assert resp.status_code == 400
    assert "refund" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_refund_rejects_amount_exceeding_total(admin_client: AsyncClient):
    _, vid = await _seed_product(admin_client, slug="over-refund-tee")
    order_id, _ = await _create_confirmed_order(admin_client, vid)

    resp = await admin_client.post(f"/api/admin/orders/{order_id}/refund", json={
        "amount_cents": 999999,
    })
    assert resp.status_code == 400
    assert "exceeds" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_refund_not_found(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/orders/9999/refund", json={})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_refund_requires_auth(client: AsyncClient):
    resp = await client.post("/api/admin/orders/1/refund", json={})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refund_stripe_failure(admin_client: AsyncClient):
    """When Stripe API fails, should return 502."""
    _, vid = await _seed_product(admin_client, slug="stripe-fail-tee")
    order_id, _ = await _create_confirmed_order(admin_client, vid)

    with patch("app.services.stripe_service.stripe") as ms:
        ms.Refund.create.side_effect = Exception("Stripe is down")
        resp = await admin_client.post(f"/api/admin/orders/{order_id}/refund", json={})

    assert resp.status_code == 502
    assert "Stripe refund failed" in resp.json()["detail"]
