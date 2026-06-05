"""Tests for: pre-orders + scheduled drops, customer LTV report."""
from __future__ import annotations

import pytest
from datetime import datetime, timedelta, timezone


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _create_product(admin_client, slug: str, allow_preorder: bool = False, available_at: str | None = None):
    cat = await admin_client.post("/api/admin/categories", json={"name": "Drop Cat", "slug": f"drop-cat-{slug}"})
    prod = await admin_client.post("/api/admin/products", json={
        "name": f"Drop {slug}", "slug": slug,
        "category_id": cat.json()["id"],
        "allow_preorder": allow_preorder,
        "available_at": available_at,
    })
    return prod.json()["id"]


async def _add_variant(admin_client, product_id: int, available_at: str | None = None):
    v = await admin_client.post(
        f"/api/admin/products/{product_id}/variants",
        json={"size": "M", "color": "Black", "price_cents": 5000, "stock_quantity": 10,
              "available_at": available_at},
    )
    return v.json()["id"]


def _future(days: int = 7) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def _past(days: int = 7) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


# ─── Pre-order / scheduled drop tests ─────────────────────────────────────────

async def test_product_available_at_returned_in_response(client, admin_client):
    """available_at and allow_preorder are returned in the public product response."""
    drop_date = _future(14)
    pid = await _create_product(admin_client, "drop-test-1", allow_preorder=True, available_at=drop_date)
    await _add_variant(admin_client, pid)

    r = await client.get("/api/products/drop-test-1")
    assert r.status_code == 200
    data = r.json()
    assert data["allow_preorder"] is True
    assert data["available_at"] is not None


async def test_variant_available_at_returned_in_response(client, admin_client):
    """available_at on a variant is returned in the variant list."""
    drop_date = _future(3)
    pid = await _create_product(admin_client, "drop-test-2")
    await _add_variant(admin_client, pid, available_at=drop_date)

    r = await client.get("/api/products/drop-test-2")
    assert r.status_code == 200
    variant = r.json()["variants"][0]
    assert variant["available_at"] is not None


async def test_product_without_drop_date_has_null_available_at(client, admin_client):
    """Products without a drop date have null available_at."""
    pid = await _create_product(admin_client, "drop-test-3")
    await _add_variant(admin_client, pid)

    r = await client.get("/api/products/drop-test-3")
    assert r.status_code == 200
    assert r.json()["available_at"] is None
    assert r.json()["allow_preorder"] is False


async def test_preorder_flag_can_be_updated(admin_client):
    """PATCH /admin/products/:id updates allow_preorder correctly."""
    pid = await _create_product(admin_client, "drop-test-4", allow_preorder=False)

    r = await admin_client.patch(f"/api/admin/products/{pid}", json={"allow_preorder": True})
    assert r.status_code == 200

    detail = await admin_client.get(f"/api/admin/products/{pid}")
    assert detail.json()["allow_preorder"] in (True, 1)


async def test_drop_date_can_be_cleared(admin_client):
    """Setting available_at to null removes the drop date."""
    pid = await _create_product(admin_client, "drop-test-5", available_at=_future(5))

    r = await admin_client.patch(f"/api/admin/products/{pid}", json={"available_at": None})
    assert r.status_code == 200

    detail = await admin_client.get(f"/api/admin/products/{pid}")
    assert detail.json()["available_at"] is None


# ─── LTV report tests ─────────────────────────────────────────────────────────

async def _seed_orders(admin_client, client, *, n_orders: int, slug_prefix: str):
    """Create a product+variant and place n_orders confirmed orders against it."""
    pid = await _create_product(admin_client, f"{slug_prefix}-ltv-prod")
    vid = await _add_variant(admin_client, pid)

    for _ in range(n_orders):
        checkout = await client.post("/api/checkout", json={
            "customer_name": f"LTV User {slug_prefix}",
            "customer_email": f"{slug_prefix}@ltv-test.com",
            "shipping_address": {
                "line1": "1 LTV St", "city": "Toronto",
                "province": "ON", "postal_code": "M5V1A1", "country": "CA",
            },
            "items": [{"variant_id": vid, "quantity": 1}],
            "payment_method": "etransfer",
        })
        assert checkout.status_code == 201
        order_num = checkout.json()["order_number"]
        # Admin orders list endpoint to find integer ID
        orders_r = await admin_client.get(f"/api/admin/orders?search={order_num}")
        order_id = orders_r.json()["orders"][0]["id"]
        r = await admin_client.patch(
            f"/api/admin/orders/{order_id}",
            json={"payment_status": "confirmed"},
        )
        assert r.status_code == 200

    return f"{slug_prefix}@ltv-test.com"


async def test_ltv_report_returns_customers(admin_client, client):
    """GET /admin/reports/ltv returns customers with spend data."""
    email = await _seed_orders(admin_client, client, n_orders=2, slug_prefix="ltv1")

    r = await admin_client.get("/api/admin/reports/ltv")
    assert r.status_code == 200
    data = r.json()

    assert "summary" in data
    assert "customers" in data
    assert data["summary"]["total_customers"] >= 1

    match = next((c for c in data["customers"] if c["customer_email"] == email), None)
    assert match is not None
    assert match["order_count"] >= 2
    assert match["total_spent_cents"] > 0
    assert match["avg_order_value_cents"] > 0


async def test_ltv_report_sorted_by_total_spent(admin_client, client):
    """Customers are returned sorted by total_spent_cents descending."""
    await _seed_orders(admin_client, client, n_orders=1, slug_prefix="ltv2a")
    await _seed_orders(admin_client, client, n_orders=3, slug_prefix="ltv2b")

    r = await admin_client.get("/api/admin/reports/ltv")
    assert r.status_code == 200
    customers = r.json()["customers"]

    spends = [c["total_spent_cents"] for c in customers]
    assert spends == sorted(spends, reverse=True)


async def test_ltv_report_min_orders_filter(admin_client, client):
    """min_orders filter excludes single-order customers."""
    await _seed_orders(admin_client, client, n_orders=1, slug_prefix="ltv3a")
    email_repeat = await _seed_orders(admin_client, client, n_orders=2, slug_prefix="ltv3b")

    r = await admin_client.get("/api/admin/reports/ltv?min_orders=2")
    assert r.status_code == 200
    customers = r.json()["customers"]

    emails = [c["customer_email"] for c in customers]
    assert email_repeat in emails
    for c in customers:
        assert c["order_count"] >= 2


async def test_ltv_report_summary_stats(admin_client, client):
    """Summary block includes total_customers, repeat_customers, total_revenue_cents."""
    await _seed_orders(admin_client, client, n_orders=2, slug_prefix="ltv4")

    r = await admin_client.get("/api/admin/reports/ltv")
    assert r.status_code == 200
    summary = r.json()["summary"]

    assert summary["total_customers"] >= 1
    assert summary["total_revenue_cents"] > 0
    assert summary["avg_order_value_cents"] > 0
    assert "repeat_customers" in summary
