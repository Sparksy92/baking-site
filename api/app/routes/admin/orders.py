from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
import aiosqlite

from app.auth import require_admin
from app.database import get_db
from app.models.schemas import OrderStatusUpdate, RefundRequest
from app.services.email_service import send_shipping_notification, send_refund_confirmation, send_payment_confirmed
from app.services.stripe_service import create_refund

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/orders", tags=["admin-orders"])


@router.get("")
async def list_orders(
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List all orders with pagination."""
    offset = (page - 1) * limit
    conditions = []
    params: list = []

    if status_filter:
        conditions.append("status = ?")
        params.append(status_filter)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    cursor = await db.execute(f"SELECT COUNT(*) FROM orders {where}", params)
    total = (await cursor.fetchone())[0]

    cursor = await db.execute(
        f"SELECT * FROM orders {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        params + [limit, offset],
    )
    rows = await cursor.fetchall()

    orders = []
    for r in rows:
        # Get item count
        item_cursor = await db.execute(
            "SELECT SUM(quantity) as item_count FROM order_items WHERE order_id = ?", (r["id"],)
        )
        item_info = await item_cursor.fetchone()
        order = dict(r)
        order["item_count"] = item_info["item_count"] or 0
        orders.append(order)

    return {"orders": orders, "total": total, "page": page}


@router.get("/{order_id}")
async def get_order(
    order_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Get full order details."""
    cursor = await db.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    order = await cursor.fetchone()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    cursor = await db.execute("SELECT * FROM order_items WHERE order_id = ?", (order_id,))
    items = await cursor.fetchall()

    return {"order": dict(order), "items": [dict(i) for i in items]}


@router.patch("/{order_id}")
async def update_order(
    order_id: int,
    body: OrderStatusUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Update order status, tracking, or notes."""
    cursor = await db.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    order = await cursor.fetchone()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [order_id]

    await db.execute(
        f"UPDATE orders SET {set_clause}, updated_at = datetime('now') WHERE id = ?",
        values,
    )
    await db.commit()

    # Send shipping email if tracking was just added
    if "tracking_number" in updates and updates["tracking_number"]:
        try:
            order_data = dict(order)
            order_data.update(updates)
            await send_shipping_notification(order_data)
        except Exception:
            logger.exception("Failed to send shipping notification for order %d", order_id)

    # Send payment confirmed email if status was manually changed to confirmed
    if updates.get("payment_status") == "confirmed" and order["payment_status"] != "confirmed":
        try:
            order_data = dict(order)
            order_data.update(updates)
            await send_payment_confirmed(order_data)
        except Exception:
            logger.exception("Failed to send payment confirmed email for order %d", order_id)

    return {"updated": True}


@router.post("/{order_id}/refund")
async def refund_order(
    order_id: int,
    body: RefundRequest,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Issue a full or partial refund via Stripe and update order status."""
    cursor = await db.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    order = await cursor.fetchone()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    # Must have a confirmed payment with a payment intent
    if order["payment_status"] != "confirmed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot refund order with payment status '{order['payment_status']}'. Payment must be confirmed.",
        )

    if not order["stripe_payment_intent_id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Stripe payment intent found for this order. Cannot process refund.",
        )

    if order["status"] == "refunded":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order has already been refunded.",
        )

    # Determine refund amount
    refund_amount = body.amount_cents if body.amount_cents else order["total_cents"]
    if refund_amount > order["total_cents"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Refund amount ({refund_amount}) exceeds order total ({order['total_cents']}).",
        )

    # Call Stripe
    try:
        stripe_refund_id = await create_refund(
            payment_intent_id=order["stripe_payment_intent_id"],
            amount_cents=body.amount_cents,
            reason=body.reason,
        )
    except Exception as e:
        logger.exception("Stripe refund failed for order %d", order_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Stripe refund failed: {str(e)}",
        )

    # Update order in DB
    await db.execute(
        """UPDATE orders
           SET status = 'refunded',
               payment_status = 'refunded',
               refund_amount_cents = ?,
               stripe_refund_id = ?,
               refunded_at = datetime('now'),
               refund_reason = ?,
               updated_at = datetime('now')
           WHERE id = ?""",
        (refund_amount, stripe_refund_id, body.reason, order_id),
    )
    await db.commit()

    logger.info(
        "Order %s refunded: %d cents (Stripe refund: %s)",
        order["order_number"], refund_amount, stripe_refund_id,
    )

    # Send refund email
    try:
        await send_refund_confirmation(dict(order), refund_amount)
    except Exception:
        logger.exception("Failed to send refund email for order %s", order["order_number"])

    return {
        "refunded": True,
        "refund_amount_cents": refund_amount,
        "stripe_refund_id": stripe_refund_id,
    }
