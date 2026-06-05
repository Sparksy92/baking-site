"""Admin reports — date-range filtered analytics, refunds, repeat customers, LTV."""
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


@router.get("/ltv")
async def ltv_report(
    limit: int = Query(default=50, ge=1, le=500),
    min_orders: int = Query(default=1, ge=1, description="Only include customers with at least this many orders"),
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Customer Lifetime Value report.

    Returns each customer ranked by total spend, with order count, AOV,
    first/last order date. Supports filtering by minimum order count
    to focus on repeat buyers.
    """
    cursor = await db.execute("""
        SELECT
            agg.customer_email,
            COALESCE(c.first_name || ' ' || c.last_name, NULL) AS customer_name,
            c.id AS customer_id,
            agg.order_count,
            agg.total_spent_cents,
            agg.total_spent_cents / agg.order_count AS avg_order_value_cents,
            agg.first_order_at,
            agg.last_order_at
        FROM (
            SELECT
                o.customer_email,
                MAX(o.customer_id) AS customer_id,
                COUNT(o.id) AS order_count,
                COALESCE(SUM(o.total_cents), 0) AS total_spent_cents,
                MIN(o.created_at) AS first_order_at,
                MAX(o.created_at) AS last_order_at
            FROM orders o
            WHERE o.payment_status = 'confirmed'
            GROUP BY o.customer_email
            HAVING COUNT(o.id) >= ?
        ) agg
        LEFT JOIN customers c ON c.id = agg.customer_id
        ORDER BY agg.total_spent_cents DESC
        LIMIT ?
    """, (min_orders, limit))
    rows = [dict(r) for r in await cursor.fetchall()]

    # Summary stats
    cursor = await db.execute("""
        SELECT
            COUNT(DISTINCT customer_email) AS total_customers,
            COALESCE(SUM(total_cents), 0) AS total_revenue_cents,
            COALESCE(AVG(total_cents), 0) AS avg_order_value_cents
        FROM orders
        WHERE payment_status = 'confirmed'
    """)
    summary = dict(await cursor.fetchone())

    cursor = await db.execute("""
        SELECT COUNT(*) AS repeat_customers FROM (
            SELECT customer_email
            FROM orders
            WHERE payment_status = 'confirmed'
            GROUP BY customer_email
            HAVING COUNT(*) > 1
        )
    """)
    repeat_row = dict(await cursor.fetchone())

    return {
        "summary": {
            "total_customers": summary["total_customers"],
            "repeat_customers": repeat_row["repeat_customers"],
            "total_revenue_cents": summary["total_revenue_cents"],
            "avg_order_value_cents": round(summary["avg_order_value_cents"]),
        },
        "customers": rows,
    }
