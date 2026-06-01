"""Admin reports — date-range filtered analytics, refunds, repeat customers."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
import aiosqlite

from app.auth import require_admin
from app.database import get_db

router = APIRouter(prefix="/admin/reports", tags=["admin-reports"])


@router.get("/sales")
async def sales_report(
    from_date: str = Query(description="Start date (YYYY-MM-DD)"),
    to_date: str = Query(description="End date (YYYY-MM-DD)"),
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Sales report for a date range: revenue, orders, AOV, refunds."""
    # Revenue & order count
    cursor = await db.execute("""
        SELECT COUNT(*) as order_count,
               COALESCE(SUM(total_cents), 0) as gross_revenue_cents,
               COALESCE(SUM(shipping_cents), 0) as total_shipping_cents,
               COALESCE(SUM(discount_cents), 0) as total_discount_cents
        FROM orders
        WHERE payment_status = 'confirmed'
          AND date(created_at) >= date(?) AND date(created_at) <= date(?)
    """, (from_date, to_date))
    sales = await cursor.fetchone()

    # Refunds in period
    cursor = await db.execute("""
        SELECT COUNT(*) as refund_count,
               COALESCE(SUM(refund_amount_cents), 0) as total_refunded_cents
        FROM orders
        WHERE payment_status = 'refunded'
          AND date(refunded_at) >= date(?) AND date(refunded_at) <= date(?)
    """, (from_date, to_date))
    refunds = await cursor.fetchone()

    # Net revenue
    net_revenue = sales["gross_revenue_cents"] - refunds["total_refunded_cents"]

    # Average order value
    aov = sales["gross_revenue_cents"] // sales["order_count"] if sales["order_count"] else 0

    # Units sold
    cursor = await db.execute("""
        SELECT COALESCE(SUM(oi.quantity), 0) as units_sold
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.payment_status = 'confirmed'
          AND date(o.created_at) >= date(?) AND date(o.created_at) <= date(?)
    """, (from_date, to_date))
    units = await cursor.fetchone()

    # New vs returning customers
    cursor = await db.execute("""
        SELECT COUNT(DISTINCT customer_email) as unique_customers
        FROM orders
        WHERE payment_status = 'confirmed'
          AND date(created_at) >= date(?) AND date(created_at) <= date(?)
    """, (from_date, to_date))
    unique = (await cursor.fetchone())["unique_customers"]

    cursor = await db.execute("""
        SELECT COUNT(*) as repeat_count FROM (
            SELECT customer_email
            FROM orders
            WHERE payment_status = 'confirmed'
              AND date(created_at) >= date(?) AND date(created_at) <= date(?)
            GROUP BY customer_email
            HAVING COUNT(*) > 1
        )
    """, (from_date, to_date))
    repeat = (await cursor.fetchone())["repeat_count"]

    # Daily breakdown
    cursor = await db.execute("""
        SELECT date(created_at) as day,
               COUNT(*) as orders,
               COALESCE(SUM(total_cents), 0) as revenue_cents
        FROM orders
        WHERE payment_status = 'confirmed'
          AND date(created_at) >= date(?) AND date(created_at) <= date(?)
        GROUP BY date(created_at)
        ORDER BY day
    """, (from_date, to_date))
    daily = [dict(r) for r in await cursor.fetchall()]

    # Top products in period
    cursor = await db.execute("""
        SELECT oi.product_name, SUM(oi.quantity) as units, SUM(oi.line_total_cents) as revenue_cents
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.payment_status = 'confirmed'
          AND date(o.created_at) >= date(?) AND date(o.created_at) <= date(?)
        GROUP BY oi.product_name
        ORDER BY units DESC
        LIMIT 10
    """, (from_date, to_date))
    top_products = [dict(r) for r in await cursor.fetchall()]

    # UTM attribution
    cursor = await db.execute("""
        SELECT utm_source, utm_medium, utm_campaign,
               COUNT(*) as orders, COALESCE(SUM(total_cents), 0) as revenue_cents
        FROM orders
        WHERE payment_status = 'confirmed'
          AND utm_source IS NOT NULL
          AND date(created_at) >= date(?) AND date(created_at) <= date(?)
        GROUP BY utm_source, utm_medium, utm_campaign
        ORDER BY revenue_cents DESC
        LIMIT 10
    """, (from_date, to_date))
    utm_breakdown = [dict(r) for r in await cursor.fetchall()]

    return {
        "period": {"from": from_date, "to": to_date},
        "order_count": sales["order_count"],
        "gross_revenue_cents": sales["gross_revenue_cents"],
        "net_revenue_cents": net_revenue,
        "total_shipping_cents": sales["total_shipping_cents"],
        "total_discount_cents": sales["total_discount_cents"],
        "average_order_value_cents": aov,
        "units_sold": units["units_sold"],
        "refund_count": refunds["refund_count"],
        "total_refunded_cents": refunds["total_refunded_cents"],
        "unique_customers": unique,
        "repeat_customers": repeat,
        "repeat_customer_rate": round(repeat / max(unique, 1) * 100, 1),
        "daily": daily,
        "top_products": top_products,
        "utm_attribution": utm_breakdown,
    }
