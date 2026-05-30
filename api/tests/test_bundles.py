"""Product bundles tests."""
import pytest
from httpx import AsyncClient


async def _create_products(admin_client: AsyncClient) -> list[int]:
    """Create 2 products with variants. Returns [pid1, pid2]."""
    ids = []
    for i, (name, slug) in enumerate([("Bundle Tee A", "bundle-a"), ("Bundle Tee B", "bundle-b")]):
        resp = await admin_client.post("/api/admin/products", json={"name": name, "slug": slug})
        pid = resp.json()["id"]
        await admin_client.post(f"/api/admin/products/{pid}/variants", json={
            "size": "M", "color": "Black", "price_cents": 4500, "stock_quantity": 10,
        })
        ids.append(pid)
    return ids


@pytest.mark.asyncio
async def test_create_bundle(admin_client: AsyncClient):
    pids = await _create_products(admin_client)
    resp = await admin_client.post("/api/admin/bundles", json={
        "name": "Duo Pack", "slug": "duo-pack", "discount_type": "percentage", "discount_value": 15,
        "items": [{"product_id": pids[0]}, {"product_id": pids[1]}],
    })
    assert resp.status_code == 201
    assert resp.json()["slug"] == "duo-pack"


@pytest.mark.asyncio
async def test_list_public_bundles(admin_client: AsyncClient, client: AsyncClient):
    pids = await _create_products(admin_client)
    await admin_client.post("/api/admin/bundles", json={
        "name": "Public Bundle", "slug": "public-bundle", "discount_type": "percentage", "discount_value": 10,
        "items": [{"product_id": pids[0]}, {"product_id": pids[1]}],
    })
    resp = await client.get("/api/bundles")
    assert resp.status_code == 200
    bundles = resp.json()
    assert any(b["slug"] == "public-bundle" for b in bundles)
    bundle = next(b for b in bundles if b["slug"] == "public-bundle")
    assert bundle["original_price_cents"] == 9000  # 4500 * 2
    assert bundle["bundle_price_cents"] == 8100  # 10% off


@pytest.mark.asyncio
async def test_get_bundle_by_slug(admin_client: AsyncClient, client: AsyncClient):
    pids = await _create_products(admin_client)
    await admin_client.post("/api/admin/bundles", json={
        "name": "Slug Bundle", "slug": "slug-bundle", "discount_type": "fixed_cents", "discount_value": 1000,
        "items": [{"product_id": pids[0]}, {"product_id": pids[1]}],
    })
    resp = await client.get("/api/bundles/slug-bundle")
    assert resp.status_code == 200
    assert resp.json()["bundle_price_cents"] == 8000  # 9000 - 1000


@pytest.mark.asyncio
async def test_bundle_not_found(client: AsyncClient):
    resp = await client.get("/api/bundles/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_bundle(admin_client: AsyncClient):
    pids = await _create_products(admin_client)
    resp = await admin_client.post("/api/admin/bundles", json={
        "name": "Update Bundle", "slug": "update-bundle", "discount_value": 5,
        "items": [{"product_id": pids[0]}],
    })
    bid = resp.json()["id"]
    resp = await admin_client.patch(f"/api/admin/bundles/{bid}", json={"discount_value": 20})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_delete_bundle(admin_client: AsyncClient):
    pids = await _create_products(admin_client)
    resp = await admin_client.post("/api/admin/bundles", json={
        "name": "Delete Bundle", "slug": "delete-bundle", "discount_value": 0,
        "items": [{"product_id": pids[0]}],
    })
    bid = resp.json()["id"]
    resp = await admin_client.delete(f"/api/admin/bundles/{bid}")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_duplicate_slug_rejected(admin_client: AsyncClient):
    pids = await _create_products(admin_client)
    await admin_client.post("/api/admin/bundles", json={
        "name": "A", "slug": "dup-bundle", "discount_value": 0, "items": [{"product_id": pids[0]}],
    })
    resp = await admin_client.post("/api/admin/bundles", json={
        "name": "B", "slug": "dup-bundle", "discount_value": 0, "items": [{"product_id": pids[0]}],
    })
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_bundles_admin_require_auth(client: AsyncClient):
    assert (await client.get("/api/admin/bundles")).status_code == 401
