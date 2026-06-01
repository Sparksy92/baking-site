"""Admin endpoints for abandoned cart management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
import aiosqlite

from app.auth import require_admin
from app.database import get_db
from app.services.abandoned_cart_service import process_abandoned_carts

router = APIRouter(prefix="/admin/carts", tags=["admin-carts"])


@router.get("")
async def list_abandoned_carts(
    status_filter: str = Query(default="abandoned", alias="status"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List carts by status with item counts and totals."""
    offset = (page - 1) * limit

    cursor = await db.execute(
        "SELECT COUNT(*) FROM carts WHERE status = ?", (status_filter,)
    )
    total = (await cursor.fetchone())[0]

    cursor = await db.execute("""
        SELECT c.*,
               (SELECT COUNT(*) FROM cart_items WHERE cart_id = c.id) as item_count
        FROM carts c
        WHERE c.status = ?
        ORDER BY c.last_activity_at DESC
        LIMIT ? OFFSET ?
    """, (status_filter, limit, offset))
    rows = await cursor.fetchall()

    return {"carts": [dict(r) for r in rows], "total": total, "page": page}


@router.post("/process-abandoned")
async def trigger_abandoned_cart_processing(
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Manually trigger abandoned cart email processing.

    In production, this should be called by a cron job every 15-30 minutes.
    """
    stats = await process_abandoned_carts(db)
    return {"processed": True, **stats}


@router.get("/stats")
async def abandoned_cart_stats(
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Get abandoned cart recovery statistics."""
    cursor = await db.execute("""
        SELECT
            COUNT(*) FILTER (WHERE status = 'abandoned') as total_abandoned,
            COUNT(*) FILTER (WHERE status = 'recovered') as total_recovered,
            COUNT(*) FILTER (WHERE status = 'active') as total_active,
            SUM(CASE WHEN status = 'abandoned' THEN subtotal_cents ELSE 0 END) as abandoned_value_cents,
            SUM(CASE WHEN status = 'recovered' THEN subtotal_cents ELSE 0 END) as recovered_value_cents
        FROM carts
        WHERE created_at >= (CURRENT_TIMESTAMP - INTERVAL '30 days')
    """)
    row = await cursor.fetchone()

    if not row or row["total_abandoned"] is None:
        return {
            "total_abandoned": 0,
            "total_recovered": 0,
            "recovery_rate": 0,
            "abandoned_value_cents": 0,
            "recovered_value_cents": 0,
        }

    total_abandoned = row["total_abandoned"] + row["total_recovered"]
    recovery_rate = (row["total_recovered"] / total_abandoned * 100) if total_abandoned > 0 else 0

    return {
        "total_abandoned": row["total_abandoned"],
        "total_recovered": row["total_recovered"],
        "recovery_rate": round(recovery_rate, 1),
        "abandoned_value_cents": row["abandoned_value_cents"] or 0,
        "recovered_value_cents": row["recovered_value_cents"] or 0,
    }
