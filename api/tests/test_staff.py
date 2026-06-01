"""Staff roles & permissions tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_staff(admin_client: AsyncClient):
    resp = await admin_client.get("/api/admin/staff")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1  # At least the seeded admin/owner


@pytest.mark.asyncio
async def test_create_staff_as_owner(admin_client: AsyncClient):
    # admin_client is an owner — should succeed
    resp = await admin_client.post("/api/admin/staff", json={
        "username": "newstaff", "password": "Password123!", "permissions": "orders",
    })
    assert resp.status_code == 201
    assert resp.json()["username"] == "newstaff"


@pytest.mark.asyncio
async def test_create_staff_duplicate_rejected(admin_client: AsyncClient):
    await admin_client.post("/api/admin/staff", json={
        "username": "dupstaff", "password": "Password123!", "permissions": "products",
    })
    resp = await admin_client.post("/api/admin/staff", json={
        "username": "dupstaff", "password": "OtherPass1!", "permissions": "orders",
    })
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_update_staff(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/staff", json={
        "username": "updatestaff", "password": "Password123!", "permissions": "orders",
    })
    staff_id = resp.json()["id"]

    resp = await admin_client.patch(f"/api/admin/staff/{staff_id}", json={"permissions": "orders,products"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_invalid_permissions_rejected(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/staff", json={
        "username": "badperms", "password": "Password123!", "permissions": "invalid_perm",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_delete_staff(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/staff", json={
        "username": "todelete", "password": "Password123!", "permissions": "all",
    })
    staff_id = resp.json()["id"]

    resp = await admin_client.delete(f"/api/admin/staff/{staff_id}")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_staff_require_auth(client: AsyncClient):
    assert (await client.get("/api/admin/staff")).status_code == 401
    assert (await client.post("/api/admin/staff", json={"username": "x", "password": "y" * 8})).status_code == 401
