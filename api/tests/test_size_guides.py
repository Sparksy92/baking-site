"""Size guide tests."""
import json
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_size_guide(admin_client: AsyncClient):
    measurements = json.dumps([
        {"size": "S", "chest_cm": 88, "length_cm": 68},
        {"size": "M", "chest_cm": 92, "length_cm": 70},
        {"size": "L", "chest_cm": 96, "length_cm": 72},
    ])
    resp = await admin_client.post("/api/admin/size-guides", json={
        "name": "T-Shirt Guide", "measurements_json": measurements, "is_default": True,
    })
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_list_size_guides(admin_client: AsyncClient):
    measurements = json.dumps([{"size": "S", "chest_cm": 88}])
    await admin_client.post("/api/admin/size-guides", json={
        "name": "List Guide", "measurements_json": measurements,
    })
    resp = await admin_client.get("/api/admin/size-guides")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_get_size_guide_for_product(admin_client: AsyncClient, client: AsyncClient):
    # Create default guide
    measurements = json.dumps([{"size": "M", "chest_cm": 92}])
    await admin_client.post("/api/admin/size-guides", json={
        "name": "Default", "measurements_json": measurements, "is_default": True,
    })

    # Create a product
    resp = await admin_client.post("/api/admin/products", json={"name": "Guide Tee", "slug": "guide-tee"})
    pid = resp.json()["id"]

    # Get guide for product (falls back to default)
    resp = await client.get(f"/api/size-guides/product/{pid}")
    assert resp.status_code == 200
    assert resp.json()["measurements"][0]["size"] == "M"


@pytest.mark.asyncio
async def test_product_specific_guide(admin_client: AsyncClient, client: AsyncClient):
    resp = await admin_client.post("/api/admin/products", json={"name": "Specific Tee", "slug": "specific-tee"})
    pid = resp.json()["id"]

    measurements = json.dumps([{"size": "XL", "chest_cm": 110}])
    await admin_client.post("/api/admin/size-guides", json={
        "name": "Specific", "measurements_json": measurements, "product_id": pid,
    })

    resp = await client.get(f"/api/size-guides/product/{pid}")
    assert resp.status_code == 200
    assert resp.json()["measurements"][0]["size"] == "XL"


@pytest.mark.asyncio
async def test_invalid_json_rejected(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/size-guides", json={
        "name": "Bad", "measurements_json": "not-json{",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_no_guide_404(client: AsyncClient):
    resp = await client.get("/api/size-guides/product/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_size_guide(admin_client: AsyncClient):
    measurements = json.dumps([{"size": "S"}])
    resp = await admin_client.post("/api/admin/size-guides", json={
        "name": "Delete Me", "measurements_json": measurements,
    })
    gid = resp.json()["id"]
    resp = await admin_client.delete(f"/api/admin/size-guides/{gid}")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_size_guides_admin_require_auth(client: AsyncClient):
    assert (await client.get("/api/admin/size-guides")).status_code == 401
