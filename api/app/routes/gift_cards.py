"""Public gift card endpoints — check balance and redeem."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.database import PostgresConnection

from app.database import get_db

router = APIRouter(prefix="/gift-cards", tags=["gift-cards"])


class GiftCardCheck(BaseModel):
    code: str


@router.post("/check")
async def check_gift_card(
    body: GiftCardCheck,
    db: PostgresConnection = Depends(get_db),
):
    """Check balance of a gift card."""
    cursor = await db.execute(
        "SELECT id, current_balance_cents, currency, is_active, expires_at FROM gift_cards WHERE code = ?",
        (body.code.upper(),),
    )
    card = await cursor.fetchone()
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gift card not found")

    if not card["is_active"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gift card is inactive")

    return {
        "balance_cents": card["current_balance_cents"],
        "currency": card["currency"],
        "expires_at": card["expires_at"],
    }
