"""Admin event analytics — conversion funnel and event stats."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from app.database import PostgresConnection

from app.auth import require_admin
from app.database import get_db

router = APIRouter(prefix="/admin/analytics", tags=["admin-analytics"])


@router.get("/funnel")
async def conversion_funnel(
    days: int = Query(default=30, ge=1, le=365),
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Conversion funnel: views → add_to_cart → checkout_started → checkout_completed."""
    funnel = {}
    for event_type in ["product_viewed", "add_to_cart", "checkout_started", "checkout_completed"]:
        cursor = await db.execute(
            f"SELECT COUNT(DISTINCT COALESCE(session_id, id)) FROM events WHERE event_type = ? AND created_at >= date('now', '-{days} days')",
            (event_type,),
        )
        funnel[event_type] = (await cursor.fetchone())[0]

    # Calculate rates
    views = funnel.get("product_viewed", 0) or 1
    result = {
        "period_days": days,
        "product_viewed": funnel.get("product_viewed", 0),
        "add_to_cart": funnel.get("add_to_cart", 0),
        "checkout_started": funnel.get("checkout_started", 0),
        "checkout_completed": funnel.get("checkout_completed", 0),
        "view_to_cart_rate": round(funnel.get("add_to_cart", 0) / views * 100, 1),
        "cart_to_checkout_rate": round(
            funnel.get("checkout_started", 0) / max(funnel.get("add_to_cart", 0), 1) * 100, 1
        ),
        "checkout_to_purchase_rate": round(
            funnel.get("checkout_completed", 0) / max(funnel.get("checkout_started", 0), 1) * 100, 1
        ),
    }
    return result


@router.get("/events")
async def list_events(
    event_type: str | None = None,
    days: int = Query(default=7, ge=1, le=365),
    limit: int = Query(default=100, ge=1, le=500),
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List recent events with optional type filter."""
    conditions = [f"created_at >= date('now', '-{days} days')"]
    params: list = []
    if event_type:
        conditions.append("event_type = ?")
        params.append(event_type)

    where = " AND ".join(conditions)
    cursor = await db.execute(
        f"SELECT * FROM events WHERE {where} ORDER BY created_at DESC LIMIT ?",
        params + [limit],
    )
    return [dict(r) for r in await cursor.fetchall()]


@router.get("/top-products")
async def top_viewed_products(
    days: int = Query(default=30, ge=1, le=365),
    limit: int = Query(default=10, ge=1, le=50),
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Most viewed products by event count."""
    cursor = await db.execute(f"""
        SELECT e.product_id, p.name, p.slug, COUNT(*) as view_count
        FROM events e
        JOIN products p ON p.id = e.product_id
        WHERE e.event_type = 'product_viewed'
          AND e.created_at >= date('now', '-{days} days')
          AND e.product_id IS NOT NULL
        GROUP BY e.product_id
        ORDER BY view_count DESC
        LIMIT ?
    """, (limit,))
    return [dict(r) for r in await cursor.fetchall()]
