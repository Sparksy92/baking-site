"""Admin bulk order actions."""
from __future__ import annotations

import csv
import io
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import aiosqlite

from app.auth import require_admin
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/orders", tags=["admin-orders"])


class BulkStatusUpdate(BaseModel):
    order_ids: list[int] = Field(min_length=1, max_length=100)
    status: str


@router.post("/bulk/update-status")
async def bulk_update_status(
    body: BulkStatusUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Update status for multiple orders at once."""
    placeholders = ",".join("?" * len(body.order_ids))
    await db.execute(
        f"UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN ({placeholders})",
        [body.status] + body.order_ids,
    )
    await db.commit()
    return {"updated": len(body.order_ids), "new_status": body.status}


class BulkExportFilter(BaseModel):
    order_ids: list[int] | None = None
    status: str | None = None
    date_from: str | None = None
    date_to: str | None = None


@router.post("/bulk/export")
async def bulk_export_orders(
    body: BulkExportFilter,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Export orders to CSV."""
    conditions = []
    params: list = []

    if body.order_ids:
        placeholders = ",".join("?" * len(body.order_ids))
        conditions.append(f"o.id IN ({placeholders})")
        params.extend(body.order_ids)
    if body.status:
        conditions.append("o.status = ?")
        params.append(body.status)
    if body.date_from:
        conditions.append("o.created_at >= ?")
        params.append(body.date_from)
    if body.date_to:
        conditions.append("o.created_at <= ?")
        params.append(body.date_to)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    cursor = await db.execute(f"""
        SELECT o.order_number, o.customer_name, o.customer_email,
               o.status, o.payment_status, o.total_cents, o.shipping_cents,
               o.discount_cents, o.promo_code, o.tracking_number,
               o.created_at,
               GROUP_CONCAT(oi.product_name || ' (' || oi.variant_size || '/' || oi.variant_color || ') x' || oi.quantity, '; ') as items
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        {where}
        GROUP BY o.id
        ORDER BY o.created_at DESC
    """, params)
    rows = await cursor.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Order #", "Customer", "Email", "Status", "Payment",
        "Total", "Shipping", "Discount", "Promo", "Tracking", "Created", "Items",
    ])
    for r in rows:
        writer.writerow([
            r["order_number"], r["customer_name"], r["customer_email"],
            r["status"], r["payment_status"],
            f"${r['total_cents'] / 100:.2f}",
            f"${r['shipping_cents'] / 100:.2f}" if r["shipping_cents"] else "$0.00",
            f"${r['discount_cents'] / 100:.2f}" if r["discount_cents"] else "$0.00",
            r["promo_code"] or "", r["tracking_number"] or "",
            r["created_at"], r["items"] or "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=orders_export.csv"},
    )
