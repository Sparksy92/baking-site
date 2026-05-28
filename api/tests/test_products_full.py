"""Comprehensive product API tests — CRUD, listing, filtering, sorting, pagination."""
import pytest
from httpx import AsyncClient


# ── Helper to seed a product with variants ─────────────────

async def _seed_product(
    admin_client: AsyncClient,
    name: str = "Basic Tee",
    slug: str = "basic-tee",
    description: str = "A cotton tee",
    category_id: int | None = None,
    is_featured: bool = False,
) -> dict:
    resp = await admin_client.post("/api/admin/products", json={
        "name": name,
        "slug": slug,
        "description": description,
        "category_id": category_id,
        "is_featured": is_featured,
    })
    assert resp.status_code == 201
    return resp.json()


async def _add_variant(
    admin_client: AsyncClient,
    product_id: int,
    price_cents: int = 2500,
    compare_at_price_cents: int | None = None,
    stock_quantity: int = 10,
    size: str = "M",
    color: str = "Black",
) -> dict:
    resp = await admin_client.post(f"/api/admin/products/{product_id}/variants", json={
        "price_cents": price_cents,
        "compare_at_price_cents": compare_at_price_cents,
        "stock_quantity": stock_quantity,
        "size": size,
        "color": color,
    })
    assert resp.status_code == 201
    return resp.json()


async def _seed_category(admin_client: AsyncClient, name: str, slug: str) -> int:
    """Create a category via direct DB insert (no admin endpoint yet)."""
    import os
    import aiosqlite
    db_path = os.environ["DATABASE_PATH"]
    async with aiosqlite.connect(db_path) as db:
        cursor = await db.execute(
            "INSERT INTO categories (name, slug, is_active) VALUES (?, ?, 1)",
            (name, slug),
        )
        await db.commit()
        return cursor.lastrowid


# ── Product List Tests ──────────────────────────────────────

@pytest.mark.asyncio
async def test_list_products_returns_total_and_pagination(admin_client: AsyncClient, client: AsyncClient):
    """list response includes total, page, limit keys."""
    await _seed_product(admin_client)
    await _add_variant(admin_client, 1)

    resp = await client.get("/api/products")
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "page" in data
    assert "limit" in data
    assert data["total"] == 1
    assert data["page"] == 1


@pytest.mark.asyncio
async def test_list_products_pagination(admin_client: AsyncClient, client: AsyncClient):
    """Pagination respects page and limit."""
    for i in range(5):
        p = await _seed_product(admin_client, name=f"Tee {i}", slug=f"tee-{i}")
        await _add_variant(admin_client, p["id"])

    resp = await client.get("/api/products?limit=2&page=1")
    data = resp.json()
    assert data["total"] == 5
    assert len(data["products"]) == 2

    resp2 = await client.get("/api/products?limit=2&page=3")
    data2 = resp2.json()
    assert len(data2["products"]) == 1  # 5th product on page 3


@pytest.mark.asyncio
async def test_list_products_search(admin_client: AsyncClient, client: AsyncClient):
    """Search filters by name."""
    await _seed_product(admin_client, name="Red Hoodie", slug="red-hoodie")
    await _add_variant(admin_client, 1)
    await _seed_product(admin_client, name="Blue Jacket", slug="blue-jacket")
    await _add_variant(admin_client, 2)

    resp = await client.get("/api/products?search=hoodie")
    data = resp.json()
    assert data["total"] == 1
    assert data["products"][0]["name"] == "Red Hoodie"


@pytest.mark.asyncio
async def test_list_products_featured_filter(admin_client: AsyncClient, client: AsyncClient):
    """featured=true only returns featured products."""
    await _seed_product(admin_client, name="Normal Tee", slug="normal", is_featured=False)
    await _add_variant(admin_client, 1)
    await _seed_product(admin_client, name="Featured Tee", slug="featured", is_featured=True)
    await _add_variant(admin_client, 2)

    resp = await client.get("/api/products?featured=true")
    data = resp.json()
    assert data["total"] == 1
    assert data["products"][0]["slug"] == "featured"


