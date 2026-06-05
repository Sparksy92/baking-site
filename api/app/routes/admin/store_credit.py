"""Admin store credit management — issue, adjust, view per customer."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import aiosqlite

from app.auth import require_admin
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/store-credit", tags=["admin-store-credit"])


class StoreCreditIssue(BaseModel):
    customer_id: int
    amount_cents: int = Field(gt=0, description="Amount to credit (must be positive)")
    reason: str = Field(default="manual", description="Reason: manual, adjustment, goodwill, etc.")


class StoreCreditAdjust(BaseModel):
    amount_cents: int = Field(description="Positive to add, negative to deduct")
    reason: str = Field(default="adjustment")


async def _apply_credit(
    db: aiosqlite.Connection,
    customer_id: int,
    amount_cents: int,
    reason: str,
    order_id: int | None = None,
    return_request_id: int | None = None,
    issued_by: str | None = None,
) -> int:
    """
    Apply a store credit delta to a customer. Returns the new balance.
    Raises ValueError if the resulting balance would be negative.
    """
    cursor = await db.execute(
        "SELECT store_credit_cents FROM customers WHERE id = ?", (customer_id,)
    )
    row = await cursor.fetchone()
    if not row:
        raise ValueError("Customer not found")

    new_balance = row["store_credit_cents"] + amount_cents
    if new_balance < 0:
        raise ValueError(
            f"Insufficient store credit: have {row['store_credit_cents']}¢, "
            f"tried to deduct {abs(amount_cents)}¢"
        )

    await db.execute(
        "UPDATE customers SET store_credit_cents = ? WHERE id = ?",
        (new_balance, customer_id),
    )
    await db.execute(
        """INSERT INTO store_credit_transactions
           (customer_id, amount_cents, balance_after_cents, reason, order_id, return_request_id, issued_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (customer_id, amount_cents, new_balance, reason, order_id, return_request_id, issued_by),
    )
    return new_balance


@router.post("", status_code=status.HTTP_201_CREATED)
async def issue_store_credit(
    body: StoreCreditIssue,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Manually issue store credit to a customer."""
    try:
        new_balance = await _apply_credit(
            db,
            customer_id=body.customer_id,
            amount_cents=body.amount_cents,
            reason=body.reason,
            issued_by=user["sub"],
        )
        await db.commit()
        logger.info(
            "Admin %s issued %d¢ store credit to customer %d",
            user["sub"], body.amount_cents, body.customer_id,
        )
        return {"customer_id": body.customer_id, "amount_cents": body.amount_cents, "new_balance_cents": new_balance}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.patch("/{customer_id}")
async def adjust_store_credit(
    customer_id: int,
    body: StoreCreditAdjust,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Adjust (positive or negative) a customer's store credit balance."""
    try:
        new_balance = await _apply_credit(
            db,
            customer_id=customer_id,
            amount_cents=body.amount_cents,
            reason=body.reason,
            issued_by=user["sub"],
        )
        await db.commit()
        return {"customer_id": customer_id, "adjustment_cents": body.amount_cents, "new_balance_cents": new_balance}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/{customer_id}")
async def get_customer_store_credit(
    customer_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Get a customer's store credit balance and transaction history."""
    cursor = await db.execute(
        "SELECT store_credit_cents FROM customers WHERE id = ?", (customer_id,)
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    cursor = await db.execute(
        """SELECT id, amount_cents, balance_after_cents, reason, order_id,
                  return_request_id, issued_by, created_at
           FROM store_credit_transactions
           WHERE customer_id = ?
           ORDER BY created_at DESC LIMIT 100""",
        (customer_id,),
    )
    transactions = [dict(r) for r in await cursor.fetchall()]
    return {
        "customer_id": customer_id,
        "balance_cents": row["store_credit_cents"],
        "transactions": transactions,
    }
