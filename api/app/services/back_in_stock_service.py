"""Back-in-stock notification trigger.

Called when a variant's stock is updated from 0 to > 0.
Sends emails to all subscribers and marks them as notified.
"""
from __future__ import annotations

import logging

from app.database import PostgresConnection

from app.services.email_service import send_back_in_stock_notification

logger = logging.getLogger(__name__)


async def notify_back_in_stock(db: PostgresConnection, variant_id: int) -> int:
    """Send back-in-stock emails for a variant that was restocked.

    Returns the number of notifications sent.
    """
    # Get variant + product info
    cursor = await db.execute("""
        SELECT pv.id, pv.size, pv.color, pv.stock_quantity,
               p.name as product_name, p.slug as product_slug
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = ?
    """, (variant_id,))
    variant = await cursor.fetchone()

    if not variant or variant["stock_quantity"] <= 0:
        return 0

    # Get pending subscribers (not yet notified)
    cursor = await db.execute(
        "SELECT id, email FROM back_in_stock_subscriptions WHERE variant_id = ? AND notified_at IS NULL",
        (variant_id,),
    )
    subscribers = await cursor.fetchall()

    if not subscribers:
        return 0

    variant_desc = f"{variant['size']} / {variant['color']}"
    sent = 0

    for sub in subscribers:
        try:
            await send_back_in_stock_notification(
                email=sub["email"],
                product_name=variant["product_name"],
                variant_desc=variant_desc,
                product_slug=variant["product_slug"],
            )
            # Mark as notified
            await db.execute(
                "UPDATE back_in_stock_subscriptions SET notified_at = datetime('now') WHERE id = ?",
                (sub["id"],),
            )
            sent += 1
        except Exception:
            logger.exception("Failed to send back-in-stock email to %s", sub["email"])

    await db.commit()
    logger.info("Sent %d back-in-stock notifications for variant %d", sent, variant_id)
    return sent
