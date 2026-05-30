"""Customer segments tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_segment(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/segments", json={
        "name": "VIP Customers", "slug": "vip", "description": "Top spenders",
    })
    assert resp.status_code == 201
    assert resp.json()["name"] == "VIP Customers"


@pytest.mark.asyncio
async def test_list_segments(admin_client: AsyncClient):
    await admin_client.post("/api/admin/segments", json={"name": "Repeat Buyers", "slug": "repeat"})
    resp = await admin_client.get("/api/admin/segments")
    assert resp.status_code == 200
    assert any(s["slug"] == "repeat" for s in resp.json())


@pytest.mark.asyncio
async def test_get_segment_with_members(admin_client: AsyncClient, customer_client: AsyncClient):
    resp = await admin_client.post("/api/admin/segments", json={"name": "Test Seg", "slug": "test-seg"})
    sid = resp.json()["id"]

    # Get customer ID
    from app.database import get_db
    async for db in get_db():
        cursor = await db.execute("SELECT id FROM customers LIMIT 1")
        cust = await cursor.fetchone()
        break

    # Add member
    resp = await admin_client.post(f"/api/admin/segments/{sid}/members/{cust['id']}")
    assert resp.status_code == 201

    # Get segment with members
    resp = await admin_client.get(f"/api/admin/segments/{sid}")
    assert resp.status_code == 200
    assert len(resp.json()["members"]) == 1


@pytest.mark.asyncio
async def test_remove_segment_member(admin_client: AsyncClient, customer_client: AsyncClient):
    resp = await admin_client.post("/api/admin/segments", json={"name": "Remove Seg", "slug": "remove-seg"})
    sid = resp.json()["id"]

    from app.database import get_db
    async for db in get_db():
        cursor = await db.execute("SELECT id FROM customers LIMIT 1")
        cust = await cursor.fetchone()
        break

    await admin_client.post(f"/api/admin/segments/{sid}/members/{cust['id']}")
    resp = await admin_client.delete(f"/api/admin/segments/{sid}/members/{cust['id']}")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_update_segment(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/segments", json={"name": "Update Me", "slug": "update-seg"})
    sid = resp.json()["id"]
    resp = await admin_client.patch(f"/api/admin/segments/{sid}", json={"description": "Updated!"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_delete_segment(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/segments", json={"name": "Delete Me", "slug": "del-seg"})
    sid = resp.json()["id"]
    resp = await admin_client.delete(f"/api/admin/segments/{sid}")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_duplicate_slug_rejected(admin_client: AsyncClient):
    await admin_client.post("/api/admin/segments", json={"name": "A", "slug": "dup-seg"})
    resp = await admin_client.post("/api/admin/segments", json={"name": "B", "slug": "dup-seg"})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_segments_require_auth(client: AsyncClient):
    assert (await client.get("/api/admin/segments")).status_code == 401
