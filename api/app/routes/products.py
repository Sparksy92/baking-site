from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
import aiosqlite

from app.database import get_db
from app.models.schemas import ProductListItem, ProductResponse, VariantResponse, ImageResponse, CategoryResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["products"])


@router.get("/products", response_model=dict)
async def list_products(
    category: str | None = None,
    collection: str | None = None,
    featured: bool | None = None,
    search: str | None = None,
    sort: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=24, ge=1, le=100),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List products with optional filters."""
    offset = (page - 1) * limit
    conditions = ["p.is_active = 1"]
    params: list = []

    if category:
        conditions.append("c.slug = ?")
        params.append(category)

    if collection:
        conditions.append("""p.id IN (
            SELECT cp.product_id FROM collection_products cp
            JOIN collections col ON col.id = cp.collection_id
            WHERE col.slug = ? AND col.is_active = 1
        )""")
        params.append(collection)

    if featured is not None:
        conditions.append("p.is_featured = ?")
        params.append(1 if featured else 0)

    if search:
        conditions.append("(p.name LIKE ? OR p.description LIKE ?)")
        term = f"%{search}%"
        params.extend([term, term])

    where = " AND ".join(conditions)

    # Count
    count_sql = f"SELECT COUNT(*) FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE {where}"
    cursor = await db.execute(count_sql, params)
    row = await cursor.fetchone()
    total = row[0]

    # Determine sort order
    sort_map = {
        "price_asc": "min_price ASC",
        "price_desc": "min_price DESC",
        "newest": "p.id DESC",
        "name_asc": "p.name ASC",
        "name_desc": "p.name DESC",
    }
    order_clause = sort_map.get(sort or "", "p.sort_order, p.name")

    # Fetch products
    sql = f"""
        SELECT p.id, p.name, p.slug, p.description, p.category_id,
               p.is_active, p.is_featured,
               (SELECT MIN(pv.price_cents) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1) as min_price
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE {where}
        ORDER BY {order_clause}
        LIMIT ? OFFSET ?
    """
    cursor = await db.execute(sql, params + [limit, offset])
    rows = await cursor.fetchall()

    products = []
    for row in rows:
        # Get primary image
        img_cursor = await db.execute(
            "SELECT url FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order LIMIT 1",
            (row["id"],),
        )
        img = await img_cursor.fetchone()

        # Get variant price range + stock + compare_at
        var_cursor = await db.execute(
            "SELECT MIN(price_cents) as min_p, MAX(price_cents) as max_p, SUM(stock_quantity) as total_stock, MAX(compare_at_price_cents) as compare_at FROM product_variants WHERE product_id = ? AND is_active = 1",
            (row["id"],),
        )
        var_info = await var_cursor.fetchone()

        products.append(ProductListItem(
            id=row["id"],
            name=row["name"],
            slug=row["slug"],
            description=row["description"],
            category_id=row["category_id"],
            is_active=bool(row["is_active"]),
            is_featured=bool(row["is_featured"]),
            image_url=img["url"] if img else None,
            min_price_cents=var_info["min_p"] if var_info else None,
            max_price_cents=var_info["max_p"] if var_info else None,
            compare_at_price_cents=var_info["compare_at"] if var_info else None,
            total_stock=var_info["total_stock"] or 0 if var_info else 0,
        ))

    return {"products": products, "total": total, "page": page, "limit": limit}


@router.get("/products/{slug}", response_model=ProductResponse)
async def get_product(slug: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a single product with variants and images."""
    cursor = await db.execute(
        "SELECT * FROM products WHERE slug = ? AND is_active = 1", (slug,)
    )
    product = await cursor.fetchone()

    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    # Category
    category = None
    if product["category_id"]:
        cat_cursor = await db.execute("SELECT * FROM categories WHERE id = ?", (product["category_id"],))
        cat_row = await cat_cursor.fetchone()
        if cat_row:
            category = CategoryResponse(
                id=cat_row["id"], name=cat_row["name"], slug=cat_row["slug"],
                description=cat_row["description"], image_url=cat_row["image_url"],
                sort_order=cat_row["sort_order"], is_active=bool(cat_row["is_active"]),
            )

    # Variants
    var_cursor = await db.execute(
        "SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1 ORDER BY sort_order",
        (product["id"],),
    )
    variant_rows = await var_cursor.fetchall()
    variants = [VariantResponse(
        id=v["id"], product_id=v["product_id"], size=v["size"], color=v["color"],
        color_hex=v["color_hex"], price_cents=v["price_cents"],
        compare_at_price_cents=v["compare_at_price_cents"], sku=v["sku"],
        stock_quantity=v["stock_quantity"], is_active=bool(v["is_active"]),
        sort_order=v["sort_order"],
    ) for v in variant_rows]

    # Images
    img_cursor = await db.execute(
        "SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order",
        (product["id"],),
    )
    img_rows = await img_cursor.fetchall()
    images = [ImageResponse(
        id=i["id"], product_id=i["product_id"], url=i["url"],
        alt_text=i["alt_text"], sort_order=i["sort_order"],
        is_primary=bool(i["is_primary"]),
        variant_id=i["variant_id"],
    ) for i in img_rows]

    return ProductResponse(
        id=product["id"], name=product["name"], slug=product["slug"],
        description=product["description"], category=category,
        is_active=bool(product["is_active"]), is_featured=bool(product["is_featured"]),
        sort_order=product["sort_order"],
        meta_title=product["meta_title"], meta_description=product["meta_description"],
        variants=variants, images=images,
    )


@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(db: aiosqlite.Connection = Depends(get_db)):
    """List active categories with product counts."""
    cursor = await db.execute("""
        SELECT c.*, COUNT(p.id) as product_count
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
        WHERE c.is_active = 1
        GROUP BY c.id
        ORDER BY c.sort_order, c.name
    """)
    rows = await cursor.fetchall()
    return [CategoryResponse(
        id=r["id"], name=r["name"], slug=r["slug"],
        description=r["description"], image_url=r["image_url"],
        sort_order=r["sort_order"], is_active=bool(r["is_active"]),
        product_count=r["product_count"],
    ) for r in rows]


@router.get("/collections", response_model=list)
async def list_collections(db: aiosqlite.Connection = Depends(get_db)):
    """List active collections with product counts."""
    cursor = await db.execute("""
        SELECT col.*, COUNT(cp.product_id) as product_count
        FROM collections col
        LEFT JOIN collection_products cp ON cp.collection_id = col.id
        LEFT JOIN products p ON p.id = cp.product_id AND p.is_active = 1
        WHERE col.is_active = 1
        GROUP BY col.id
        ORDER BY col.sort_order, col.name
    """)
    rows = await cursor.fetchall()
    return [{
        "id": r["id"], "name": r["name"], "slug": r["slug"],
        "description": r["description"], "image_url": r["image_url"],
        "is_active": bool(r["is_active"]), "sort_order": r["sort_order"],
        "product_count": r["product_count"],
    } for r in rows]


@router.get("/collections/{slug}")
async def get_collection(slug: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get collection details."""
    cursor = await db.execute("SELECT * FROM collections WHERE slug = ? AND is_active = 1", (slug,))
    collection = await cursor.fetchone()
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")

    return {
        "id": collection["id"], "name": collection["name"],
        "slug": collection["slug"], "description": collection["description"],
        "image_url": collection["image_url"],
    }
