"""Public loyalty points endpoints — view balance and redeem."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.database import PostgresConnection

from app.customer_auth import get_current_customer
from app.database import get_db

router = APIRouter(prefix="/loyalty", tags=["loyalty"])


@router.get("/balance")
async def get_loyalty_balance(
    db: PostgresConnection = Depends(get_db),
    customer: dict = Depends(get_current_customer),
):
    """Get current loyalty points balance."""
    customer_id = int(customer["sub"])
    cursor = await db.execute(
        "SELECT loyalty_points, lifetime_points FROM customers WHERE id = ?",
        (customer_id,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    # Get active redemption rate
    cursor = await db.execute(
        "SELECT redemption_rate_cents, minimum_points_redeem FROM loyalty_rules WHERE is_active = TRUE LIMIT 1"
    )
    rule = await cursor.fetchone()

    return {
        "points": row["loyalty_points"],
        "lifetime_points": row["lifetime_points"],
        "redemption_rate_cents": rule["redemption_rate_cents"] if rule else 1,
        "minimum_redeem": rule["minimum_points_redeem"] if rule else 100,
        "redeemable_value_cents": row["loyalty_points"] * (rule["redemption_rate_cents"] if rule else 1),
    }


@router.get("/history")
async def get_loyalty_history(
    db: PostgresConnection = Depends(get_db),
    customer: dict = Depends(get_current_customer),
):
    """Get loyalty points transaction history."""
    customer_id = int(customer["sub"])
    cursor = await db.execute(
        "SELECT * FROM loyalty_transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50",
        (customer_id,),
    )
    return [dict(r) for r in await cursor.fetchall()]
