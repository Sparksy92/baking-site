"""Related / recommended products — public endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from app.database import PostgresConnection

from app.database import get_db

router = APIRouter(tags=["products"])


@router.get("/products/{product_id}/related")
async def get_related_products(
    product_id: int,
    limit: int = Query(default=4, ge=1, le=12),
    db: PostgresConnection = Depends(get_db),
):
    """Get related products for a given product.

    Priority: manual picks > co-purchase > same category fallback.
    Returns lightweight product cards suitable for "You may also like" sections.
    """
    # First try explicit related_products table
    cursor = await db.execute("""
        SELECT rp.related_product_id, rp.relation_type, rp.score,
               p.id, p.name, p.slug, p.description,
               (SELECT url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, sort_order LIMIT 1) as image_url,
               (SELECT MIN(pv.price_cents) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1) as min_price_cents,
               (SELECT MAX(pv.compare_at_price_cents) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1) as compare_at_price_cents,
               (SELECT SUM(pv.stock_quantity) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1) as total_stock
        FROM related_products rp
        JOIN products p ON p.id = rp.related_product_id AND p.is_active = 1
        WHERE rp.product_id = ?
        ORDER BY rp.score DESC
        LIMIT ?
    """, (product_id, limit))
    rows = await cursor.fetchall()

    if len(rows) >= limit:
        return {"products": [_format_product(r) for r in rows]}

    # Fallback: same category products (exclude self and already-found)
    found_ids = {r["id"] for r in rows}
    found_ids.add(product_id)
    remaining = limit - len(rows)

    placeholders = ",".join("?" * len(found_ids))
    cursor = await db.execute(f"""
        SELECT p.id, p.name, p.slug, p.description,
               (SELECT url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, sort_order LIMIT 1) as image_url,
               (SELECT MIN(pv.price_cents) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1) as min_price_cents,
               (SELECT MAX(pv.compare_at_price_cents) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1) as compare_at_price_cents,
               (SELECT SUM(pv.stock_quantity) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1) as total_stock
        FROM products p
        WHERE p.is_active = 1
          AND p.id NOT IN ({placeholders})
          AND p.category_id = (SELECT category_id FROM products WHERE id = ?)
        ORDER BY p.is_featured DESC, RANDOM()
        LIMIT ?
    """, list(found_ids) + [product_id, remaining])
    fallback_rows = await cursor.fetchall()

    products = [_format_product(r) for r in rows]
    products.extend([_format_product(r) for r in fallback_rows])

    return {"products": products}


def _format_product(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "slug": row["slug"],
        "image_url": row["image_url"],
        "min_price_cents": row["min_price_cents"],
        "compare_at_price_cents": row["compare_at_price_cents"],
        "total_stock": row["total_stock"] or 0,
    }
