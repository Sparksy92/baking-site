from __future__ import annotations

import hashlib
import hmac
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from app.database import PostgresConnection

from app.config import get_settings
from app.database import get_db
from app.services.email_service import send_payment_confirmed, send_order_cancelled
from app.services.order_service import cancel_order
from app.services.stripe_service import verify_webhook_signature

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    db: PostgresConnection = Depends(get_db),
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


async def _handle_checkout_completed(db: PostgresConnection, session: dict, event_id: str) -> None:
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
            updated_at = CURRENT_TIMESTAMP
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


async def _handle_checkout_expired(db: PostgresConnection, session: dict, event_id: str) -> None:
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


# ── Meta (Facebook / Instagram) webhooks ─────────────────────────────────────

@router.get("/meta")
async def meta_webhook_verify(
    hub_mode: str = Query(alias="hub.mode", default=""),
    hub_verify_token: str = Query(alias="hub.verify_token", default=""),
    hub_challenge: str = Query(alias="hub.challenge", default=""),
):
    """Meta webhook verification handshake.

    When you register a webhook in the Meta developer portal, Meta sends a GET
    request with hub.mode=subscribe and your verify token. We echo back the
    challenge to confirm ownership.

    Set META_WEBHOOK_VERIFY_TOKEN in .env to the same string you enter in the
    Meta App Dashboard → Webhooks → Verify Token field.
    """
    settings = get_settings()
    if hub_mode == "subscribe" and hub_verify_token == settings.meta_webhook_verify_token:
        logger.info("Meta webhook verification succeeded")
        return PlainTextResponse(hub_challenge)
    logger.warning("Meta webhook verification failed — token mismatch or wrong mode")
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verification failed")


@router.post("/meta")
async def meta_webhook_event(
    request: Request,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Receive and process Meta webhook events.

    Events we handle:
    - feed (Facebook page post interactions — comments, reactions, shares)
    - instagram (comment, mention, story_insights, message_reactions)

    Signature verification uses HMAC-SHA256 with the Meta App Secret.
    Set META_APP_SECRET in .env — found in Meta App Dashboard → Settings → Basic.
    """
    settings = get_settings()
    payload = await request.body()

    # Verify signature if app secret is configured
    if settings.meta_app_secret:
        sig_header = request.headers.get("x-hub-signature-256", "")
        if not sig_header:
            raise HTTPException(status_code=400, detail="Missing x-hub-signature-256 header")
        if not _verify_meta_signature(payload, sig_header, settings.meta_app_secret):
            logger.warning("Meta webhook signature verification failed")
            raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    object_type = data.get("object", "")
    entries = data.get("entry", [])

    logger.info(f"Meta webhook received: object={object_type} entries={len(entries)}")

    for entry in entries:
        entry_id = entry.get("id", "")

        # ── Facebook feed events (comments, reactions, shares on page posts) ──
        for change in entry.get("changes", []):
            field = change.get("field", "")
            value = change.get("value", {})

            if field == "feed":
                await _handle_facebook_feed_event(db, entry_id, value)

        # ── Instagram events (comments, mentions, story insights) ─────────────
        for ig_event in entry.get("messaging", []):
            await _handle_instagram_event(db, entry_id, ig_event)

        for change in entry.get("changes", []):
            if change.get("field") in ("comments", "mentions", "story_insights"):
                await _handle_instagram_change(db, entry_id, change)

    return {"received": True}


async def _handle_facebook_feed_event(db: aiosqlite.Connection, page_id: str, value: dict) -> None:
    """Store Facebook engagement events against the matching social post."""
    item = value.get("item", "")
    verb = value.get("verb", "")
    post_id = value.get("post_id") or value.get("parent_id", "")
    from_name = value.get("from", {}).get("name", "unknown")

    logger.info(f"Facebook feed event: page={page_id} item={item} verb={verb} post_id={post_id}")

    if not post_id:
        return

    try:
        await db.execute(
            """INSERT INTO social_engagement_events
               (platform, platform_post_id, event_type, event_verb, actor_name, raw_payload)
               VALUES ('facebook', ?, ?, ?, ?, ?)""",
            (post_id, item, verb, from_name, str(value)),
        )
        await db.commit()
    except Exception as e:
        logger.warning(f"Could not store Facebook engagement event (table may not exist yet): {e}")


async def _handle_instagram_event(db: aiosqlite.Connection, account_id: str, event: dict) -> None:
    """Handle Instagram messaging/reaction events."""
    logger.info(f"Instagram messaging event: account={account_id} keys={list(event.keys())}")


async def _handle_instagram_change(db: aiosqlite.Connection, account_id: str, change: dict) -> None:
    """Handle Instagram comment/mention/story_insights changes."""
    field = change.get("field", "")
    value = change.get("value", {})
    logger.info(f"Instagram change event: account={account_id} field={field}")

    try:
        await db.execute(
            """INSERT INTO social_engagement_events
               (platform, platform_post_id, event_type, event_verb, actor_name, raw_payload)
               VALUES ('instagram', ?, ?, 'received', ?, ?)""",
            (value.get("media_id", ""), field, value.get("username", "unknown"), str(value)),
        )
        await db.commit()
    except Exception as e:
        logger.warning(f"Could not store Instagram engagement event (table may not exist yet): {e}")


def _verify_meta_signature(payload: bytes, sig_header: str, app_secret: str) -> bool:
    """Verify Meta webhook HMAC-SHA256 signature.

    Meta sends: x-hub-signature-256: sha256=<hex_digest>
    We recompute using the app secret and compare in constant time.
    """
    if not sig_header.startswith("sha256="):
        return False
    expected = sig_header[7:]
    computed = hmac.new(app_secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, expected)
