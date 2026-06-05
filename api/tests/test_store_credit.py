"""Store credit tests — issue, adjust, balance, history, checkout redemption, return resolution."""
from __future__ import annotations

import pytest


# ── Admin: issue store credit ─────────────────────────────────────────────────

async def test_issue_store_credit(admin_client, customer_client):
    """Admin can issue store credit to a customer."""
    # Get a customer id first by registering
    reg = await customer_client.post("/api/customers/register", json={
        "email": "sc_user@example.com",
        "password": "Password1!",
        "first_name": "Store",
        "last_name": "Credit",
    })
    assert reg.status_code == 201
    customer_id = reg.json()["id"]

    r = await admin_client.post("/api/admin/store-credit", json={
        "customer_id": customer_id,
        "amount_cents": 1500,
        "reason": "goodwill",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["amount_cents"] == 1500
    assert data["new_balance_cents"] == 1500


async def test_issue_store_credit_requires_admin(customer_client):
    """Unauthenticated request to issue credit is rejected."""
    r = await customer_client.post("/api/admin/store-credit", json={
        "customer_id": 1,
        "amount_cents": 500,
        "reason": "test",
    })
    assert r.status_code == 401


async def test_issue_store_credit_invalid_customer(admin_client):
    """Issuing credit to a non-existent customer returns 400."""
    r = await admin_client.post("/api/admin/store-credit", json={
        "customer_id": 999999,
        "amount_cents": 500,
        "reason": "test",
    })
    assert r.status_code == 400


# ── Admin: adjust (positive and negative) ────────────────────────────────────

async def test_adjust_store_credit_positive(admin_client, customer_client):
    """Admin can increase a customer's store credit balance."""
    reg = await customer_client.post("/api/customers/register", json={
        "email": "sc_adj@example.com",
        "password": "Password1!",
        "first_name": "Adj",
        "last_name": "Test",
    })
    customer_id = reg.json()["id"]

    await admin_client.post("/api/admin/store-credit", json={
        "customer_id": customer_id, "amount_cents": 1000, "reason": "manual",
    })

    r = await admin_client.patch(f"/api/admin/store-credit/{customer_id}", json={
        "amount_cents": 500, "reason": "bonus",
    })
    assert r.status_code == 200
    assert r.json()["new_balance_cents"] == 1500


async def test_adjust_store_credit_negative(admin_client, customer_client):
    """Admin can decrease a customer's store credit balance."""
    reg = await customer_client.post("/api/customers/register", json={
        "email": "sc_neg@example.com",
        "password": "Password1!",
        "first_name": "Neg",
        "last_name": "Test",
    })
    customer_id = reg.json()["id"]

    await admin_client.post("/api/admin/store-credit", json={
        "customer_id": customer_id, "amount_cents": 1000, "reason": "manual",
    })

    r = await admin_client.patch(f"/api/admin/store-credit/{customer_id}", json={
        "amount_cents": -300, "reason": "correction",
    })
    assert r.status_code == 200
    assert r.json()["new_balance_cents"] == 700


async def test_adjust_store_credit_insufficient(admin_client, customer_client):
    """Adjusting below zero is rejected."""
    reg = await customer_client.post("/api/customers/register", json={
        "email": "sc_insuf@example.com",
        "password": "Password1!",
        "first_name": "Insuf",
        "last_name": "Test",
    })
    customer_id = reg.json()["id"]

    r = await admin_client.patch(f"/api/admin/store-credit/{customer_id}", json={
        "amount_cents": -500, "reason": "bad",
    })
    assert r.status_code == 400


# ── Admin: get customer store credit ─────────────────────────────────────────

async def test_get_customer_store_credit(admin_client, customer_client):
    """Admin can view a customer's balance and transaction history."""
    reg = await customer_client.post("/api/customers/register", json={
        "email": "sc_view@example.com",
        "password": "Password1!",
        "first_name": "View",
        "last_name": "Test",
    })
    customer_id = reg.json()["id"]

    await admin_client.post("/api/admin/store-credit", json={
        "customer_id": customer_id, "amount_cents": 2000, "reason": "goodwill",
    })

    r = await admin_client.get(f"/api/admin/store-credit/{customer_id}")
    assert r.status_code == 200
    data = r.json()
    assert data["balance_cents"] == 2000
    assert len(data["transactions"]) == 1
    assert data["transactions"][0]["amount_cents"] == 2000
    assert data["transactions"][0]["reason"] == "goodwill"


# ── Public: customer balance and history ─────────────────────────────────────

async def test_customer_can_view_own_balance(admin_client, customer_client):
    """Logged-in customer can view their store credit balance."""
    reg = await customer_client.post("/api/customers/register", json={
        "email": "sc_balance@example.com",
        "password": "Password1!",
        "first_name": "Bal",
        "last_name": "Test",
    })
    customer_id = reg.json()["id"]

    await admin_client.post("/api/admin/store-credit", json={
        "customer_id": customer_id, "amount_cents": 750, "reason": "manual",
    })

    login = await customer_client.post("/api/customers/login", json={
        "email": "sc_balance@example.com", "password": "Password1!",
    })
    assert login.status_code == 200

    r = await customer_client.get("/api/store-credit/balance")
    assert r.status_code == 200
    assert r.json()["store_credit_cents"] == 750


async def test_customer_can_view_own_history(admin_client, customer_client):
    """Logged-in customer can view store credit transaction history."""
    reg = await customer_client.post("/api/customers/register", json={
        "email": "sc_hist@example.com",
        "password": "Password1!",
        "first_name": "Hist",
        "last_name": "Test",
    })
    customer_id = reg.json()["id"]

    await admin_client.post("/api/admin/store-credit", json={
        "customer_id": customer_id, "amount_cents": 500, "reason": "goodwill",
    })

    login = await customer_client.post("/api/customers/login", json={
        "email": "sc_hist@example.com", "password": "Password1!",
    })
    assert login.status_code == 200

    r = await customer_client.get("/api/store-credit/history")
    assert r.status_code == 200
    txns = r.json()
    assert len(txns) == 1
    assert txns[0]["amount_cents"] == 500


async def test_unauthenticated_balance_rejected(client):
    """Unauthenticated balance request is rejected."""
    r = await client.get("/api/store-credit/balance")
    assert r.status_code == 401


# ── Return resolution → store credit ─────────────────────────────────────────

async def test_return_resolution_issues_store_credit(admin_client, customer_client):
    """When a return is resolved as store_credit and marked refunded, credit is issued."""
    # Register customer and create order
    reg = await customer_client.post("/api/customers/register", json={
        "email": "sc_return@example.com",
        "password": "Password1!",
        "first_name": "Return",
        "last_name": "User",
    })
    customer_id = reg.json()["id"]

    # Create a product and variant for ordering
    cat = await admin_client.post("/api/admin/categories", json={"name": "SC Cat", "slug": "sc-cat"})
    prod = await admin_client.post("/api/admin/products", json={
        "name": "SC Product", "slug": "sc-product", "category_id": cat.json()["id"],
    })
    variant = await admin_client.post(
        f"/api/admin/products/{prod.json()['id']}/variants",
        json={"size": "M", "color": "Black", "price_cents": 5000, "stock_quantity": 10},
    )
    variant_id = variant.json()["id"]

    # Place order linked to customer
    login = await customer_client.post("/api/customers/login", json={
        "email": "sc_return@example.com", "password": "Password1!",
    })
    assert login.status_code == 200

    order_r = await customer_client.post("/api/checkout", json={
        "customer_name": "Return User",
        "customer_email": "sc_return@example.com",
        "shipping_address": {
            "line1": "1 Test St", "city": "Toronto",
            "province": "ON", "postal_code": "M5V1A1", "country": "CA",
        },
        "items": [{"variant_id": variant_id, "quantity": 1}],
        "payment_method": "etransfer",
    })
    assert order_r.status_code == 201
    order_number = order_r.json()["order_number"]

    # Get order integer id and confirm payment
    order_detail = await admin_client.get(f"/api/admin/orders?search={order_number}")
    order_id = order_detail.json()["orders"][0]["id"]
    await admin_client.patch(f"/api/admin/orders/{order_id}", json={"payment_status": "confirmed", "status": "delivered"})

    # Get order item id
    order_full = await admin_client.get(f"/api/admin/orders/{order_id}")
    order_item_id = order_full.json()["items"][0]["id"]

    # Create return request (items required)
    ret = await customer_client.post("/api/returns", json={
        "order_id": order_id,
        "reason": "wrong size",
        "items": [{"order_item_id": order_item_id, "quantity": 1}],
    })
    assert ret.status_code == 201
    return_id = ret.json()["id"]

    # Admin: approve → receive → refund as store_credit
    await admin_client.patch(f"/api/admin/returns/{return_id}", json={"status": "approved"})
    await admin_client.patch(f"/api/admin/returns/{return_id}", json={"status": "received"})
    refund_r = await admin_client.patch(f"/api/admin/returns/{return_id}", json={
        "status": "refunded",
        "resolution": "store_credit",
        "refund_amount_cents": 5000,
    })
    assert refund_r.status_code == 200
    assert refund_r.json()["store_credit_issued_cents"] == 5000

    # Verify balance on customer
    r = await admin_client.get(f"/api/admin/store-credit/{customer_id}")
    assert r.json()["balance_cents"] == 5000
