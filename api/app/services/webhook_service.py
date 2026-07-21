"""Outbound webhook dispatcher — sends events to configured endpoints."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone

import httpx
from app.database import PostgresConnection, db_connection

logger = logging.getLogger(__name__)


async def dispatch_event(event_type: str, payload: dict) -> None:
    """Fire outbound webhooks for a given event type.

    Called from route handlers after a significant action (order created, etc.).
    Non-blocking — failures are logged but don't affect the caller.
    """
    try:
        async with db_connection() as db:
            cursor = await db.execute(
                "SELECT * FROM webhooks WHERE is_active = TRUE"
            )
            hooks = await cursor.fetchall()

            for hook in hooks:
                events = [e.strip() for e in hook["events"].split(",")]
                if event_type not in events:
                    continue

                await _deliver(db, hook, event_type, payload)
    except Exception:
        logger.exception("Failed to dispatch webhook event: %s", event_type)


async def _deliver(db: PostgresConnection, hook: dict, event_type: str, payload: dict) -> None:
    """Attempt to deliver a single webhook."""
    body = json.dumps({
        "event": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": payload,
    })

    headers = {"Content-Type": "application/json"}
    if hook["secret"]:
        signature = hmac.new(hook["secret"].encode(), body.encode(), hashlib.sha256).hexdigest()
        headers["X-Webhook-Signature"] = f"sha256={signature}"

    response_status = None
    response_body = None
    success = False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(hook["url"], content=body, headers=headers)
            response_status = resp.status_code
            response_body = resp.text[:1000]
            success = 200 <= resp.status_code < 300
    except Exception as e:
        response_body = str(e)[:500]
        logger.warning("Webhook delivery failed: hook=%d event=%s error=%s", hook["id"], event_type, str(e))

    # Record delivery
    await db.execute(
        """INSERT INTO webhook_deliveries (webhook_id, event_type, payload_json, response_status, response_body, success)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (hook["id"], event_type, body, response_status, response_body, success),
    )
    await db.commit()
