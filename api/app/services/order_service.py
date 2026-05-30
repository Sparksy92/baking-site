from __future__ import annotations

import logging
import random
import string
from datetime import datetime, timezone

import aiosqlite

from app.config import get_settings
from app.models.schemas import CheckoutRequest

logger = logging.getLogger(__name__)


class CheckoutError(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code


async def validate_checkout(db: aiosqlite.Connection, body: CheckoutRequest) -> dict:
    """Validate checkout items and calculate totals.

    Returns dict with: order_items, subtotal_cents, shipping_cents, tax_cents, total_cents
    """
    settings = get_settings()
    order_items = []
    subtotal_cents = 0

    for item in body.items:
        cursor = await db.execute(
            """SELECT pv.*, p.name as product_name
               FROM product_variants pv
               JOIN products p ON p.id = pv.product_id
               WHERE pv.id = ? AND pv.is_active = 1 AND p.is_active = 1""",
            (item.variant_id,),
        )
        variant = await cursor.fetchone()

        if not variant:
            raise CheckoutError(f"Variant {item.variant_id} not found or unavailable")

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

    # Shipping
    if subtotal_cents >= settings.shipping_free_threshold_cents:
        shipping_cents = 0
    else:
        shipping_cents = settings.shipping_flat_rate_cents

    # Tax (on subtotal after discount)
    taxable = subtotal_cents - discount_cents
    tax_cents = int(taxable * settings.tax_rate)

    total_cents = subtotal_cents - discount_cents + shipping_cents + tax_cents

    return {
        "order_items": order_items,
        "subtotal_cents": subtotal_cents,
        "discount_cents": discount_cents,
        "promo_code": applied_promo,
        "shipping_cents": shipping_cents,
        "tax_cents": tax_cents,
        "total_cents": total_cents,
    }


async def create_order(
    db: aiosqlite.Connection,
    body: CheckoutRequest,
    validated: dict,
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
    await db.execute(
        """INSERT INTO orders
           (order_number, payment_method, payment_status, stripe_session_id,
            customer_name, customer_email, customer_phone,
            shipping_address_line1, shipping_address_line2,
            shipping_address_city, shipping_address_province,
            shipping_address_postal, shipping_address_country,
            subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
            promo_code, customer_notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            order_number, "stripe", payment_status, stripe_session_id,
            body.customer_name, body.customer_email, body.customer_phone,
            body.shipping_address.line1, body.shipping_address.line2,
            body.shipping_address.city, body.shipping_address.province,
            body.shipping_address.postal_code, body.shipping_address.country,
            validated["subtotal_cents"], validated["discount_cents"],
            validated["shipping_cents"], validated["tax_cents"], validated["total_cents"],
            validated["promo_code"], body.customer_notes,
        ),
    )

    # Increment promo usage
    if validated.get("promo_code"):
        await db.execute(
            "UPDATE promo_codes SET times_used = times_used + 1 WHERE code = ? COLLATE NOCASE",
            (validated["promo_code"],),
        )

    # Get order ID
    cursor = await db.execute("SELECT last_insert_rowid()")
    order_id = (await cursor.fetchone())[0]

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

    # Note: caller is responsible for commit (allows wrapping in exclusive transaction)
    logger.info("Order created: %s (total: %d cents)", order_number, validated["total_cents"])
    return order_number


async def cancel_order(db: aiosqlite.Connection, order_id: int, reason: str = "expired") -> None:
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
