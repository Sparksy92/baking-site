from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
import aiosqlite

from app.database import get_db
from app.services.email_service import send_payment_confirmed
from app.services.stripe_service import verify_webhook_signature

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Handle Stripe webhook events.

    Primary event: checkout.session.completed → confirm payment.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not sig_header:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing stripe-signature header")

    try:
        event = verify_webhook_signature(payload, sig_header)
    except Exception as e:
        logger.warning("Stripe webhook signature verification failed: %s", str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")

    event_type = event.get("type", "")
    logger.info("Stripe webhook received: type=%s id=%s", event_type, event.get("id"))

    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        await _handle_checkout_completed(db, session)
    else:
        logger.info("Ignoring Stripe event type: %s", event_type)

    return {"received": True}


async def _handle_checkout_completed(db: aiosqlite.Connection, session: dict) -> None:
    """Process checkout.session.completed — confirm payment on the order."""
    session_id = session.get("id")
    payment_intent = session.get("payment_intent")

    cursor = await db.execute(
        "SELECT * FROM orders WHERE stripe_session_id = ?",
        (session_id,),
    )
    order = await cursor.fetchone()

    if not order:
        logger.warning("No order found for Stripe session: %s", session_id)
        return

    # Idempotency
    if order["payment_status"] == "confirmed":
        logger.info("Order %s already confirmed — idempotent skip", order["order_number"])
        return

    await db.execute(
        """
        UPDATE orders
        SET payment_status = 'confirmed',
            stripe_payment_intent_id = ?,
            updated_at = datetime('now')
        WHERE id = ?
        """,
        (payment_intent, order["id"]),
    )
    await db.commit()

    logger.info("Payment confirmed for order %s via Stripe", order["order_number"])

    order_data = dict(order)
    order_data["payment_status"] = "confirmed"
    try:
        await send_payment_confirmed(order_data)
    except Exception:
        logger.exception("Failed to send payment confirmation email for %s", order["order_number"])
