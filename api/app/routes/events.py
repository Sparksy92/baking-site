"""Public event tracking endpoints — lightweight conversion funnel."""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from app.database import PostgresConnection

from app.customer_auth import get_optional_customer
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events", tags=["events"])


class EventCreate(BaseModel):
    event_type: str  # product_viewed, add_to_cart, checkout_started, checkout_completed
    session_id: str | None = None
    product_id: int | None = None
    variant_id: int | None = None
    order_id: int | None = None
    metadata: dict | None = None


ALLOWED_EVENTS = {
    "product_viewed", "add_to_cart", "remove_from_cart",
    "checkout_started", "checkout_completed", "page_viewed",
}


@router.post("", status_code=202)
async def track_event(
    body: EventCreate,
    request: Request,
    db: PostgresConnection = Depends(get_db),
    customer: dict | None = Depends(get_optional_customer),
):
    """Track a storefront event. Returns 202 (fire-and-forget)."""
    if body.event_type not in ALLOWED_EVENTS:
        return {"accepted": False, "reason": "unknown event type"}

    customer_id = int(customer["sub"]) if customer else None
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else None)
    ua = request.headers.get("user-agent", "")[:500]

    await db.execute(
        """INSERT INTO events (event_type, session_id, customer_id, product_id, variant_id, order_id, metadata_json, ip_address, user_agent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            body.event_type, body.session_id, customer_id,
            body.product_id, body.variant_id, body.order_id,
            json.dumps(body.metadata) if body.metadata else None,
            ip, ua,
        ),
    )
    await db.commit()

    return {"accepted": True}
