"""Regression tests — soft deletes, email case-insensitive lookup, admin auth edges."""
import os
from unittest.mock import patch, MagicMock

import pytest
import aiosqlite
from httpx import AsyncClient


# ── Helpers ───────────────────────────────────────────────────

async def _seed_product(admin_client: AsyncClient, slug: str = "reg-tee"):
    resp = await admin_client.post("/api/admin/products", json={
        "name": "Regression Tee", "slug": slug,
    })
    pid = resp.json()["id"]
    resp2 = await admin_client.post(f"/api/admin/products/{pid}/variants", json={
        "size": "M", "color": "Black", "price_cents": 4500, "stock_quantity": 20,
    })
    return pid, resp2.json()["id"]


def _mock_stripe():
    mock = MagicMock()
    mock.url = "https://checkout.stripe.com/pay/test"
    mock.id = "cs_test_regression"
    return mock


async def _place_order(client: AsyncClient, variant_id: int, email: str = "reg@test.com"):
    with patch("app.services.stripe_service.stripe") as ms:
        ms.checkout.Session.create.return_value = _mock_stripe()
        with patch("app.services.email_service.resend"):
            resp = await client.post("/api/checkout", json={
                "customer_name": "Reg Tester",
                "customer_email": email,
                "shipping_address": {
                    "line1": "1 Reg St", "city": "Toronto",
                    "province": "ON", "postal_code": "M5V 1A1", "country": "CA",
                },
                "items": [{"variant_id": variant_id, "quantity": 1}],
            })
    assert resp.status_code == 201
    return resp.json()["order_number"]


# ── Soft Deletes ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_soft_delete_product_with_orders(admin_client: AsyncClient, client: AsyncClient):
    """Products with existing orders should be deactivated, not hard deleted."""
    pid, vid = await _seed_product(admin_client, slug="soft-del-tee")
    await _place_order(admin_client, vid)

    resp = await admin_client.delete(f"/api/admin/products/{pid}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["deleted"] is False
    assert data["deactivated"] is True
    assert "existing orders" in data["reason"]

    # Product should still exist in DB but be inactive
    db_path = os.environ["DATABASE_PATH"]
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT is_active FROM products WHERE id = ?", (pid,))
        row = await cursor.fetchone()
        assert row["is_active"] == 0

    # Product should NOT appear in public listing
    resp2 = await client.get("/api/products")
    slugs = [p["slug"] for p in resp2.json()["products"]]
    assert "soft-del-tee" not in slugs


@pytest.mark.asyncio
async def test_hard_delete_product_without_orders(admin_client: AsyncClient):
    """Products with no orders should be hard deleted."""
    pid, _ = await _seed_product(admin_client, slug="hard-del-tee")

    resp = await admin_client.delete(f"/api/admin/products/{pid}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True

    # Product should be gone from DB
    db_path = os.environ["DATABASE_PATH"]
    async with aiosqlite.connect(db_path) as db:
        cursor = await db.execute("SELECT COUNT(*) FROM products WHERE id = ?", (pid,))
        count = (await cursor.fetchone())[0]
        assert count == 0


# ── Email Case-Insensitive Order Lookup ───────────────────────

@pytest.mark.asyncio
async def test_order_lookup_case_insensitive_email(admin_client: AsyncClient):
    """Order lookup should match email regardless of case."""
    _, vid = await _seed_product(admin_client, slug="case-tee")
    order_number = await _place_order(admin_client, vid, email="CaseTest@Example.COM")

    # Lookup with lowercase
    resp = await admin_client.get(f"/api/orders/{order_number}?email=casetest@example.com")
    assert resp.status_code == 200

    # Lookup with uppercase
    resp2 = await admin_client.get(f"/api/orders/{order_number}?email=CASETEST@EXAMPLE.COM")
    assert resp2.status_code == 200

    # Lookup with mixed case
    resp3 = await admin_client.get(f"/api/orders/{order_number}?email=CaseTest@example.com")
    assert resp3.status_code == 200


# ── Admin Auth Edge Cases ─────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_logout(admin_client: AsyncClient):
    resp = await admin_client.post("/api/auth/logout")
    assert resp.status_code == 200

    # /me should now fail
    resp2 = await admin_client.get("/api/auth/me")
    assert resp2.status_code == 401


@pytest.mark.asyncio
async def test_admin_endpoints_reject_customer_token(client: AsyncClient):
    """Customer JWT should NOT grant access to admin endpoints."""
    await client.post("/api/customers/register", json={
        "email": "sneaky@test.com", "password": "Sneaky123",
        "first_name": "Sneaky", "last_name": "User",
    })
    # Customer is now authenticated — try admin endpoints
    resp = await client.get("/api/admin/orders")
    assert resp.status_code == 401

    resp2 = await client.get("/api/admin/products")
    assert resp2.status_code == 401


@pytest.mark.asyncio
async def test_customer_endpoints_reject_admin_token(admin_client: AsyncClient):
    """Admin JWT should NOT grant access to customer endpoints."""
    resp = await admin_client.get("/api/customers/me")
    assert resp.status_code == 401

    resp2 = await admin_client.get("/api/customers/me/addresses")
    assert resp2.status_code == 401


@pytest.mark.asyncio
async def test_admin_product_create_requires_auth(client: AsyncClient):
    resp = await client.post("/api/admin/products", json={
        "name": "Hack", "slug": "hack",
    })
    assert resp.status_code == 401
