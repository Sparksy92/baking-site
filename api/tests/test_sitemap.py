"""Sitemap tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_sitemap_returns_xml(client: AsyncClient):
    resp = await client.get("/api/sitemap.xml")
    assert resp.status_code == 200
    assert "application/xml" in resp.headers["content-type"]
    assert '<?xml version="1.0"' in resp.text
    assert "<urlset" in resp.text


@pytest.mark.asyncio
async def test_sitemap_includes_products(admin_client: AsyncClient, client: AsyncClient):
    await admin_client.post("/api/admin/products", json={"name": "Sitemap Tee", "slug": "sitemap-tee"})
    resp = await client.get("/api/sitemap.xml")
    assert "sitemap-tee" in resp.text


@pytest.mark.asyncio
async def test_sitemap_includes_blog_posts(admin_client: AsyncClient, client: AsyncClient):
    await admin_client.post("/api/admin/pages", json={
        "title": "Sitemap Post", "slug": "sitemap-post", "content_html": "<p>Hi</p>",
        "page_type": "blog_post", "status": "published",
    })
    resp = await client.get("/api/sitemap.xml")
    assert "sitemap-post" in resp.text
