"""Related products tests."""
import pytest
from httpx import AsyncClient


async def _create_products(admin_client: AsyncClient, count: int = 3) -> list[int]:
    ids = []
    for i in range(count):
        resp = await admin_client.post("/api/admin/products", json={
            "name": f"Related Tee {i}", "slug": f"related-tee-{i}", "category_id": None,
        })
        ids.append(resp.json()["id"])
    return ids


@pytest.mark.asyncio
async def test_related_empty(client: AsyncClient, admin_client: AsyncClient):
    ids = await _create_products(admin_client, 1)
    resp = await client.get(f"/api/products/{ids[0]}/related")
    assert resp.status_code == 200
    assert resp.json()["products"] == []


@pytest.mark.asyncio
async def test_related_same_category_fallback(admin_client: AsyncClient, client: AsyncClient):
    # Create category
    cat_resp = await admin_client.post("/api/admin/categories", json={"name": "Tees", "slug": "tees-related"})
    cat_id = cat_resp.json()["id"]

    # Create products in same category
    p1 = (await admin_client.post("/api/admin/products", json={"name": "Tee A", "slug": "tee-a-rel", "category_id": cat_id})).json()["id"]
    p2 = (await admin_client.post("/api/admin/products", json={"name": "Tee B", "slug": "tee-b-rel", "category_id": cat_id})).json()["id"]
    p3 = (await admin_client.post("/api/admin/products", json={"name": "Tee C", "slug": "tee-c-rel", "category_id": cat_id})).json()["id"]

    resp = await client.get(f"/api/products/{p1}/related?limit=4")
    assert resp.status_code == 200
    slugs = [p["slug"] for p in resp.json()["products"]]
    assert "tee-a-rel" not in slugs  # Should not include self
    assert len(slugs) >= 1


@pytest.mark.asyncio
async def test_admin_set_related(admin_client: AsyncClient, client: AsyncClient):
    ids = await _create_products(admin_client, 4)

    # Set manual related
    resp = await admin_client.put(f"/api/admin/products/{ids[0]}/related", json={
        "related_product_ids": [ids[1], ids[2]],
    })
    assert resp.status_code == 200
    assert resp.json()["count"] == 2

    # Verify via public endpoint
    resp = await client.get(f"/api/products/{ids[0]}/related")
    related_ids = [p["id"] for p in resp.json()["products"]]
    assert ids[1] in related_ids
    assert ids[2] in related_ids
    assert ids[0] not in related_ids


@pytest.mark.asyncio
async def test_admin_list_related(admin_client: AsyncClient):
    ids = await _create_products(admin_client, 3)
    await admin_client.put(f"/api/admin/products/{ids[0]}/related", json={
        "related_product_ids": [ids[1], ids[2]],
    })

    resp = await admin_client.get(f"/api/admin/products/{ids[0]}/related")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_admin_rebuild_recommendations(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/products/rebuild-recommendations")
    assert resp.status_code == 200
    assert "relations_created" in resp.json()


@pytest.mark.asyncio
async def test_related_requires_admin(client: AsyncClient):
    assert (await client.put("/api/admin/products/1/related", json={"related_product_ids": []})).status_code == 401
    assert (await client.post("/api/admin/products/rebuild-recommendations")).status_code == 401
