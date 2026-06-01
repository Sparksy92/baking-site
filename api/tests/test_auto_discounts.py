"""Automatic discounts admin CRUD tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_auto_discount(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/discounts", json={
        "name": "10% off everything",
        "discount_type": "percentage",
        "discount_value": 10,
    })
    assert resp.status_code == 201
    assert "id" in resp.json()


@pytest.mark.asyncio
async def test_list_auto_discounts(admin_client: AsyncClient):
    await admin_client.post("/api/admin/discounts", json={
        "name": "Summer Sale", "discount_type": "fixed_cents", "discount_value": 500,
    })
    resp = await admin_client.get("/api/admin/discounts")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_get_auto_discount(admin_client: AsyncClient):
    create_resp = await admin_client.post("/api/admin/discounts", json={
        "name": "BOGO", "discount_type": "buy_x_get_y", "discount_value": 100,
        "buy_quantity": 2, "get_quantity": 1,
    })
    did = create_resp.json()["id"]

    resp = await admin_client.get(f"/api/admin/discounts/{did}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "BOGO"
    assert resp.json()["buy_quantity"] == 2


@pytest.mark.asyncio
async def test_update_auto_discount(admin_client: AsyncClient):
    create_resp = await admin_client.post("/api/admin/discounts", json={
        "name": "Old Name", "discount_type": "percentage", "discount_value": 5,
    })
    did = create_resp.json()["id"]

    resp = await admin_client.patch(f"/api/admin/discounts/{did}", json={"name": "New Name", "is_active": False})
    assert resp.status_code == 200
    assert resp.json()["updated"] is True

    detail = await admin_client.get(f"/api/admin/discounts/{did}")
    assert detail.json()["name"] == "New Name"
    assert detail.json()["is_active"] == 0


@pytest.mark.asyncio
async def test_delete_auto_discount(admin_client: AsyncClient):
    create_resp = await admin_client.post("/api/admin/discounts", json={
        "name": "To Delete", "discount_type": "percentage", "discount_value": 15,
    })
    did = create_resp.json()["id"]

    resp = await admin_client.delete(f"/api/admin/discounts/{did}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True

    resp = await admin_client.get(f"/api/admin/discounts/{did}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_with_scope(admin_client: AsyncClient):
    # Create a category to scope to
    cat_resp = await admin_client.post("/api/admin/categories", json={"name": "Sale Cat", "slug": "sale-cat-disc"})
    cat_id = cat_resp.json()["id"]

    resp = await admin_client.post("/api/admin/discounts", json={
        "name": "Category Sale",
        "discount_type": "percentage",
        "discount_value": 20,
        "applies_to": "category",
        "applies_to_id": cat_id,
        "minimum_order_cents": 5000,
    })
    assert resp.status_code == 201

    detail = await admin_client.get(f"/api/admin/discounts/{resp.json()['id']}")
    assert detail.json()["applies_to"] == "category"
    assert detail.json()["applies_to_id"] == cat_id


@pytest.mark.asyncio
async def test_auto_discounts_require_auth(client: AsyncClient):
    assert (await client.get("/api/admin/discounts")).status_code == 401
    assert (await client.post("/api/admin/discounts", json={"name": "x", "discount_type": "percentage", "discount_value": 1})).status_code == 401
