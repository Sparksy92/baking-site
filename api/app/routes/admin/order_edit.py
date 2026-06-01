"""Admin order editing — modify items/quantities before fulfillment."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import aiosqlite

from app.auth import require_admin
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/orders", tags=["admin-orders"])


class OrderItemUpdate(BaseModel):
    quantity: int = Field(ge=0)  # 0 = remove item


class OrderItemAdd(BaseModel):
    variant_id: int
    quantity: int = Field(gt=0, le=20)


@router.patch("/{order_id}/items/{item_id}")
async def edit_order_item(
    order_id: int,
    item_id: int,
    body: OrderItemUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Edit quantity of an order item. Set to 0 to remove.

    Only allowed before fulfillment (status must be pending/processing).
    """
    cursor = await db.execute("SELECT status FROM orders WHERE id = ?", (order_id,))
    order = await cursor.fetchone()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if order["status"] not in ("pending", "processing"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot edit items for order with status '{order['status']}'. Must be pending or processing.",
        )

    cursor = await db.execute(
        "SELECT * FROM order_items WHERE id = ? AND order_id = ?", (item_id, order_id)
    )
    item = await cursor.fetchone()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order item not found")

    if body.quantity == 0:
        # Remove item — restore stock
        await db.execute(
            "UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?",
            (item["quantity"], item["variant_id"]),
        )
        await db.execute("DELETE FROM order_items WHERE id = ?", (item_id,))
    else:
        # Update quantity — adjust stock difference
        diff = item["quantity"] - body.quantity
        await db.execute(
            "UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?",
            (diff, item["variant_id"]),
        )
        new_line_total = body.quantity * item["unit_price_cents"]
        await db.execute(
            "UPDATE order_items SET quantity = ?, line_total_cents = ? WHERE id = ?",
            (body.quantity, new_line_total, item_id),
        )

    # Recalculate order total
    cursor = await db.execute(
        "SELECT COALESCE(SUM(line_total_cents), 0) as items_total FROM order_items WHERE order_id = ?",
        (order_id,),
    )
    items_total = (await cursor.fetchone())["items_total"]

    cursor = await db.execute("SELECT shipping_cents, discount_cents FROM orders WHERE id = ?", (order_id,))
    order_data = await cursor.fetchone()
    new_total = items_total + (order_data["shipping_cents"] or 0) - (order_data["discount_cents"] or 0)

    await db.execute(
        "UPDATE orders SET subtotal_cents = ?, total_cents = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (items_total, max(new_total, 0), order_id),
    )
    await db.commit()

    return {"updated": True, "new_total_cents": max(new_total, 0)}


@router.post("/{order_id}/items", status_code=status.HTTP_201_CREATED)
async def add_order_item(
    order_id: int,
    body: OrderItemAdd,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Add a new item to an existing order (before fulfillment)."""
    cursor = await db.execute("SELECT status FROM orders WHERE id = ?", (order_id,))
    order = await cursor.fetchone()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if order["status"] not in ("pending", "processing"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add items to a shipped or fulfilled order",
        )

    # Get variant details
    cursor = await db.execute("""
        SELECT pv.*, p.name as product_name, p.slug as product_slug
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = ? AND pv.is_active = 1
    """, (body.variant_id,))
    variant = await cursor.fetchone()
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    if variant["stock_quantity"] < body.quantity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Only {variant['stock_quantity']} available",
        )

    line_total = variant["price_cents"] * body.quantity

    # Decrement stock
    await db.execute(
        "UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?",
        (body.quantity, body.variant_id),
    )

    # Add order item
    cursor = await db.execute(
        """INSERT INTO order_items
           (order_id, variant_id, product_name, variant_size, variant_color, quantity, unit_price_cents, line_total_cents)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (order_id, body.variant_id, variant["product_name"],
         variant["size"], variant["color"], body.quantity,
         variant["price_cents"], line_total),
    )

    # Recalculate total
    sum_cursor = await db.execute(
        "SELECT COALESCE(SUM(line_total_cents), 0) FROM order_items WHERE order_id = ?",
        (order_id,),
    )
    items_total = (await sum_cursor.fetchone())[0]

    cursor = await db.execute("SELECT shipping_cents, discount_cents FROM orders WHERE id = ?", (order_id,))
    order_data = await cursor.fetchone()
    new_total = items_total + (order_data["shipping_cents"] or 0) - (order_data["discount_cents"] or 0)

    await db.execute(
        "UPDATE orders SET subtotal_cents = ?, total_cents = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (items_total, max(new_total, 0), order_id),
    )
    await db.commit()

    return {"id": cursor.lastrowid, "new_total_cents": max(new_total, 0)}
