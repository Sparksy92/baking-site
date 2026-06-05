"""
SEO API tests — fast, isolated, no browser required.

Covers the layer that matters most: ensuring SEO fields are correctly
stored, returned, and updated through the API. These catch the class of
bug where fields exist in the DB but are silently stripped from responses.

Browser-level tests (meta tags, JSON-LD rendering) live in e2e/seo.spec.ts.
"""
import pytest
from httpx import AsyncClient


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _make_product(admin_client: AsyncClient, **kwargs) -> dict:
    payload = {"name": "SEO Tee", "slug": "seo-tee", **kwargs}
    resp = await admin_client.post("/api/admin/products", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _make_category(admin_client: AsyncClient, **kwargs) -> dict:
    payload = {"name": "SEO Cat", "slug": "seo-cat", **kwargs}
    resp = await admin_client.post("/api/admin/categories", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _make_collection(admin_client: AsyncClient, **kwargs) -> dict:
    payload = {"name": "SEO Col", "slug": "seo-col", **kwargs}
    resp = await admin_client.post("/api/admin/collections", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _make_page(admin_client: AsyncClient, **kwargs) -> dict:
    payload = {
        "title": "SEO Post", "slug": "seo-post",
        "content_html": "<p>Hello</p>", "page_type": "blog_post",
        "status": "published", **kwargs,
    }
    resp = await admin_client.post("/api/admin/pages", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ─────────────────────────────────────────────────────────────────────────────
# Product SEO fields — create and round-trip
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_product_seo_fields_stored_on_create(admin_client: AsyncClient):
    """SEO fields set at creation time are persisted."""
    data = await _make_product(
        admin_client,
        slug="seo-create-tee",
        meta_title="Best Tee",
        meta_description="Great tee for great people",
        noindex=True,
        canonical_url="https://example.com/product/seo-tee",
        og_image_url="https://cdn.example.com/og.jpg",
    )
    assert data["meta_title"] == "Best Tee"
    assert data["meta_description"] == "Great tee for great people"
    assert data["noindex"] is True
    assert data["canonical_url"] == "https://example.com/product/seo-tee"
    assert data["og_image_url"] == "https://cdn.example.com/og.jpg"


@pytest.mark.asyncio
async def test_product_seo_fields_returned_by_public_api(admin_client: AsyncClient, client: AsyncClient):
    """Public GET /api/products/{slug} must return noindex, canonical_url, og_image_url.
    This is the critical regression test — these were previously stripped from the response."""
    await _make_product(
        admin_client,
        slug="seo-public-tee",
        noindex=True,
        canonical_url="https://example.com/canonical",
        og_image_url="https://cdn.example.com/og.jpg",
    )
    resp = await client.get("/api/products/seo-public-tee")
    assert resp.status_code == 200
    data = resp.json()
    assert data["noindex"] is True
    assert data["canonical_url"] == "https://example.com/canonical"
    assert data["og_image_url"] == "https://cdn.example.com/og.jpg"


@pytest.mark.asyncio
async def test_product_noindex_defaults_false(admin_client: AsyncClient, client: AsyncClient):
    """Products are indexable by default."""
    await _make_product(admin_client, slug="seo-default-tee")
    resp = await client.get("/api/products/seo-default-tee")
    assert resp.json()["noindex"] is False


@pytest.mark.asyncio
async def test_product_seo_fields_updated_via_patch(admin_client: AsyncClient, client: AsyncClient):
    """PATCH correctly updates SEO fields including noindex."""
    prod = await _make_product(admin_client, slug="seo-patch-tee")
    pid = prod["id"]

    resp = await admin_client.patch(f"/api/admin/products/{pid}", json={
        "meta_title": "Updated Title",
        "noindex": True,
        "canonical_url": "https://example.com/updated",
    })
    assert resp.status_code == 200

    public = await client.get("/api/products/seo-patch-tee")
    data = public.json()
    assert data["meta_title"] == "Updated Title"
    assert data["noindex"] is True
    assert data["canonical_url"] == "https://example.com/updated"


@pytest.mark.asyncio
async def test_product_noindex_false_not_dropped_by_patch(admin_client: AsyncClient, client: AsyncClient):
    """PATCH noindex=False must persist — not be skipped as falsy.
    Regression for the model_dump(exclude_unset=False) bug."""
    prod = await _make_product(admin_client, slug="seo-noindex-false-tee", noindex=True)
    pid = prod["id"]

    await admin_client.patch(f"/api/admin/products/{pid}", json={"noindex": False})

    public = await client.get("/api/products/seo-noindex-false-tee")
    assert public.json()["noindex"] is False


# ─────────────────────────────────────────────────────────────────────────────
# Category SEO fields
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_category_seo_fields_round_trip(admin_client: AsyncClient, client: AsyncClient):
    """SEO fields on category are returned by the public API."""
    await _make_category(
        admin_client,
        slug="seo-cat-public",
        meta_title="Cat Meta Title",
        meta_description="Cat meta desc",
        intro_copy="Welcome to SEO Cat",
        noindex=True,
    )
    resp = await client.get("/api/categories/seo-cat-public")
    assert resp.status_code == 200
    data = resp.json()
    assert data["meta_title"] == "Cat Meta Title"
    assert data["meta_description"] == "Cat meta desc"
    assert data["intro_copy"] == "Welcome to SEO Cat"
    assert data["noindex"] is True


@pytest.mark.asyncio
async def test_category_noindex_false_not_dropped_by_patch(admin_client: AsyncClient, client: AsyncClient):
    """PATCH noindex=False on category persists correctly."""
    cat = await _make_category(admin_client, slug="seo-cat-patch", noindex=True)
    cid = cat["id"]

    await admin_client.patch(f"/api/admin/categories/{cid}", json={"noindex": False})

    resp = await client.get("/api/categories/seo-cat-patch")
    assert resp.json()["noindex"] is False


@pytest.mark.asyncio
async def test_category_noindex_defaults_false(admin_client: AsyncClient, client: AsyncClient):
    await _make_category(admin_client, slug="seo-cat-default")
    resp = await client.get("/api/categories/seo-cat-default")
    assert resp.json()["noindex"] is False


# ─────────────────────────────────────────────────────────────────────────────
# Collection SEO fields
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_collection_seo_fields_returned_by_public_api(admin_client: AsyncClient, client: AsyncClient):
    """Public GET /api/collections/{slug} must return all SEO fields."""
    await _make_collection(
        admin_client,
        slug="seo-col-public",
        meta_title="Col Meta Title",
        meta_description="Col meta desc",
        intro_copy="Welcome to collection",
        noindex=True,
    )
    resp = await client.get("/api/collections/seo-col-public")
    assert resp.status_code == 200
    data = resp.json()
    assert data["meta_title"] == "Col Meta Title"
    assert data["meta_description"] == "Col meta desc"
    assert data["intro_copy"] == "Welcome to collection"
    assert data["noindex"] is True


@pytest.mark.asyncio
async def test_collection_noindex_false_not_dropped_by_patch(admin_client: AsyncClient, client: AsyncClient):
    """PATCH noindex=False on collection persists correctly."""
    col = await _make_collection(admin_client, slug="seo-col-patch", noindex=True)
    cid = col["id"]

    await admin_client.patch(f"/api/admin/collections/{cid}", json={"noindex": False})

    resp = await client.get("/api/collections/seo-col-patch")
    assert resp.json()["noindex"] is False


@pytest.mark.asyncio
async def test_collection_list_includes_seo_fields(admin_client: AsyncClient, client: AsyncClient):
    """GET /api/collections list must include SEO fields on each item."""
    await _make_collection(
        admin_client, slug="seo-col-list",
        meta_title="List Col Title", noindex=False,
    )
    resp = await client.get("/api/collections")
    assert resp.status_code == 200
    items = resp.json()
    col = next((c for c in items if c["slug"] == "seo-col-list"), None)
    assert col is not None
    assert "meta_title" in col
    assert "noindex" in col


# ─────────────────────────────────────────────────────────────────────────────
# Blog / Page SEO fields
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_page_seo_fields_round_trip(admin_client: AsyncClient, client: AsyncClient):
    """noindex and canonical_url are returned by public GET /api/pages/{slug}."""
    await _make_page(
        admin_client,
        slug="seo-page-public",
        noindex=True,
        canonical_url="https://example.com/canonical-post",
    )
    resp = await client.get("/api/pages/seo-page-public")
    assert resp.status_code == 200
    data = resp.json()
    assert data["noindex"] is True
    assert data["canonical_url"] == "https://example.com/canonical-post"


@pytest.mark.asyncio
async def test_page_noindex_defaults_false(admin_client: AsyncClient, client: AsyncClient):
    await _make_page(admin_client, slug="seo-page-default")
    resp = await client.get("/api/pages/seo-page-default")
    assert resp.json()["noindex"] is False


@pytest.mark.asyncio
async def test_page_list_uses_correct_param_name(admin_client: AsyncClient, client: AsyncClient):
    """Public /api/pages uses page_type= not type= — regression for sitemap bug."""
    await _make_page(admin_client, slug="seo-blog-param")
    resp = await client.get("/api/pages?page_type=blog_post")
    assert resp.status_code == 200
    slugs = [p["slug"] for p in resp.json()["pages"]]
    assert "seo-blog-param" in slugs


@pytest.mark.asyncio
async def test_page_list_returns_paginated_shape(admin_client: AsyncClient, client: AsyncClient):
    """Public /api/pages returns {pages: [], total: N} — not a plain array.
    Regression for the sitemap fetch that iterated the envelope object."""
    await _make_page(admin_client, slug="seo-shape-post")
    resp = await client.get("/api/pages?page_type=blog_post")
    assert resp.status_code == 200
    data = resp.json()
    assert "pages" in data
    assert "total" in data
    assert isinstance(data["pages"], list)


# ─────────────────────────────────────────────────────────────────────────────
# Redirects
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_redirect(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/redirects", json={
        "from_path": "/old-path",
        "to_path": "/new-path",
        "status_code": 301,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["from_path"] == "/old-path"
    assert data["to_path"] == "/new-path"
    assert data["status_code"] == 301
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_redirect_duplicate_from_path_rejected(admin_client: AsyncClient):
    await admin_client.post("/api/admin/redirects", json={
        "from_path": "/dup-path", "to_path": "/a",
    })
    resp = await admin_client.post("/api/admin/redirects", json={
        "from_path": "/dup-path", "to_path": "/b",
    })
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_list_redirects(admin_client: AsyncClient):
    await admin_client.post("/api/admin/redirects", json={
        "from_path": "/list-test", "to_path": "/dest",
    })
    resp = await admin_client.get("/api/admin/redirects")
    assert resp.status_code == 200
    paths = [r["from_path"] for r in resp.json()]
    assert "/list-test" in paths


@pytest.mark.asyncio
async def test_update_redirect(admin_client: AsyncClient):
    create = await admin_client.post("/api/admin/redirects", json={
        "from_path": "/update-me", "to_path": "/old-dest",
    })
    rid = create.json()["id"]
    resp = await admin_client.patch(f"/api/admin/redirects/{rid}", json={
        "to_path": "/new-dest", "is_active": False,
    })
    assert resp.status_code == 200
    updated = (await admin_client.get(f"/api/admin/redirects/{rid}")).json()
    assert updated["to_path"] == "/new-dest"
    assert updated["is_active"] is False


@pytest.mark.asyncio
async def test_delete_redirect(admin_client: AsyncClient):
    create = await admin_client.post("/api/admin/redirects", json={
        "from_path": "/delete-me", "to_path": "/gone",
    })
    rid = create.json()["id"]
    resp = await admin_client.delete(f"/api/admin/redirects/{rid}")
    assert resp.status_code == 200
    assert (await admin_client.get(f"/api/admin/redirects/{rid}")).status_code == 404


@pytest.mark.asyncio
async def test_redirects_require_auth(client: AsyncClient):
    assert (await client.get("/api/admin/redirects")).status_code == 401
    assert (await client.post("/api/admin/redirects", json={"from_path": "/x", "to_path": "/y"})).status_code == 401
    assert (await client.delete("/api/admin/redirects/1")).status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# Sitemap API (server-side XML generation)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sitemap_excludes_noindexed_product(admin_client: AsyncClient, client: AsyncClient):
    """A product with noindex=True must not appear in the sitemap."""
    await _make_product(admin_client, slug="hidden-product", noindex=True)
    resp = await client.get("/api/sitemap.xml")
    assert resp.status_code == 200
    assert "hidden-product" not in resp.text


@pytest.mark.asyncio
async def test_sitemap_includes_indexable_product(admin_client: AsyncClient, client: AsyncClient):
    """A product with noindex=False must appear in the sitemap."""
    await _make_product(admin_client, slug="visible-product", noindex=False)
    resp = await client.get("/api/sitemap.xml")
    assert "visible-product" in resp.text


@pytest.mark.asyncio
async def test_sitemap_excludes_noindexed_collection(admin_client: AsyncClient, client: AsyncClient):
    await _make_collection(admin_client, slug="hidden-col", noindex=True)
    resp = await client.get("/api/sitemap.xml")
    assert "hidden-col" not in resp.text


@pytest.mark.asyncio
async def test_sitemap_blog_posts_use_page_type_param(admin_client: AsyncClient, client: AsyncClient):
    """Sitemap blog post query uses page_type= — regression for the wrong param name bug."""
    await _make_page(admin_client, slug="sitemap-blog-check")
    resp = await client.get("/api/sitemap.xml")
    assert "sitemap-blog-check" in resp.text
