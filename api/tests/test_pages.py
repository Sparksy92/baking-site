"""Blog / CMS pages tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_page(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/pages", json={
        "title": "About Us", "slug": "about-us", "content_html": "<p>Hello</p>",
        "page_type": "page", "status": "published",
    })
    assert resp.status_code == 201
    assert resp.json()["slug"] == "about-us"


@pytest.mark.asyncio
async def test_create_blog_post(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/pages", json={
        "title": "First Post", "slug": "first-post", "content_html": "<p>Blog!</p>",
        "page_type": "blog_post", "status": "published", "author": "Admin",
    })
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_list_published_pages(admin_client: AsyncClient, client: AsyncClient):
    # Create published page
    await admin_client.post("/api/admin/pages", json={
        "title": "Public Page", "slug": "public-page", "content_html": "<p>Hi</p>",
        "page_type": "page", "status": "published",
    })
    # Create draft page
    await admin_client.post("/api/admin/pages", json={
        "title": "Draft Page", "slug": "draft-page", "content_html": "<p>Draft</p>",
        "page_type": "page", "status": "draft",
    })

    # Public endpoint should only show published
    resp = await client.get("/api/pages?page_type=page")
    assert resp.status_code == 200
    pages = resp.json()["pages"]
    slugs = [p["slug"] for p in pages]
    assert "public-page" in slugs
    assert "draft-page" not in slugs


@pytest.mark.asyncio
async def test_get_page_by_slug(admin_client: AsyncClient, client: AsyncClient):
    await admin_client.post("/api/admin/pages", json={
        "title": "Contact", "slug": "contact-page", "content_html": "<p>Contact us</p>",
        "page_type": "page", "status": "published",
    })
    resp = await client.get("/api/pages/contact-page")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Contact"


@pytest.mark.asyncio
async def test_get_nonexistent_page(client: AsyncClient):
    resp = await client.get("/api/pages/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_admin_list_includes_drafts(admin_client: AsyncClient):
    await admin_client.post("/api/admin/pages", json={
        "title": "Admin Draft", "slug": "admin-draft", "content_html": "",
        "status": "draft",
    })
    resp = await admin_client.get("/api/admin/pages")
    assert resp.status_code == 200
    slugs = [p["slug"] for p in resp.json()["pages"]]
    assert "admin-draft" in slugs


@pytest.mark.asyncio
async def test_update_page(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/pages", json={
        "title": "Old Title", "slug": "update-me", "content_html": "",
    })
    pid = resp.json()["id"]
    resp = await admin_client.patch(f"/api/admin/pages/{pid}", json={"title": "New Title"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_delete_page(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/pages", json={
        "title": "Delete Me", "slug": "delete-me", "content_html": "",
    })
    pid = resp.json()["id"]
    resp = await admin_client.delete(f"/api/admin/pages/{pid}")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_duplicate_slug_rejected(admin_client: AsyncClient):
    await admin_client.post("/api/admin/pages", json={
        "title": "A", "slug": "dup-slug", "content_html": "",
    })
    resp = await admin_client.post("/api/admin/pages", json={
        "title": "B", "slug": "dup-slug", "content_html": "",
    })
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_pages_admin_require_auth(client: AsyncClient):
    assert (await client.get("/api/admin/pages")).status_code == 401
    assert (await client.post("/api/admin/pages", json={"title": "x", "slug": "x", "content_html": ""})).status_code == 401
