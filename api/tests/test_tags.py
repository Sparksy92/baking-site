"""Product tags tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_tag(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/tags", json={"name": "New Arrival", "slug": "new-arrival"})
    assert resp.status_code == 201
    assert resp.json()["slug"] == "new-arrival"


@pytest.mark.asyncio
async def test_list_tags(admin_client: AsyncClient):
    await admin_client.post("/api/admin/tags", json={"name": "Sale", "slug": "sale"})
    resp = await admin_client.get("/api/admin/tags")
    assert resp.status_code == 200
    assert any(t["slug"] == "sale" for t in resp.json())


@pytest.mark.asyncio
async def test_duplicate_tag_rejected(admin_client: AsyncClient):
    await admin_client.post("/api/admin/tags", json={"name": "Dup", "slug": "dup-tag"})
    resp = await admin_client.post("/api/admin/tags", json={"name": "Dup2", "slug": "dup-tag"})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_update_tag(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/tags", json={"name": "Old", "slug": "old-tag"})
    tid = resp.json()["id"]
    resp = await admin_client.patch(f"/api/admin/tags/{tid}", json={"name": "Updated"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_delete_tag(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/tags", json={"name": "Temp", "slug": "temp-tag"})
    tid = resp.json()["id"]
    resp = await admin_client.delete(f"/api/admin/tags/{tid}")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_add_tag_to_product(admin_client: AsyncClient):
    # Create product
    resp = await admin_client.post("/api/admin/products", json={"name": "Tag Tee", "slug": "tag-tee"})
    pid = resp.json()["id"]
    # Create tag
    resp = await admin_client.post("/api/admin/tags", json={"name": "Featured", "slug": "featured"})
    tid = resp.json()["id"]
    # Add tag
    resp = await admin_client.post(f"/api/admin/tags/products/{pid}/tags/{tid}")
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_remove_tag_from_product(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/products", json={"name": "Untag Tee", "slug": "untag-tee"})
    pid = resp.json()["id"]
    resp = await admin_client.post("/api/admin/tags", json={"name": "Remove", "slug": "remove-tag"})
    tid = resp.json()["id"]
    await admin_client.post(f"/api/admin/tags/products/{pid}/tags/{tid}")
    resp = await admin_client.delete(f"/api/admin/tags/products/{pid}/tags/{tid}")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_tags_require_auth(client: AsyncClient):
    assert (await client.get("/api/admin/tags")).status_code == 401
