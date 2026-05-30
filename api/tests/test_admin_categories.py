"""Admin categories CRUD tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_categories_empty(admin_client: AsyncClient):
    resp = await admin_client.get("/api/admin/categories")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_create_category(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/categories", json={
        "name": "Tees",
        "slug": "tees",
        "description": "T-shirts",
        "sort_order": 1,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["slug"] == "tees"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_category_duplicate_slug(admin_client: AsyncClient):
    await admin_client.post("/api/admin/categories", json={"name": "Hats", "slug": "hats-dup"})
    resp = await admin_client.post("/api/admin/categories", json={"name": "Hats 2", "slug": "hats-dup"})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_list_categories_shows_all(admin_client: AsyncClient):
    await admin_client.post("/api/admin/categories", json={"name": "Cat A", "slug": "cat-a-list"})
    await admin_client.post("/api/admin/categories", json={"name": "Cat B", "slug": "cat-b-list", "is_active": False})
    resp = await admin_client.get("/api/admin/categories")
    assert resp.status_code == 200
    slugs = [c["slug"] for c in resp.json()]
    assert "cat-a-list" in slugs
    assert "cat-b-list" in slugs  # Inactive also shown in admin


@pytest.mark.asyncio
async def test_get_category(admin_client: AsyncClient):
    create = await admin_client.post("/api/admin/categories", json={"name": "Get Me", "slug": "get-me"})
    cat_id = create.json()["id"]
    resp = await admin_client.get(f"/api/admin/categories/{cat_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Get Me"


@pytest.mark.asyncio
async def test_get_category_not_found(admin_client: AsyncClient):
    resp = await admin_client.get("/api/admin/categories/9999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_category(admin_client: AsyncClient):
    create = await admin_client.post("/api/admin/categories", json={"name": "Old Name", "slug": "old-name"})
    cat_id = create.json()["id"]
    resp = await admin_client.patch(f"/api/admin/categories/{cat_id}", json={
        "name": "New Name",
        "is_active": False,
    })
    assert resp.status_code == 200
    assert resp.json()["updated"] is True

    # Verify
    detail = await admin_client.get(f"/api/admin/categories/{cat_id}")
    assert detail.json()["name"] == "New Name"
    assert detail.json()["is_active"] == 0


@pytest.mark.asyncio
async def test_update_category_empty_body(admin_client: AsyncClient):
    create = await admin_client.post("/api/admin/categories", json={"name": "No Op", "slug": "no-op"})
    cat_id = create.json()["id"]
    resp = await admin_client.patch(f"/api/admin/categories/{cat_id}", json={})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_update_category_not_found(admin_client: AsyncClient):
    resp = await admin_client.patch("/api/admin/categories/9999", json={"name": "X"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_category(admin_client: AsyncClient):
    create = await admin_client.post("/api/admin/categories", json={"name": "To Delete", "slug": "to-delete"})
    cat_id = create.json()["id"]
    resp = await admin_client.delete(f"/api/admin/categories/{cat_id}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True

    # Verify gone
    resp2 = await admin_client.get(f"/api/admin/categories/{cat_id}")
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_delete_category_unlinks_products(admin_client: AsyncClient):
    """Deleting a category should set products' category_id to NULL."""
    # Create category
    cat_resp = await admin_client.post("/api/admin/categories", json={"name": "Unlink Cat", "slug": "unlink-cat"})
    cat_id = cat_resp.json()["id"]

    # Create product in that category
    prod_resp = await admin_client.post("/api/admin/products", json={
        "name": "Linked Product", "slug": "linked-prod", "category_id": cat_id,
    })
    prod_id = prod_resp.json()["id"]

    # Delete category
    await admin_client.delete(f"/api/admin/categories/{cat_id}")

    # Verify product has no category (check via admin products list)
    prods = await admin_client.get("/api/admin/products")
    prod = next(p for p in prods.json() if p["id"] == prod_id)
    assert prod["category_id"] is None


@pytest.mark.asyncio
async def test_delete_category_not_found(admin_client: AsyncClient):
    resp = await admin_client.delete("/api/admin/categories/9999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_categories_require_auth(client: AsyncClient):
    assert (await client.get("/api/admin/categories")).status_code == 401
    assert (await client.post("/api/admin/categories", json={"name": "X", "slug": "x"})).status_code == 401
    assert (await client.patch("/api/admin/categories/1", json={"name": "X"})).status_code == 401
    assert (await client.delete("/api/admin/categories/1")).status_code == 401


@pytest.mark.asyncio
async def test_product_count(admin_client: AsyncClient):
    """Admin category list should include product_count."""
    cat_resp = await admin_client.post("/api/admin/categories", json={"name": "Count Cat", "slug": "count-cat"})
    cat_id = cat_resp.json()["id"]
    await admin_client.post("/api/admin/products", json={"name": "P1", "slug": "p1-count", "category_id": cat_id})
    await admin_client.post("/api/admin/products", json={"name": "P2", "slug": "p2-count", "category_id": cat_id})

    cats = await admin_client.get("/api/admin/categories")
    cat = next(c for c in cats.json() if c["id"] == cat_id)
    assert cat["product_count"] == 2