@pytest.mark.asyncio
async def test_list_products_category_filter(admin_client: AsyncClient, client: AsyncClient):
    """Filtering by category slug works."""
    cat_id = await _seed_category(admin_client, "Tops", "tops")
    await _seed_product(admin_client, name="A Top", slug="a-top", category_id=cat_id)
    await _add_variant(admin_client, 1)
    await _seed_product(admin_client, name="A Bottom", slug="a-bottom")
    await _add_variant(admin_client, 2)

    resp = await client.get("/api/products?category=tops")
    data = resp.json()
    assert data["total"] == 1
    assert data["products"][0]["slug"] == "a-top"


# ── Sort Tests ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sort_price_asc(admin_client: AsyncClient, client: AsyncClient):
    p1 = await _seed_product(admin_client, name="Expensive", slug="expensive")
    await _add_variant(admin_client, p1["id"], price_cents=9999)
    p2 = await _seed_product(admin_client, name="Cheap", slug="cheap")
    await _add_variant(admin_client, p2["id"], price_cents=500)

    resp = await client.get("/api/products?sort=price_asc")
    slugs = [p["slug"] for p in resp.json()["products"]]
    assert slugs == ["cheap", "expensive"]


@pytest.mark.asyncio
async def test_sort_price_desc(admin_client: AsyncClient, client: AsyncClient):
    p1 = await _seed_product(admin_client, name="Cheap2", slug="cheap2")
    await _add_variant(admin_client, p1["id"], price_cents=500)
    p2 = await _seed_product(admin_client, name="Expensive2", slug="expensive2")
    await _add_variant(admin_client, p2["id"], price_cents=9999)

    resp = await client.get("/api/products?sort=price_desc")
    slugs = [p["slug"] for p in resp.json()["products"]]
    assert slugs == ["expensive2", "cheap2"]


@pytest.mark.asyncio
async def test_sort_name_asc(admin_client: AsyncClient, client: AsyncClient):
    await _seed_product(admin_client, name="Zebra Jacket", slug="zebra")
    await _add_variant(admin_client, 1)
    await _seed_product(admin_client, name="Alpha Tee", slug="alpha")
    await _add_variant(admin_client, 2)

    resp = await client.get("/api/products?sort=name_asc")
    names = [p["name"] for p in resp.json()["products"]]
    assert names == ["Alpha Tee", "Zebra Jacket"]


@pytest.mark.asyncio
async def test_sort_newest(admin_client: AsyncClient, client: AsyncClient):
    p1 = await _seed_product(admin_client, name="First", slug="first")
    await _add_variant(admin_client, p1["id"])
    p2 = await _seed_product(admin_client, name="Second", slug="second")
    await _add_variant(admin_client, p2["id"])

    resp = await client.get("/api/products?sort=newest")
    slugs = [p["slug"] for p in resp.json()["products"]]
    assert slugs == ["second", "first"]


# ── compare_at_price_cents in list response ─────────────────

@pytest.mark.asyncio
async def test_compare_at_price_in_list(admin_client: AsyncClient, client: AsyncClient):
    """compare_at_price_cents appears in product list items."""
    p = await _seed_product(admin_client)
    await _add_variant(admin_client, p["id"], price_cents=2000, compare_at_price_cents=3500)

    resp = await client.get("/api/products")
    product = resp.json()["products"][0]
    assert product["compare_at_price_cents"] == 3500
    assert product["min_price_cents"] == 2000


@pytest.mark.asyncio
async def test_compare_at_null_when_not_set(admin_client: AsyncClient, client: AsyncClient):
    """compare_at_price_cents is null when no variant has it set."""
    p = await _seed_product(admin_client)
    await _add_variant(admin_client, p["id"], price_cents=2000, compare_at_price_cents=None)

    resp = await client.get("/api/products")
    product = resp.json()["products"][0]
    assert product["compare_at_price_cents"] is None


