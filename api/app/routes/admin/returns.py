"""Admin return request management — approve, reject, receive, refund."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
import aiosqlite

from app.auth import require_admin
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/returns", tags=["admin-returns"])


class ReturnStatusUpdate(BaseModel):
    status: str  # 'approved', 'rejected', 'received', 'refunded'
    admin_notes: str | None = None
    refund_amount_cents: int | None = None


@router.get("")
async def list_returns(
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List all return requests with optional status filter."""
    offset = (page - 1) * limit
    conditions = []
    params: list = []

    if status_filter:
        conditions.append("rr.status = ?")
        params.append(status_filter)

    where = "WHERE " + " AND ".join(conditions) if conditions else ""

    cursor = await db.execute(f"SELECT COUNT(*) FROM return_requests rr {where}", params)
    total = (await cursor.fetchone())[0]

    cursor = await db.execute(f"""
        SELECT rr.*, o.order_number, o.customer_name, o.customer_email
        FROM return_requests rr
        JOIN orders o ON o.id = rr.order_id
        {where}
        ORDER BY rr.created_at DESC
        LIMIT ? OFFSET ?
    """, params + [limit, offset])
    returns = [dict(r) for r in await cursor.fetchall()]

    return {"returns": returns, "total": total}


@router.get("/{return_id}")
async def get_return(
    return_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Get return request details with items."""
    cursor = await db.execute("""
        SELECT rr.*, o.order_number, o.customer_name, o.customer_email
        FROM return_requests rr
        JOIN orders o ON o.id = rr.order_id
        WHERE rr.id = ?
    """, (return_id,))
    rr = await cursor.fetchone()
    if not rr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Return request not found")

    cursor = await db.execute("""
        SELECT ri.*, oi.product_name, oi.variant_size, oi.variant_color, oi.unit_price_cents
        FROM return_items ri
        JOIN order_items oi ON oi.id = ri.order_item_id
        WHERE ri.return_request_id = ?
    """, (return_id,))
    items = [dict(r) for r in await cursor.fetchall()]

    result = dict(rr)
    result["items"] = items
    return result


@router.patch("/{return_id}")
async def update_return_status(
    return_id: int,
    body: ReturnStatusUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Update return request status (approve/reject/receive/refund)."""
    cursor = await db.execute("SELECT * FROM return_requests WHERE id = ?", (return_id,))
    rr = await cursor.fetchone()
    if not rr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Return request not found")

    valid_transitions = {
        "pending": ["approved", "rejected"],
        "approved": ["received", "rejected"],
        "received": ["refunded"],
    }
    allowed = valid_transitions.get(rr["status"], [])
    if body.status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition from '{rr['status']}' to '{body.status}'. Allowed: {allowed}",
        )

    updates = {"status": body.status}
    if body.admin_notes:
        updates["admin_notes"] = body.admin_notes
    if body.refund_amount_cents is not None:
        updates["refund_amount_cents"] = body.refund_amount_cents

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [return_id]
    await db.execute(
        f"UPDATE return_requests SET {set_clause}, updated_at = datetime('now') WHERE id = ?",
        values,
    )

    # Auto-restock on 'received'
    if body.status == "received":
        cursor = await db.execute("""
            SELECT ri.quantity, oi.variant_id
            FROM return_items ri
            JOIN order_items oi ON oi.id = ri.order_item_id
            WHERE ri.return_request_id = ?
        """, (return_id,))
        for item in await cursor.fetchall():
            if item["variant_id"]:
                await db.execute(
                    "UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?",
                    (item["quantity"], item["variant_id"]),
                )
        logger.info("Return %d received — stock restored", return_id)

    await db.commit()
    return {"updated": True, "status": body.status}
