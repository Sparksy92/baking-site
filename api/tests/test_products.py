import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_products_empty(client: AsyncClient):
    resp = await client.get("/api/products")
    assert resp.status_code == 200
    data = resp.json()
    assert data["products"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_get_product_not_found(client: AsyncClient):
    resp = await client.get("/api/products/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_admin_create_product(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/products", json={
        "name": "Test Tee",
        "slug": "test-tee",
        "description": "A test t-shirt",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["slug"] == "test-tee"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_categories_empty(client: AsyncClient):
    resp = await client.get("/api/categories")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_collections_empty(client: AsyncClient):
    resp = await client.get("/api/collections")
    assert resp.status_code == 200
    assert resp.json() == []
