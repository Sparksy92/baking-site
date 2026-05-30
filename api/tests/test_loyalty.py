"""Loyalty / points program tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_loyalty_rule(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/loyalty/rules", json={
        "name": "Standard", "points_per_dollar": 2, "redemption_rate_cents": 1, "minimum_points_redeem": 50,
    })
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_list_rules(admin_client: AsyncClient):
    await admin_client.post("/api/admin/loyalty/rules", json={
        "name": "Test Rule", "points_per_dollar": 1,
    })
    resp = await admin_client.get("/api/admin/loyalty/rules")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_adjust_points(admin_client: AsyncClient, customer_client: AsyncClient):
    from app.database import get_db
    async for db in get_db():
        cursor = await db.execute("SELECT id FROM customers LIMIT 1")
        cust = await cursor.fetchone()
        break

    resp = await admin_client.post("/api/admin/loyalty/adjust", json={
        "customer_id": cust["id"], "points": 500, "reason": "bonus",
    })
    assert resp.status_code == 200
    assert resp.json()["new_balance"] == 500


@pytest.mark.asyncio
async def test_deduct_points(admin_client: AsyncClient, customer_client: AsyncClient):
    from app.database import get_db
    async for db in get_db():
        cursor = await db.execute("SELECT id FROM customers LIMIT 1")
        cust = await cursor.fetchone()
        break

    # Add then deduct
    await admin_client.post("/api/admin/loyalty/adjust", json={
        "customer_id": cust["id"], "points": 200, "reason": "bonus",
    })
    resp = await admin_client.post("/api/admin/loyalty/adjust", json={
        "customer_id": cust["id"], "points": -100, "reason": "redemption",
    })
    assert resp.status_code == 200
    assert resp.json()["new_balance"] == 100


@pytest.mark.asyncio
async def test_customer_balance(admin_client: AsyncClient, customer_client: AsyncClient):
    # Need a loyalty rule for balance endpoint
    await admin_client.post("/api/admin/loyalty/rules", json={
        "name": "Balance Test", "points_per_dollar": 1, "redemption_rate_cents": 1, "minimum_points_redeem": 10,
    })

    from app.database import get_db
    async for db in get_db():
        cursor = await db.execute("SELECT id FROM customers LIMIT 1")
        cust = await cursor.fetchone()
        break

    await admin_client.post("/api/admin/loyalty/adjust", json={
        "customer_id": cust["id"], "points": 300, "reason": "signup",
    })

    resp = await customer_client.get("/api/loyalty/balance")
    assert resp.status_code == 200
    assert resp.json()["points"] == 300


@pytest.mark.asyncio
async def test_customer_history(admin_client: AsyncClient, customer_client: AsyncClient):
    from app.database import get_db
    async for db in get_db():
        cursor = await db.execute("SELECT id FROM customers LIMIT 1")
        cust = await cursor.fetchone()
        break

    await admin_client.post("/api/admin/loyalty/adjust", json={
        "customer_id": cust["id"], "points": 50, "reason": "test",
    })
    resp = await customer_client.get("/api/loyalty/history")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_loyalty_stats(admin_client: AsyncClient):
    resp = await admin_client.get("/api/admin/loyalty/stats")
    assert resp.status_code == 200
    assert "members_with_points" in resp.json()


@pytest.mark.asyncio
async def test_loyalty_require_auth(client: AsyncClient):
    assert (await client.get("/api/loyalty/balance")).status_code == 401
    assert (await client.get("/api/admin/loyalty/rules")).status_code == 401
