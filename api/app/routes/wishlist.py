"""Customer wishlist/favorites endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from app.database import IntegrityError, PostgresConnection

from app.customer_auth import get_current_customer
from app.database import get_db

router = APIRouter(prefix="/customers/me/wishlist", tags=["wishlist"])


@router.get("")
async def list_wishlist(
    db: PostgresConnection = Depends(get_db),
    customer: dict = Depends(get_current_customer),
):
    """Get customer's wishlist with product details."""
    customer_id = int(customer["sub"])
    cursor = await db.execute("""
        SELECT w.id as wishlist_id, w.created_at as added_at,
               p.id as product_id, p.name, p.slug,
               (SELECT url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, sort_order LIMIT 1) as image_url,
               (SELECT MIN(pv.price_cents) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1) as min_price_cents
        FROM wishlist w
        JOIN products p ON p.id = w.product_id AND p.is_active = 1
        WHERE w.customer_id = ?
        ORDER BY w.created_at DESC
    """, (customer_id,))
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.post("/{product_id}", status_code=status.HTTP_201_CREATED)
async def add_to_wishlist(
    product_id: int,
    db: PostgresConnection = Depends(get_db),
    customer: dict = Depends(get_current_customer),
):
    """Add a product to the customer's wishlist."""
    customer_id = int(customer["sub"])

    # Verify product exists
    cursor = await db.execute("SELECT id FROM products WHERE id = ? AND is_active = 1", (product_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    try:
        await db.execute(
            "INSERT INTO wishlist (customer_id, product_id) VALUES (?, ?)",
            (customer_id, product_id),
        )
        await db.commit()
    except IntegrityError:
        pass  # Already in wishlist, idempotent

    return {"added": True}


@router.delete("/{product_id}")
async def remove_from_wishlist(
    product_id: int,
    db: PostgresConnection = Depends(get_db),
    customer: dict = Depends(get_current_customer),
):
    """Remove a product from the customer's wishlist."""
    customer_id = int(customer["sub"])
    await db.execute(
        "DELETE FROM wishlist WHERE customer_id = ? AND product_id = ?",
        (customer_id, product_id),
    )
    await db.commit()
    return {"removed": True}
