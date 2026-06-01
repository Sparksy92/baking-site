"""Automatic discount evaluation engine.

Evaluates which automatic discounts apply to a given cart at checkout time.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

import aiosqlite

logger = logging.getLogger(__name__)


async def evaluate_auto_discounts(
    db: aiosqlite.Connection,
    items: list[dict],
    subtotal_cents: int,
) -> list[dict]:
    """Evaluate all active automatic discounts against the cart.

    Args:
        items: List of cart items with keys: variant_id, product_id, category_id,
               collection_ids (list), quantity, unit_price_cents, line_total_cents
        subtotal_cents: Cart subtotal before discounts

    Returns:
        List of applicable discounts with calculated amounts, sorted by priority.
    """
    now = datetime.now(timezone.utc).isoformat()

    cursor = await db.execute("""
        SELECT * FROM automatic_discounts
        WHERE is_active = 1
          AND (starts_at IS NULL OR starts_at <= ?)
          AND (expires_at IS NULL OR expires_at >= ?)
        ORDER BY priority DESC
    """, (now, now))
    discounts = await cursor.fetchall()

    applicable = []
    total_quantity = sum(item["quantity"] for item in items)

    for disc in discounts:
        # Check minimum order
        if subtotal_cents < disc["minimum_order_cents"]:
            continue

        # Check minimum quantity
        if total_quantity < disc["minimum_quantity"]:
            continue

        # Determine which items this discount applies to
        matching_items = _get_matching_items(disc, items)
        if not matching_items:
            continue

        # Calculate discount amount
        amount = _calculate_discount_amount(disc, matching_items, subtotal_cents)
        if amount <= 0:
            continue

        # Cap if max_discount_cents is set
        if disc["max_discount_cents"] and amount > disc["max_discount_cents"]:
            amount = disc["max_discount_cents"]

        applicable.append({
            "id": disc["id"],
            "name": disc["name"],
            "discount_type": disc["discount_type"],
            "discount_value": disc["discount_value"],
            "amount_cents": amount,
            "stackable": bool(disc["stackable"]),
        })

    # Apply stacking rules: if non-stackable discount found, only keep highest
    if applicable:
        non_stackable = [d for d in applicable if not d["stackable"]]
        stackable = [d for d in applicable if d["stackable"]]

        if non_stackable:
            best_non_stackable = max(non_stackable, key=lambda d: d["amount_cents"])
            return [best_non_stackable] + stackable
        return stackable

    return []


def _get_matching_items(disc, items: list[dict]) -> list[dict]:
    """Filter items that match the discount's applies_to rule."""
    applies_to = disc["applies_to"]
    applies_to_id = disc["applies_to_id"]

    if applies_to == "all":
        return items

    if applies_to == "product":
        return [i for i in items if i.get("product_id") == applies_to_id]

    if applies_to == "category":
        return [i for i in items if i.get("category_id") == applies_to_id]

    if applies_to == "collection":
        return [i for i in items if applies_to_id in i.get("collection_ids", [])]

    return []


def _calculate_discount_amount(disc, matching_items: list[dict], subtotal_cents: int) -> int:
    """Calculate the discount amount for matching items."""
    matching_subtotal = sum(i["line_total_cents"] for i in matching_items)

    if disc["discount_type"] == "percentage":
        return int(matching_subtotal * disc["discount_value"] / 100)

    if disc["discount_type"] == "fixed_cents":
        return min(disc["discount_value"], matching_subtotal)

    if disc["discount_type"] == "buy_x_get_y":
        buy_qty = disc["buy_quantity"] or 1
        get_qty = disc["get_quantity"] or 1
        total_qty = sum(i["quantity"] for i in matching_items)

        # How many "sets" of buy_x + get_y fit in the cart
        set_size = buy_qty + get_qty
        full_sets = total_qty // set_size

        if full_sets <= 0:
            return 0

        # Discount = cheapest items × get_qty × full_sets (simplified: apply percent to get_qty items)
        # For simplicity, discount the value of get_qty items at the lowest price
        prices = sorted(
            [i["unit_price_cents"] for i in matching_items for _ in range(i["quantity"])],
        )
        free_items = full_sets * get_qty
        discount = sum(prices[:free_items]) * disc["discount_value"] // 100
        return discount

    return 0
