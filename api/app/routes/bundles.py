"""Public bundle endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
import aiosqlite

from app.database import get_db

router = APIRouter(prefix="/bundles", tags=["bundles"])


@router.get("")
async def list_bundles(db: aiosqlite.Connection = Depends(get_db)):
    """List active bundles."""
    cursor = await db.execute(
        "SELECT id, name, slug, description, discount_type, discount_value FROM bundles WHERE is_active = 1 ORDER BY name"
    )
    bundles = []
    for b in await cursor.fetchall():
        item_cursor = await db.execute("""
            SELECT bi.quantity, p.name as product_name, p.slug as product_slug,
                   bi.default_variant_id,
                   (SELECT MIN(price_cents) FROM product_variants WHERE product_id = p.id AND is_active = 1) as min_price_cents
            FROM bundle_items bi
            JOIN products p ON p.id = bi.product_id
            WHERE bi.bundle_id = ?
        """, (b["id"],))
        items = [dict(i) for i in await item_cursor.fetchall()]
        bundle = dict(b)
        bundle["items"] = items
        # Calculate bundle price
        total = sum((i["min_price_cents"] or 0) * i["quantity"] for i in items)
        if b["discount_type"] == "percentage":
            bundle["bundle_price_cents"] = total - (total * b["discount_value"] // 100)
        else:
            bundle["bundle_price_cents"] = max(total - b["discount_value"], 0)
        bundle["original_price_cents"] = total
        bundles.append(bundle)

    return bundles


@router.get("/{slug}")
async def get_bundle(slug: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a single bundle by slug."""
    cursor = await db.execute(
        "SELECT * FROM bundles WHERE slug = ? AND is_active = 1", (slug,)
    )
    bundle = await cursor.fetchone()
    if not bundle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bundle not found")

    item_cursor = await db.execute("""
        SELECT bi.*, p.name as product_name, p.slug as product_slug,
               (SELECT MIN(price_cents) FROM product_variants WHERE product_id = p.id AND is_active = 1) as min_price_cents
        FROM bundle_items bi
        JOIN products p ON p.id = bi.product_id
        WHERE bi.bundle_id = ?
    """, (bundle["id"],))
    items = [dict(i) for i in await item_cursor.fetchall()]

    result = dict(bundle)
    result["items"] = items
    total = sum((i["min_price_cents"] or 0) * i["quantity"] for i in items)
    if bundle["discount_type"] == "percentage":
        result["bundle_price_cents"] = total - (total * bundle["discount_value"] // 100)
    else:
        result["bundle_price_cents"] = max(total - bundle["discount_value"], 0)
    result["original_price_cents"] = total
    return result
