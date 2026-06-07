"""Admin endpoints for managing related products."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from app.database import PostgresConnection

from app.auth import require_admin
from app.database import get_db

router = APIRouter(prefix="/admin/products", tags=["admin-products"])


class RelatedProductSet(BaseModel):
    related_product_ids: list[int] = Field(min_length=0, max_length=12)


@router.get("/{product_id}/related")
async def list_related(
    product_id: int,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List manually-set related products for admin editing."""
    cursor = await db.execute("""
        SELECT rp.*, p.name, p.slug,
               (SELECT url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, sort_order LIMIT 1) as image_url
        FROM related_products rp
        JOIN products p ON p.id = rp.related_product_id
        WHERE rp.product_id = ? AND rp.relation_type = 'manual'
        ORDER BY rp.score DESC
    """, (product_id,))
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.put("/{product_id}/related")
async def set_related(
    product_id: int,
    body: RelatedProductSet,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Replace all manual related products for a product."""
    # Verify product exists
    cursor = await db.execute("SELECT id FROM products WHERE id = ?", (product_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    # Remove old manual relations
    await db.execute(
        "DELETE FROM related_products WHERE product_id = ? AND relation_type = 'manual'",
        (product_id,),
    )

    # Insert new ones (bidirectional)
    for idx, related_id in enumerate(body.related_product_ids):
        if related_id == product_id:
            continue
        score = len(body.related_product_ids) - idx  # Higher score = listed first
        try:
            await db.execute(
                "INSERT OR IGNORE INTO related_products (product_id, related_product_id, relation_type, score) VALUES (?, ?, 'manual', ?)",
                (product_id, related_id, score),
            )
            # Bidirectional: also link back
            await db.execute(
                "INSERT OR IGNORE INTO related_products (product_id, related_product_id, relation_type, score) VALUES (?, ?, 'manual', ?)",
                (related_id, product_id, score),
            )
        except Exception:
            pass  # Skip invalid product IDs

    await db.commit()
    return {"updated": True, "count": len(body.related_product_ids)}


@router.post("/rebuild-recommendations")
async def rebuild_co_purchase_recommendations(
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Rebuild co-purchase recommendations from order history.

    Finds products frequently bought together and creates relation entries.
    """
    # Remove old co-purchase relations
    await db.execute("DELETE FROM related_products WHERE relation_type = 'co_purchase'")

    # Build co-purchase matrix from orders containing 2+ distinct products
    cursor = await db.execute("""
        SELECT oi1.product_id as p1, oi2.product_id as p2, COUNT(*) as co_count
        FROM order_items oi1
        JOIN order_items oi2 ON oi1.order_id = oi2.order_id AND oi1.product_id < oi2.product_id
        JOIN orders o ON o.id = oi1.order_id AND o.payment_status = 'paid'
        WHERE oi1.product_id IS NOT NULL AND oi2.product_id IS NOT NULL
        GROUP BY oi1.product_id, oi2.product_id
        HAVING COUNT(*) >= 2
        ORDER BY co_count DESC
    """)
    pairs = await cursor.fetchall()

    inserted = 0
    for pair in pairs:
        score = float(pair["co_count"])
        await db.execute(
            "INSERT OR IGNORE INTO related_products (product_id, related_product_id, relation_type, score) VALUES (?, ?, 'co_purchase', ?)",
            (pair["p1"], pair["p2"], score),
        )
        await db.execute(
            "INSERT OR IGNORE INTO related_products (product_id, related_product_id, relation_type, score) VALUES (?, ?, 'co_purchase', ?)",
            (pair["p2"], pair["p1"], score),
        )
        inserted += 2

    await db.commit()
    return {"rebuilt": True, "relations_created": inserted}
