"""Customer order history tests — linked orders, guest email matching, checkout customer_id."""
import os
from unittest.mock import patch, MagicMock

import pytest
from app.database import get_db
from httpx import AsyncClient


# ── Helpers ───────────────────────────────────────────────────

async def _seed_product(admin_client: AsyncClient, slug: str = "order-tee", stock: int = 20):
    resp = await admin_client.post("/api/admin/products", json={
        "name": "Order Tee", "slug": slug,
    })
    pid = resp.json()["id"]
    resp2 = await admin_client.post(f"/api/admin/products/{pid}/variants", json={
        "size": "M", "color": "Black", "price_cents": 3000, "stock_quantity": stock,
    })
    return pid, resp2.json()["id"]


def _mock_stripe():
    mock = MagicMock()
    mock.url = "https://checkout.stripe.com/pay/test"
    mock.id = "cs_test_order_hist"
    return mock


def _checkout_body(variant_id: int, email: str = "customer@test.com"):
    return {
        "customer_name": "Test Customer",
        "customer_email": email,
        "shipping_address": {
            "line1": "123 Test St", "city": "Toronto",
            "province": "ON", "postal_code": "M5V 1A1", "country": "CA",
        },
        "items": [{"variant_id": variant_id, "quantity": 1}],
    }


async def _setup_admin(client: AsyncClient):
    """Set up admin user and return admin-authenticated client."""
    from app.auth import hash_password
    async for db in get_db():
        pw_hash = hash_password("admin123")
        await db.execute(
            "INSERT OR IGNORE INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)",
            ("admin", pw_hash, "owner"),
        )
        await db.commit()
    await client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    return client


# ── Order History ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_order_history_empty(customer_client: AsyncClient):
    resp = await customer_client.get("/api/customers/me/orders")
    assert resp.status_code == 200
    assert resp.json()["orders"] == []


@pytest.mark.asyncio
async def test_order_history_shows_linked_orders(client: AsyncClient):
    """Orders placed while logged in appear in order history."""
    # Setup admin to seed products
    admin = await _setup_admin(client)
    _, vid = await _seed_product(admin, slug="linked-tee")
    await client.post("/api/auth/logout")

    # Register and login as customer
    await client.post("/api/customers/register", json={
        "email": "linked@test.com", "password": "Pass12345",
        "first_name": "Linked", "last_name": "Customer",
    })

    # Place order while logged in
    with patch("app.services.stripe_service.stripe") as ms:
        ms.checkout.Session.create.return_value = _mock_stripe()
        with patch("app.services.email_service.resend"):
            resp = await client.post("/api/checkout", json=_checkout_body(vid, "linked@test.com"))
    assert resp.status_code == 201
    order_number = resp.json()["order_number"]

    # Check order history
    resp2 = await client.get("/api/customers/me/orders")
    assert resp2.status_code == 200
    orders = resp2.json()["orders"]
    assert len(orders) == 1
    assert orders[0]["order_number"] == order_number


@pytest.mark.asyncio
async def test_order_history_matches_guest_orders_by_email(client: AsyncClient):
    """Orders placed as guest (before account creation) appear in history by email match."""
    # Setup admin
    admin = await _setup_admin(client)
    _, vid = await _seed_product(admin, slug="guest-tee")
    await client.post("/api/auth/logout")

    # Place order as guest (no customer login)
    with patch("app.services.stripe_service.stripe") as ms:
        ms.checkout.Session.create.return_value = _mock_stripe()
        with patch("app.services.email_service.resend"):
            resp = await client.post("/api/checkout", json=_checkout_body(vid, "guestlater@test.com"))
    assert resp.status_code == 201
    guest_order = resp.json()["order_number"]

    # Now register with the same email
    await client.post("/api/customers/register", json={
        "email": "guestlater@test.com", "password": "Pass12345",
        "first_name": "Guest", "last_name": "Later",
    })

    # Guest order should appear in history
    resp2 = await client.get("/api/customers/me/orders")
    orders = resp2.json()["orders"]
    assert any(o["order_number"] == guest_order for o in orders)


@pytest.mark.asyncio
async def test_order_history_requires_auth(client: AsyncClient):
    resp = await client.get("/api/customers/me/orders")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_checkout_links_customer_id_to_order(client: AsyncClient):
    """When a logged-in customer checks out, the order gets customer_id set."""
    admin = await _setup_admin(client)
    _, vid = await _seed_product(admin, slug="cid-tee")
    await client.post("/api/auth/logout")

    # Register customer
    reg = await client.post("/api/customers/register", json={
        "email": "cidtest@test.com", "password": "Pass12345",
        "first_name": "CID", "last_name": "Test",
    })
    customer_id = reg.json()["id"]

    # Place order
    with patch("app.services.stripe_service.stripe") as ms:
        ms.checkout.Session.create.return_value = _mock_stripe()
        with patch("app.services.email_service.resend"):
            resp = await client.post("/api/checkout", json=_checkout_body(vid, "cidtest@test.com"))
    order_number = resp.json()["order_number"]

    # Check DB directly
    async for db in get_db():
        pass
        cursor = await db.execute(
            "SELECT customer_id FROM orders WHERE order_number = ?", (order_number,)
        )
        row = await cursor.fetchone()
        assert row["customer_id"] == customer_id


@pytest.mark.asyncio
async def test_guest_checkout_has_null_customer_id(client: AsyncClient):
    """Guest checkout should have customer_id = NULL."""
    admin = await _setup_admin(client)
    _, vid = await _seed_product(admin, slug="guest-null-tee")
    await client.post("/api/auth/logout")

    with patch("app.services.stripe_service.stripe") as ms:
        ms.checkout.Session.create.return_value = _mock_stripe()
        with patch("app.services.email_service.resend"):
            resp = await client.post("/api/checkout", json=_checkout_body(vid, "guest@test.com"))
    order_number = resp.json()["order_number"]

    async for db in get_db():
        pass
        cursor = await db.execute(
            "SELECT customer_id FROM orders WHERE order_number = ?", (order_number,)
        )
        row = await cursor.fetchone()
        assert row["customer_id"] is None
