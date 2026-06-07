"""Abandoned cart recovery service.

Run periodically (cron or background task) to detect abandoned carts
and send recovery emails at configured intervals.
"""
from __future__ import annotations

import logging

from app.database import PostgresConnection
import resend

from app.config import get_settings
from app.services.email_service import _init_resend

logger = logging.getLogger(__name__)


async def process_abandoned_carts(db: PostgresConnection) -> dict:
    """Process all abandoned carts and send recovery emails.

    Intervals:
    - 1h after last activity: first reminder
    - 24h: second reminder
    - 72h: final reminder (urgency)

    Returns stats on emails sent.
    """
    settings = get_settings()
    if not settings.resend_api_key:
        logger.warning("Resend not configured — skipping abandoned cart emails")
        return {"sent_1h": 0, "sent_24h": 0, "sent_72h": 0}

    _init_resend()
    stats = {"sent_1h": 0, "sent_24h": 0, "sent_72h": 0}

    # Mark carts as abandoned if inactive > 1h and have email + items
    await db.execute("""
        UPDATE carts SET status = 'abandoned'
        WHERE status = 'active'
          AND customer_email IS NOT NULL
          AND subtotal_cents > 0
          AND last_activity_at < datetime('now', '-1 hour')
    """)
    await db.commit()

    # 1h reminder
    stats["sent_1h"] = await _send_reminders(
        db, settings,
        time_condition="last_activity_at < datetime('now', '-1 hour') AND last_activity_at >= datetime('now', '-2 hours')",
        flag_column="reminder_sent_1h",
        subject_template="You left something behind!",
        urgency="low",
    )

    # 24h reminder
    stats["sent_24h"] = await _send_reminders(
        db, settings,
        time_condition="last_activity_at < datetime('now', '-24 hours') AND last_activity_at >= datetime('now', '-48 hours')",
        flag_column="reminder_sent_24h",
        subject_template="Still thinking about it?",
        urgency="medium",
    )

    # 72h reminder (final)
    stats["sent_72h"] = await _send_reminders(
        db, settings,
        time_condition="last_activity_at < datetime('now', '-72 hours') AND last_activity_at >= datetime('now', '-168 hours')",
        flag_column="reminder_sent_72h",
        subject_template="Last chance — your items are going fast",
        urgency="high",
    )

    return stats


async def _send_reminders(
    db: PostgresConnection,
    settings,
    time_condition: str,
    flag_column: str,
    subject_template: str,
    urgency: str,
) -> int:
    """Send reminder emails for a specific time window."""
    cursor = await db.execute(f"""
        SELECT c.id, c.cart_token, c.customer_email, c.customer_name, c.subtotal_cents
        FROM carts c
        WHERE c.status = 'abandoned'
          AND c.{flag_column} = 0
          AND c.customer_email IS NOT NULL
          AND {time_condition}
        LIMIT 50
    """)
    carts = await cursor.fetchall()

    sent = 0
    for cart in carts:
        # Get cart items for the email
        item_cursor = await db.execute("""
            SELECT p.name, pv.size, pv.color, pv.price_cents, ci.quantity
            FROM cart_items ci
            JOIN product_variants pv ON pv.id = ci.variant_id
            JOIN products p ON p.id = pv.product_id
            WHERE ci.cart_id = ?
        """, (cart["id"],))
        items = await item_cursor.fetchall()

        if not items:
            continue

        try:
            _send_recovery_email(
                settings=settings,
                email=cart["customer_email"],
                name=cart["customer_name"],
                items=items,
                subtotal_cents=cart["subtotal_cents"],
                cart_token=cart["cart_token"],
                subject=subject_template,
                urgency=urgency,
            )

            await db.execute(
                f"UPDATE carts SET {flag_column} = 1 WHERE id = ?",
                (cart["id"],),
            )
            sent += 1
        except Exception:
            logger.exception("Failed to send abandoned cart email to %s", cart["customer_email"])

    await db.commit()
    return sent


def _send_recovery_email(
    settings,
    email: str,
    name: str | None,
    items: list,
    subtotal_cents: int,
    cart_token: str,
    subject: str,
    urgency: str,
):
    """Send the actual recovery email."""
    greeting = f"Hi {name}," if name else "Hi there,"
    recovery_url = f"{settings.store_domain}/cart?recover={cart_token}"

    items_html = "".join(
        f"<tr><td style='padding:8px 12px;border-bottom:1px solid #eee'>{item['name']}</td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #eee'>{item['size']}/{item['color']}</td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #eee'>{item['quantity']}</td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #eee'>${item['price_cents'] * item['quantity'] / 100:.2f}</td></tr>"
        for item in items
    )

    urgency_line = ""
    if urgency == "high":
        urgency_line = "<p style='color:#C53030;font-weight:bold'>Items in your cart are selling fast — don't miss out!</p>"
    elif urgency == "medium":
        urgency_line = "<p>Your items are still waiting for you.</p>"

    resend.Emails.send({
        "from": settings.email_from,
        "to": email,
        "subject": f"{subject} — {settings.brand_name}",
        "html": f"""
        <h2>{greeting}</h2>
        <p>You left some items in your cart:</p>
        {urgency_line}
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr style="background:#f9fafb">
            <th style="padding:8px 12px;text-align:left">Item</th>
            <th style="padding:8px 12px;text-align:left">Variant</th>
            <th style="padding:8px 12px;text-align:left">Qty</th>
            <th style="padding:8px 12px;text-align:left">Total</th>
        </tr>
        {items_html}
        </table>
        <p><strong>Subtotal: ${subtotal_cents / 100:.2f}</strong></p>
        <p style="margin-top:20px">
            <a href="{recovery_url}" style="display:inline-block;padding:14px 28px;background:#C53030;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px">
                Complete Your Order
            </a>
        </p>
        <p style="margin-top:24px;font-size:12px;color:#666">
            If you didn't create this cart, you can safely ignore this email.
        </p>
        """,
    })

    logger.info("Abandoned cart recovery email sent to %s (urgency=%s)", email, urgency)
