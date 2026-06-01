"""Admin dashboard stats endpoint — server-side aggregation."""
from __future__ import annotations

from fastapi import APIRouter, Depends
import aiosqlite

from app.auth import require_admin
from app.database import get_db

router = APIRouter(prefix="/admin/dashboard", tags=["admin-dashboard"])


@router.get("/stats")
async def dashboard_stats(
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Aggregated dashboard statistics."""
    # Total orders + revenue (confirmed payments only)
    cursor = await db.execute("""
        SELECT COUNT(*) as total_orders,
               COALESCE(SUM(CASE WHEN payment_status = 'confirmed' THEN total_cents ELSE 0 END), 0) as total_revenue,
               COUNT(CASE WHEN status = 'received' THEN 1 END) as pending_orders,
               COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_orders,
               COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped_orders
        FROM orders
    """)
    row = await cursor.fetchone()

    # Revenue this month
    cursor = await db.execute("""
        SELECT COALESCE(SUM(total_cents), 0) as monthly_revenue,
               COUNT(*) as monthly_orders
        FROM orders
        WHERE payment_status = 'confirmed'
          AND created_at >= date('now', 'start of month')
    """)
    monthly = await cursor.fetchone()

    # Revenue last 7 days
    cursor = await db.execute("""
        SELECT COALESCE(SUM(total_cents), 0) as weekly_revenue,
               COUNT(*) as weekly_orders
        FROM orders
        WHERE payment_status = 'confirmed'
          AND created_at >= date('now', '-7 days')
    """)
    weekly = await cursor.fetchone()

    # Top products (by units sold, last 30 days)
    cursor = await db.execute("""
        SELECT oi.product_name, SUM(oi.quantity) as units_sold,
               SUM(oi.line_total_cents) as revenue_cents
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.payment_status = 'confirmed'
          AND o.created_at >= date('now', '-30 days')
        GROUP BY oi.product_name
        ORDER BY units_sold DESC
        LIMIT 5
    """)
    top_products = [dict(r) for r in await cursor.fetchall()]

    # Low stock variants (below 5 units)
    cursor = await db.execute("""
        SELECT p.name as product_name, pv.size, pv.color, pv.stock_quantity
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.stock_quantity <= 5 AND pv.is_active = 1 AND p.is_active = 1
        ORDER BY pv.stock_quantity ASC
        LIMIT 10
    """)
    low_stock = [dict(r) for r in await cursor.fetchall()]

    # Customer count
    cursor = await db.execute("SELECT COUNT(*) FROM customers WHERE is_active = 1")
    customer_count = (await cursor.fetchone())[0]

    # Newsletter subscribers
    cursor = await db.execute("SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active = 1")
    subscriber_count = (await cursor.fetchone())[0]

    return {
        "total_orders": row["total_orders"],
        "total_revenue_cents": row["total_revenue"],
        "pending_orders": row["pending_orders"],
        "processing_orders": row["processing_orders"],
        "shipped_orders": row["shipped_orders"],
        "monthly_revenue_cents": monthly["monthly_revenue"],
        "monthly_orders": monthly["monthly_orders"],
        "weekly_revenue_cents": weekly["weekly_revenue"],
        "weekly_orders": weekly["weekly_orders"],
        "top_products": top_products,
        "low_stock": low_stock,
        "customer_count": customer_count,
        "subscriber_count": subscriber_count,
    }
