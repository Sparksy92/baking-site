from __future__ import annotations

import logging
import random
import string
from datetime import datetime, timezone

from app.database import PostgresConnection

from app.config import get_settings
from app.models.schemas import CheckoutRequest

logger = logging.getLogger(__name__)


class CheckoutError(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code


async def validate_checkout(db: PostgresConnection, body: CheckoutRequest, customer_id: int | None = None) -> dict:
    """Validate checkout items and calculate totals.

    Returns dict with: order_items, subtotal_cents, shipping_cents, tax_cents, total_cents
    """
    settings = get_settings()
    order_items = []
    subtotal_cents = 0

    for item in body.items:
        cursor = await db.execute(
            """SELECT pv.*, p.name as product_name, p.weight_g,
                      p.pricing_mode, p.availability_status, p.is_quote_only,
                      p.is_preorder_only, p.is_weekend_only
               FROM product_variants pv
               JOIN products p ON p.id = pv.product_id
               WHERE pv.id = ? AND pv.is_active = TRUE AND p.is_active = TRUE""",
            (item.variant_id,),
        )
        variant = await cursor.fetchone()

        if not variant:
            raise CheckoutError(f"Variant {item.variant_id} not found or unavailable")

        variant = dict(variant)

        # Checkout protection checks
        pricing_mode = variant.get("pricing_mode") or "fixed"
        availability_status = variant.get("availability_status") or "available"
        is_quote_only = bool(variant.get("is_quote_only"))
        is_preorder_only = bool(variant.get("is_preorder_only"))
        is_weekend_only = bool(variant.get("is_weekend_only"))
        price_cents = variant.get("price_cents") or 0

        if (
            price_cents == 0
            or pricing_mode in ("quote_only", "seasonal", "unavailable")
            or availability_status in ("sold_out", "seasonal", "quote_only", "unavailable", "hidden")
            or is_quote_only
        ):
            raise CheckoutError(
                f"Item '{variant['product_name']}' cannot be checked out instantly. Please submit an order request.",
                status_code=400
            )

        if (
            is_preorder_only
            or is_weekend_only
            or availability_status in ("preorder_only", "weekend_only")
        ):
            raise CheckoutError(
                f"Item '{variant['product_name']}' is a preorder or weekend-only item and must be requested instead of checked out instantly.",
                status_code=400
            )

        if variant["stock_quantity"] < item.quantity:
            raise CheckoutError(
                f"{variant['product_name']} ({variant['size']}/{variant['color']}) — only {variant['stock_quantity']} left in stock",
                status_code=409,
            )

        line_total = variant["price_cents"] * item.quantity
        subtotal_cents += line_total

        order_items.append({
            "variant_id": variant["id"],
            "product_id": variant["product_id"],
            "product_name": variant["product_name"],
            "variant_size": variant["size"],
            "variant_color": variant["color"],
            "unit_price_cents": variant["price_cents"],
            "quantity": item.quantity,
            "line_total_cents": line_total,
        })

    # Promo code discount
    discount_cents = 0
    applied_promo = None
    if body.promo_code:
        from app.routes.promos import _validate_promo_code, calculate_discount
        promo_result = await _validate_promo_code(db, body.promo_code, subtotal_cents)
        if promo_result.valid:
            discount_cents = calculate_discount(
                promo_result.discount_type, promo_result.discount_value, subtotal_cents
            )
            applied_promo = promo_result.code
        else:
            raise CheckoutError(promo_result.message or "Invalid promo code")

    # Calculate total order weight for shipping
    total_weight_g = 0
    for oi in order_items:
        cursor = await db.execute("SELECT weight_g FROM products WHERE id = ?", (oi["product_id"],))
        row = await cursor.fetchone()
        item_weight_g = (row["weight_g"] if row and row["weight_g"] else None)
        if item_weight_g:
            total_weight_g += item_weight_g * oi["quantity"]
    order_weight_kg = (total_weight_g / 1000.0) if total_weight_g > 0 else None

    # Shipping — read live values from DB (admin-editable), fall back to env config
    cursor = await db.execute(
        "SELECT key, value FROM settings WHERE key IN ('shipping_free_threshold_cents', 'shipping_flat_rate_cents', 'tax_rate')"
    )
    rows = await cursor.fetchall()
    db_ship = {r["key"]: r["value"] for r in rows}
    free_threshold = int(db_ship.get("shipping_free_threshold_cents") or settings.shipping_free_threshold_cents)
    flat_rate = int(db_ship.get("shipping_flat_rate_cents") or settings.shipping_flat_rate_cents)
    tax_rate = float(db_ship.get("tax_rate") or settings.tax_rate)

    if subtotal_cents >= free_threshold:
        shipping_cents = 0
    else:
        from app.services.canadapost_service import get_cheapest_rate
        cp_rate = await get_cheapest_rate(body.shipping_address.postal_code, weight_kg=order_weight_kg)
        shipping_cents = cp_rate if cp_rate is not None else flat_rate

    # Store credit redemption (applied after promo, before tax)
    store_credit_applied = 0
    if body.use_store_credit and customer_id:
        cursor = await db.execute(
            "SELECT store_credit_cents FROM customers WHERE id = ?", (customer_id,)
        )
        row = await cursor.fetchone()
        if row and row["store_credit_cents"] > 0:
            remaining_after_promo = max(0, subtotal_cents - discount_cents)
            store_credit_applied = min(row["store_credit_cents"], remaining_after_promo)
            discount_cents += store_credit_applied

    # Tax (on subtotal after discount)
    taxable = subtotal_cents - discount_cents
    tax_cents = int(taxable * tax_rate)

    total_cents = max(0, subtotal_cents - discount_cents + shipping_cents + tax_cents)

    return {
        "order_items": order_items,
        "subtotal_cents": subtotal_cents,
        "discount_cents": discount_cents,
        "promo_code": applied_promo,
        "store_credit_applied_cents": store_credit_applied,
        "shipping_cents": shipping_cents,
        "tax_cents": tax_cents,
        "total_cents": total_cents,
    }


async def create_order(
    db: PostgresConnection,
    body: CheckoutRequest,
    validated: dict,
    payment_method: str = "stripe",
    payment_status: str = "pending",
    stripe_session_id: str | None = None,
) -> str:
    """Create order and order items in the database. Returns order_number."""
    settings = get_settings()

    # Generate order number with collision retry
    for attempt in range(5):
        order_number = _generate_order_number(settings.order_number_prefix)
        cursor = await db.execute(
            "SELECT 1 FROM orders WHERE order_number = ?", (order_number,)
        )
        if not await cursor.fetchone():
            break
    else:
        raise CheckoutError("Could not generate unique order number", status_code=500)

    # Insert order
    order_cursor = await db.execute(
        """INSERT INTO orders
           (order_number, payment_method, payment_status, stripe_session_id,
            customer_name, customer_email, customer_phone,
            shipping_address_line1, shipping_address_line2,
            shipping_address_city, shipping_address_province,
            shipping_address_postal, shipping_address_country,
            subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
            promo_code, customer_notes, utm_source, utm_medium, utm_campaign)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            order_number, payment_method, payment_status, stripe_session_id,
            body.customer_name, body.customer_email, body.customer_phone,
            body.shipping_address.line1, body.shipping_address.line2,
            body.shipping_address.city, body.shipping_address.province,
            body.shipping_address.postal_code, body.shipping_address.country,
            validated["subtotal_cents"], validated["discount_cents"],
            validated["shipping_cents"], validated["tax_cents"], validated["total_cents"],
            validated["promo_code"], body.customer_notes,
            body.utm_source, body.utm_medium, body.utm_campaign,
        ),
    )
    order_id = order_cursor.lastrowid

    # Increment promo usage
    if validated.get("promo_code"):
        await db.execute(
            "UPDATE promo_codes SET times_used = times_used + 1 WHERE UPPER(code) = UPPER(?)",
            (validated["promo_code"],),
        )

    # Insert order items + decrement stock
    for item in validated["order_items"]:
        await db.execute(
            """INSERT INTO order_items
               (order_id, product_id, variant_id, product_name,
                variant_size, variant_color, unit_price_cents, quantity, line_total_cents)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                order_id, item["product_id"], item["variant_id"],
                item["product_name"], item["variant_size"], item["variant_color"],
                item["unit_price_cents"], item["quantity"], item["line_total_cents"],
            ),
        )

        # Decrement stock
        await db.execute(
            "UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?",
            (item["quantity"], item["variant_id"]),
        )

    # Check for low-stock variants after decrement
    low_stock_variants = []
    for item in validated["order_items"]:
        cursor = await db.execute(
            "SELECT stock_quantity FROM product_variants WHERE id = ?",
            (item["variant_id"],),
        )
        row = await cursor.fetchone()
        if row and row["stock_quantity"] <= settings.low_stock_threshold:
            low_stock_variants.append({
                "product_name": item["product_name"],
                "size": item["variant_size"],
                "color": item["variant_color"],
                "stock_quantity": row["stock_quantity"],
            })

    # Send alert asynchronously (don't block order creation)
    if low_stock_variants:
        try:
            from app.services.email_service import send_low_stock_alert
            await send_low_stock_alert(low_stock_variants)
        except Exception:
            logger.exception("Failed to send low-stock alert email")

    # Note: caller is responsible for commit (allows wrapping in exclusive transaction)
    logger.info("Order created: %s (total: %d cents)", order_number, validated["total_cents"])
    return order_number


async def cancel_order(db: PostgresConnection, order_id: int, reason: str = "expired") -> None:
    """Cancel an order and restore stock for its items.

    Used when a Stripe session expires or payment fails.
    """
    # Restore stock for each order item
    cursor = await db.execute(
        "SELECT variant_id, quantity FROM order_items WHERE order_id = ?", (order_id,)
    )
    items = await cursor.fetchall()

    for item in items:
        if item["variant_id"]:
            await db.execute(
                "UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?",
                (item["quantity"], item["variant_id"]),
            )

    await db.execute(
        """UPDATE orders
           SET status = 'cancelled',
               payment_status = ?,
               cancelled_at = datetime('now'),
               updated_at = datetime('now')
           WHERE id = ?""",
        (reason, order_id),
    )
    await db.commit()
    logger.info("Order %d cancelled (reason: %s), stock restored", order_id, reason)


def _generate_order_number(prefix: str) -> str:
    """Generate a unique order number like ELD-A3X7K9."""
    chars = string.ascii_uppercase + string.digits
    suffix = "".join(random.choices(chars, k=6))
    return f"{prefix}-{suffix}"
