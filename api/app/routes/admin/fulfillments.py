"""Admin endpoints for partial fulfillment (multiple shipments per order)."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import aiosqlite

from app.auth import require_admin
from app.database import get_db
from app.services.email_service import send_shipping_notification

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/orders", tags=["admin-orders"])


class FulfillmentItemInput(BaseModel):
    order_item_id: int
    quantity: int = Field(gt=0)


class FulfillmentCreate(BaseModel):
    items: list[FulfillmentItemInput] = Field(min_length=1)
    tracking_number: str | None = None
    tracking_carrier: str | None = None
    notes: str | None = None


class FulfillmentUpdate(BaseModel):
    tracking_number: str | None = None
    tracking_carrier: str | None = None
    status: str | None = None
    notes: str | None = None


@router.get("/{order_id}/fulfillments")
async def list_fulfillments(
    order_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List all fulfillments for an order with their items."""
    cursor = await db.execute("SELECT id FROM orders WHERE id = ?", (order_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    cursor = await db.execute(
        "SELECT * FROM fulfillments WHERE order_id = ? ORDER BY created_at", (order_id,)
    )
    fulfillments = []
    for f in await cursor.fetchall():
        item_cursor = await db.execute("""
            SELECT fi.*, oi.product_name, oi.variant_size, oi.variant_color
            FROM fulfillment_items fi
            JOIN order_items oi ON oi.id = fi.order_item_id
            WHERE fi.fulfillment_id = ?
        """, (f["id"],))
        items = await item_cursor.fetchall()
        fulfillment = dict(f)
        fulfillment["items"] = [dict(i) for i in items]
        fulfillments.append(fulfillment)

    # Also get unfulfilled items
    cursor = await db.execute("""
        SELECT oi.id, oi.product_name, oi.variant_size, oi.variant_color, oi.quantity,
               COALESCE(SUM(fi.quantity), 0) as fulfilled_qty
        FROM order_items oi
        LEFT JOIN fulfillment_items fi ON fi.order_item_id = oi.id
        WHERE oi.order_id = ?
        GROUP BY oi.id
    """, (order_id,))
    all_items = await cursor.fetchall()
    unfulfilled = [
        {**dict(i), "remaining_qty": i["quantity"] - i["fulfilled_qty"]}
        for i in all_items if i["quantity"] > i["fulfilled_qty"]
    ]

    return {"fulfillments": fulfillments, "unfulfilled_items": unfulfilled}


@router.post("/{order_id}/fulfillments", status_code=status.HTTP_201_CREATED)
async def create_fulfillment(
    order_id: int,
    body: FulfillmentCreate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Create a new fulfillment (partial shipment) for an order."""
    cursor = await db.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    order = await cursor.fetchone()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    # Validate quantities don't exceed remaining unfulfilled
    for item in body.items:
        cursor = await db.execute(
            "SELECT quantity FROM order_items WHERE id = ? AND order_id = ?",
            (item.order_item_id, order_id),
        )
        oi = await cursor.fetchone()
        if not oi:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Order item {item.order_item_id} not found in this order",
            )

        cursor = await db.execute(
            "SELECT COALESCE(SUM(quantity), 0) as fulfilled FROM fulfillment_items WHERE order_item_id = ?",
            (item.order_item_id,),
        )
        fulfilled = (await cursor.fetchone())["fulfilled"]
        remaining = oi["quantity"] - fulfilled

        if item.quantity > remaining:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item {item.order_item_id}: requested {item.quantity} but only {remaining} unfulfilled",
            )

    # Create fulfillment
    status_val = "shipped" if body.tracking_number else "pending"
    cursor = await db.execute(
        """INSERT INTO fulfillments (order_id, tracking_number, tracking_carrier, status, notes, shipped_at)
           VALUES (?, ?, ?, ?, ?, CASE WHEN ? IS NOT NULL THEN datetime('now') ELSE NULL END)""",
        (order_id, body.tracking_number, body.tracking_carrier, status_val, body.notes, body.tracking_number),
    )
    fulfillment_id = cursor.lastrowid

    # Create fulfillment items
    for item in body.items:
        await db.execute(
            "INSERT INTO fulfillment_items (fulfillment_id, order_item_id, quantity) VALUES (?, ?, ?)",
            (fulfillment_id, item.order_item_id, item.quantity),
        )

    # Check if fully fulfilled
    cursor = await db.execute("""
        SELECT COALESCE(SUM(fi.quantity), 0) as total_fulfilled,
               (SELECT SUM(quantity) FROM order_items WHERE order_id = ?) as total_ordered
        FROM fulfillment_items fi
        JOIN fulfillments f ON f.id = fi.fulfillment_id
        WHERE f.order_id = ?
    """, (order_id, order_id))
    totals = await cursor.fetchone()

    new_status = "shipped" if totals["total_fulfilled"] >= totals["total_ordered"] else "partially_shipped"
    await db.execute(
        "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?",
        (new_status, order_id),
    )
    await db.commit()

    # Send shipping notification if tracking provided
    if body.tracking_number:
        try:
            order_data = dict(order)
            order_data["tracking_number"] = body.tracking_number
            order_data["tracking_carrier"] = body.tracking_carrier
            await send_shipping_notification(order_data)
        except Exception:
            logger.exception("Failed to send shipping notification for fulfillment")

    return {"id": fulfillment_id, "status": status_val, "order_status": new_status}


@router.patch("/{order_id}/fulfillments/{fulfillment_id}")
async def update_fulfillment(
    order_id: int,
    fulfillment_id: int,
    body: FulfillmentUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Update a fulfillment (add tracking, mark delivered, etc)."""
    cursor = await db.execute(
        "SELECT id FROM fulfillments WHERE id = ? AND order_id = ?",
        (fulfillment_id, order_id),
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fulfillment not found")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    # Set timestamp fields
    if updates.get("status") == "shipped" and "tracking_number" in updates:
        updates["shipped_at"] = "datetime('now')"
    if updates.get("status") == "delivered":
        updates["delivered_at"] = "datetime('now')"

    # Build SET clause (handle datetime functions specially)
    set_parts = []
    values = []
    for k, v in updates.items():
        if v in ("datetime('now')",):
            set_parts.append(f"{k} = datetime('now')")
        else:
            set_parts.append(f"{k} = ?")
            values.append(v)

    set_clause = ", ".join(set_parts)
    values.extend([fulfillment_id, order_id])

    await db.execute(
        f"UPDATE fulfillments SET {set_clause}, updated_at = datetime('now') WHERE id = ? AND order_id = ?",
        values,
    )
    await db.commit()

    return {"updated": True}
