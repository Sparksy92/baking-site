"""Admin webhook management — configure outbound event webhooks."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
import aiosqlite

from app.auth import require_admin
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/webhooks", tags=["admin-webhooks"])

VALID_EVENTS = {
    "order.created", "order.completed", "order.cancelled", "order.refunded",
    "customer.created", "newsletter.subscribed",
    "return.requested", "return.approved", "return.received",
}


class WebhookCreate(BaseModel):
    url: str = Field(min_length=1)
    events: str = Field(min_length=1)  # comma-separated
    secret: str | None = None


class WebhookUpdate(BaseModel):
    url: str | None = None
    events: str | None = None
    secret: str | None = None
    is_active: bool | None = None


@router.get("")
async def list_webhooks(
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT * FROM webhooks ORDER BY created_at DESC")
    return [dict(r) for r in await cursor.fetchall()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_webhook(
    body: WebhookCreate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    # Validate events
    events = [e.strip() for e in body.events.split(",")]
    invalid = [e for e in events if e not in VALID_EVENTS]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid events: {invalid}. Valid: {sorted(VALID_EVENTS)}",
        )

    cursor = await db.execute(
        "INSERT INTO webhooks (url, events, secret) VALUES (?, ?, ?)",
        (body.url, ",".join(events), body.secret),
    )
    await db.commit()
    return {"id": cursor.lastrowid}


@router.patch("/{webhook_id}")
async def update_webhook(
    webhook_id: int,
    body: WebhookUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT id FROM webhooks WHERE id = ?", (webhook_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")

    updates = {}
    for k, v in body.model_dump().items():
        if v is not None:
            if k == "is_active":
                updates[k] = int(v)
            elif k == "events":
                events = [e.strip() for e in v.split(",")]
                invalid = [e for e in events if e not in VALID_EVENTS]
                if invalid:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid events: {invalid}")
                updates[k] = ",".join(events)
            else:
                updates[k] = v

    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields")

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [webhook_id]
    await db.execute(f"UPDATE webhooks SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?", values)
    await db.commit()
    return {"updated": True}


@router.delete("/{webhook_id}")
async def delete_webhook(
    webhook_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT id FROM webhooks WHERE id = ?", (webhook_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")

    await db.execute("DELETE FROM webhooks WHERE id = ?", (webhook_id,))
    await db.commit()
    return {"deleted": True}


@router.get("/{webhook_id}/deliveries")
async def list_deliveries(
    webhook_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List recent delivery attempts for a webhook."""
    cursor = await db.execute(
        "SELECT * FROM webhook_deliveries WHERE webhook_id = ? ORDER BY created_at DESC LIMIT ?",
        (webhook_id, limit),
    )
    return [dict(r) for r in await cursor.fetchall()]
