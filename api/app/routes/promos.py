from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
import aiosqlite

from app.database import get_db
from app.models.schemas import PromoValidateResponse

router = APIRouter(tags=["promos"])


@router.post("/promos/validate", response_model=PromoValidateResponse)
async def validate_promo(
    code: str,
    subtotal_cents: int = 0,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Validate a promo code and return discount info.
    Used by storefront to show discount before checkout."""
    result = await _validate_promo_code(db, code, subtotal_cents)
    return result


async def _validate_promo_code(
    db: aiosqlite.Connection, code: str, subtotal_cents: int = 0
) -> PromoValidateResponse:
    """Core promo validation logic, reused by checkout."""
    cursor = await db.execute(
        "SELECT * FROM promo_codes WHERE code = ? COLLATE NOCASE AND is_active = 1",
        (code.strip(),),
    )
    promo = await cursor.fetchone()

    if not promo:
        return PromoValidateResponse(valid=False, code=code, message="Invalid promo code")

    now = datetime.now(timezone.utc).isoformat()

    if promo["starts_at"] and now < promo["starts_at"]:
        return PromoValidateResponse(valid=False, code=code, message="This code is not active yet")

    if promo["expires_at"] and now > promo["expires_at"]:
        return PromoValidateResponse(valid=False, code=code, message="This code has expired")

    if promo["max_uses"] and promo["times_used"] >= promo["max_uses"]:
        return PromoValidateResponse(valid=False, code=code, message="This code has reached its usage limit")

    if subtotal_cents < promo["minimum_order_cents"]:
        min_order = f"${promo['minimum_order_cents'] / 100:.2f}"
        return PromoValidateResponse(
            valid=False, code=code,
            message=f"Minimum order of {min_order} required for this code",
        )

    return PromoValidateResponse(
        valid=True,
        code=promo["code"],
        discount_type=promo["discount_type"],
        discount_value=promo["discount_value"],
    )


def calculate_discount(discount_type: str, discount_value: int, subtotal_cents: int) -> int:
    """Calculate discount amount in cents."""
    if discount_type == "percent":
        return int(subtotal_cents * discount_value / 100)
    elif discount_type == "fixed_cents":
        return min(discount_value, subtotal_cents)
    return 0
