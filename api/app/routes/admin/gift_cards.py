"""Admin gift card management."""
from __future__ import annotations

import secrets
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from app.database import PostgresConnection

from app.auth import require_admin
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/gift-cards", tags=["admin-gift-cards"])


def _generate_code() -> str:
    """Generate a 16-char alphanumeric gift card code."""
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # No I/O/0/1 for readability
    return "-".join("".join(secrets.choice(chars) for _ in range(4)) for _ in range(4))


class GiftCardCreate(BaseModel):
    initial_balance_cents: int = Field(gt=0)
    recipient_email: str | None = None
    recipient_name: str | None = None
    purchaser_email: str | None = None
    message: str | None = None
    expires_at: str | None = None


class GiftCardAdjust(BaseModel):
    amount_cents: int  # positive = add, negative = deduct
    note: str | None = None


@router.get("")
async def list_gift_cards(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    offset = (page - 1) * limit
    cursor = await db.execute("SELECT COUNT(*) FROM gift_cards")
    total = (await cursor.fetchone())[0]

    cursor = await db.execute(
        "SELECT * FROM gift_cards ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset)
    )
    return {"gift_cards": [dict(r) for r in await cursor.fetchall()], "total": total}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_gift_card(
    body: GiftCardCreate,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    code = _generate_code()

    cursor = await db.execute(
        """INSERT INTO gift_cards (code, initial_balance_cents, current_balance_cents,
                                  purchaser_email, recipient_email, recipient_name, message, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (code, body.initial_balance_cents, body.initial_balance_cents,
         body.purchaser_email, body.recipient_email, body.recipient_name,
         body.message, body.expires_at),
    )
    await db.commit()

    return {"id": cursor.lastrowid, "code": code, "balance_cents": body.initial_balance_cents}


@router.get("/{card_id}")
async def get_gift_card(
    card_id: int,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT * FROM gift_cards WHERE id = ?", (card_id,))
    card = await cursor.fetchone()
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gift card not found")

    cursor = await db.execute(
        "SELECT * FROM gift_card_transactions WHERE gift_card_id = ? ORDER BY created_at DESC",
        (card_id,),
    )
    transactions = [dict(r) for r in await cursor.fetchall()]

    result = dict(card)
    result["transactions"] = transactions
    return result


@router.post("/{card_id}/adjust")
async def adjust_balance(
    card_id: int,
    body: GiftCardAdjust,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Manually adjust gift card balance."""
    cursor = await db.execute("SELECT * FROM gift_cards WHERE id = ?", (card_id,))
    card = await cursor.fetchone()
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gift card not found")

    new_balance = card["current_balance_cents"] + body.amount_cents
    if new_balance < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient balance. Current: {card['current_balance_cents']}, adjustment: {body.amount_cents}",
        )

    await db.execute(
        "UPDATE gift_cards SET current_balance_cents = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (new_balance, card_id),
    )
    await db.execute(
        "INSERT INTO gift_card_transactions (gift_card_id, amount_cents, note) VALUES (?, ?, ?)",
        (card_id, body.amount_cents, body.note),
    )
    await db.commit()

    return {"new_balance_cents": new_balance}


@router.patch("/{card_id}/deactivate")
async def deactivate_gift_card(
    card_id: int,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT id FROM gift_cards WHERE id = ?", (card_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gift card not found")

    await db.execute(
        "UPDATE gift_cards SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (card_id,)
    )
    await db.commit()
    return {"deactivated": True}
