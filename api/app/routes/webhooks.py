from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
import aiosqlite

from app.database import get_db
from app.services.email_service import send_payment_confirmed, send_order_cancelled
from app.services.order_service import cancel_order
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

    event_id = event.get("id", "")

    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        await _handle_checkout_completed(db, session, event_id)
    elif event_type == "checkout.session.expired":
        session = event["data"]["object"]
        await _handle_checkout_expired(db, session, event_id)
    else:
        logger.info("Ignoring Stripe event type: %s", event_type)

    return {"received": True}


async def _handle_checkout_completed(db: aiosqlite.Connection, session: dict, event_id: str) -> None:
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

    # Idempotency — skip if already confirmed or if this event was already processed
    if order["payment_status"] == "confirmed":
        logger.info("Order %s already confirmed — idempotent skip", order["order_number"])
        return

    await db.execute(
        """
        UPDATE orders
        SET payment_status = 'confirmed',
            stripe_payment_intent_id = ?,
            stripe_event_id = ?,
            updated_at = datetime('now')
        WHERE id = ?
        """,
        (payment_intent, event_id, order["id"]),
    )
    await db.commit()

    logger.info("Payment confirmed for order %s via Stripe", order["order_number"])

    order_data = dict(order)
    order_data["payment_status"] = "confirmed"
    try:
        await send_payment_confirmed(order_data)
    except Exception:
        logger.exception("Failed to send payment confirmation email for %s", order["order_number"])


async def _handle_checkout_expired(db: aiosqlite.Connection, session: dict, event_id: str) -> None:
    """Process checkout.session.expired — cancel order and restore stock."""
    session_id = session.get("id")

    cursor = await db.execute(
        "SELECT * FROM orders WHERE stripe_session_id = ?",
        (session_id,),
    )
    order = await cursor.fetchone()

    if not order:
        logger.warning("No order found for expired Stripe session: %s", session_id)
        return

    # Idempotency — skip if already cancelled or confirmed
    if order["payment_status"] in ("confirmed", "expired"):
        logger.info("Order %s already %s — idempotent skip", order["order_number"], order["payment_status"])
        return

    await cancel_order(db, order["id"], reason="expired")
    logger.info("Order %s expired — stock restored", order["order_number"])

    try:
        await send_order_cancelled(dict(order), reason="expired")
    except Exception:
        logger.exception("Failed to send cancellation email for %s", order["order_number"])