# ── Product Detail ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_product_detail(admin_client: AsyncClient, client: AsyncClient):
    """Product detail includes variants and images."""
    p = await _seed_product(admin_client)
    await _add_variant(admin_client, p["id"], price_cents=2500, size="M", color="Black")
    await _add_variant(admin_client, p["id"], price_cents=2500, size="L", color="Black")

    resp = await client.get("/api/products/basic-tee")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Basic Tee"
    assert len(data["variants"]) == 2
    assert data["variants"][0]["size"] in ("M", "L")


@pytest.mark.asyncio
async def test_get_product_with_category(admin_client: AsyncClient, client: AsyncClient):
    """Product detail includes category info."""
    cat_id = await _seed_category(admin_client, "Shirts", "shirts")
    await _seed_product(admin_client, name="Nice Shirt", slug="nice-shirt", category_id=cat_id)
    await _add_variant(admin_client, 1)

    resp = await client.get("/api/products/nice-shirt")
    data = resp.json()
    assert data["category"]["slug"] == "shirts"
    assert data["category"]["name"] == "Shirts"


# ── Admin CRUD ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_update_product(admin_client: AsyncClient):
    p = await _seed_product(admin_client)
    resp = await admin_client.patch(f"/api/admin/products/{p['id']}", json={"name": "Updated Tee"})
    assert resp.status_code == 200
    assert resp.json()["updated"] is True


@pytest.mark.asyncio
async def test_admin_delete_product(admin_client: AsyncClient, client: AsyncClient):
    p = await _seed_product(admin_client)
    resp = await admin_client.delete(f"/api/admin/products/{p['id']}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True

    # Verify gone from public listing
    resp2 = await client.get("/api/products")
    assert resp2.json()["total"] == 0


@pytest.mark.asyncio
async def test_admin_variant_crud(admin_client: AsyncClient, client: AsyncClient):
    """Full variant lifecycle: create, update, delete."""
    p = await _seed_product(admin_client)
    v = await _add_variant(admin_client, p["id"], price_cents=3000, size="S")

    # Update
    resp = await admin_client.patch(
        f"/api/admin/products/{p['id']}/variants/{v['id']}",
        json={"price_cents": 3500}
    )
    assert resp.status_code == 200

    # Verify via detail
    detail = await client.get("/api/products/basic-tee")
    assert detail.json()["variants"][0]["price_cents"] == 3500

    # Delete
    resp = await admin_client.delete(f"/api/admin/products/{p['id']}/variants/{v['id']}")
    assert resp.status_code == 200

    detail2 = await client.get("/api/products/basic-tee")
    assert len(detail2.json()["variants"]) == 0


@pytest.mark.asyncio
async def test_admin_duplicate_slug_rejected(admin_client: AsyncClient):
    await _seed_product(admin_client, slug="unique-tee")
    resp = await admin_client.post("/api/admin/products", json={
        "name": "Another Tee",
        "slug": "unique-tee",
    })
    assert resp.status_code == 409


# ── Categories & Collections ────────────────────────────────

@pytest.mark.asyncio
async def test_categories_with_product_counts(admin_client: AsyncClient, client: AsyncClient):
    cat_id = await _seed_category(admin_client, "Dresses", "dresses")
    await _seed_product(admin_client, name="Dress A", slug="dress-a", category_id=cat_id)
    await _add_variant(admin_client, 1)

    resp = await client.get("/api/categories")
    assert resp.status_code == 200
    cats = resp.json()
    assert len(cats) == 1
    assert cats[0]["slug"] == "dresses"
    assert cats[0]["product_count"] == 1


@pytest.mark.asyncio
async def test_collection_not_found(client: AsyncClient):
    resp = await client.get("/api/collections/nonexistent")
    assert resp.status_code == 404
