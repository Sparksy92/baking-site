"""Back-in-stock notification subscriptions."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
import aiosqlite

from app.customer_auth import get_optional_customer
from app.database import get_db

router = APIRouter(tags=["notifications"])


class BackInStockRequest(BaseModel):
    email: EmailStr
    variant_id: int


@router.post("/notifications/back-in-stock", status_code=status.HTTP_201_CREATED)
async def subscribe_back_in_stock(
    body: BackInStockRequest,
    db: aiosqlite.Connection = Depends(get_db),
    customer: dict | None = Depends(get_optional_customer),
):
    """Subscribe to back-in-stock notification for a variant.

    Works for both logged-in customers and guests (email required).
    """
    # Verify variant exists and is actually out of stock
    cursor = await db.execute(
        "SELECT id, stock_quantity FROM product_variants WHERE id = ? AND is_active = 1",
        (body.variant_id,),
    )
    variant = await cursor.fetchone()
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    if variant["stock_quantity"] > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This item is currently in stock",
        )

    customer_id = int(customer["sub"]) if customer else None
    # Pre-fill email from logged-in customer session if available
    email = body.email if body.email else (customer.get("email") if customer else None)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required",
        )

    try:
        await db.execute(
            """INSERT INTO back_in_stock_subscriptions (email, variant_id, customer_id)
               VALUES (?, ?, ?)""",
            (email, body.variant_id, customer_id),
        )
        await db.commit()
    except aiosqlite.IntegrityError:
        pass  # Already subscribed — idempotent

    return {"subscribed": True, "variant_id": body.variant_id}


@router.get("/notifications/back-in-stock/{variant_id}")
async def check_subscription(
    variant_id: int,
    email: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Check if an email is subscribed to back-in-stock for a variant."""
    cursor = await db.execute(
        "SELECT id FROM back_in_stock_subscriptions WHERE email = ? AND variant_id = ? AND notified_at IS NULL",
        (email, variant_id),
    )
    row = await cursor.fetchone()
    return {"subscribed": row is not None}
