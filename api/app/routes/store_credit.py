"""Public store credit endpoints — balance and transaction history for logged-in customers."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
import aiosqlite

from app.customer_auth import get_current_customer
from app.database import get_db

router = APIRouter(prefix="/store-credit", tags=["store-credit"])


@router.get("/balance")
async def get_store_credit_balance(
    db: aiosqlite.Connection = Depends(get_db),
    customer: dict = Depends(get_current_customer),
):
    """Return the customer's current store credit balance."""
    customer_id = int(customer["sub"])
    cursor = await db.execute(
        "SELECT store_credit_cents FROM customers WHERE id = ?",
        (customer_id,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return {"store_credit_cents": row["store_credit_cents"]}


@router.get("/history")
async def get_store_credit_history(
    db: aiosqlite.Connection = Depends(get_db),
    customer: dict = Depends(get_current_customer),
):
    """Return up to 50 most recent store credit transactions."""
    customer_id = int(customer["sub"])
    cursor = await db.execute(
        """SELECT id, amount_cents, balance_after_cents, reason, order_id, created_at
           FROM store_credit_transactions
           WHERE customer_id = ?
           ORDER BY created_at DESC LIMIT 50""",
        (customer_id,),
    )
    return [dict(r) for r in await cursor.fetchall()]
