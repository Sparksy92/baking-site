"""Customer-facing return request endpoints."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import aiosqlite

from app.customer_auth import get_current_customer
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/returns", tags=["returns"])


class ReturnItemInput(BaseModel):
    order_item_id: int
    quantity: int = Field(ge=1)
    reason: str | None = None


class ReturnRequestCreate(BaseModel):
    order_id: int
    reason: str = Field(min_length=1, max_length=1000)
    details: str | None = None
    resolution: str = Field(default="refund", pattern="^(refund|exchange|store_credit)$")
    items: list[ReturnItemInput] = Field(min_length=1)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_return_request(
    body: ReturnRequestCreate,
    db: aiosqlite.Connection = Depends(get_db),
    customer: dict = Depends(get_current_customer),
):
    """Customer submits a return request."""
    customer_id = int(customer["sub"])

    # Verify order belongs to customer
    cursor = await db.execute(
        "SELECT * FROM orders WHERE id = ? AND customer_id = ?", (body.order_id, customer_id)
    )
    order = await cursor.fetchone()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if order["status"] not in ("delivered", "shipped"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Returns can only be requested for delivered or shipped orders",
        )

    # Check no existing open return for this order
    cursor = await db.execute(
        "SELECT id FROM return_requests WHERE order_id = ? AND status IN ('pending', 'approved')",
        (body.order_id,),
    )
    if await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A return request already exists for this order")

    # Validate items belong to order
    for item in body.items:
        cursor = await db.execute(
            "SELECT quantity FROM order_items WHERE id = ? AND order_id = ?",
            (item.order_item_id, body.order_id),
        )
        oi = await cursor.fetchone()
        if not oi:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Item {item.order_item_id} not in this order")
        if item.quantity > oi["quantity"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Return quantity exceeds ordered quantity for item {item.order_item_id}")

    # Create return request
    cursor = await db.execute(
        """INSERT INTO return_requests (order_id, customer_id, reason, details, resolution)
           VALUES (?, ?, ?, ?, ?)""",
        (body.order_id, customer_id, body.reason, body.details, body.resolution),
    )
    rr_id = cursor.lastrowid

    for item in body.items:
        await db.execute(
            "INSERT INTO return_items (return_request_id, order_item_id, quantity, reason) VALUES (?, ?, ?, ?)",
            (rr_id, item.order_item_id, item.quantity, item.reason),
        )

    await db.commit()
    return {"id": rr_id, "status": "pending"}


@router.get("")
async def list_my_returns(
    db: aiosqlite.Connection = Depends(get_db),
    customer: dict = Depends(get_current_customer),
):
    """List customer's return requests."""
    customer_id = int(customer["sub"])
    cursor = await db.execute(
        "SELECT * FROM return_requests WHERE customer_id = ? ORDER BY created_at DESC",
        (customer_id,),
    )
    return [dict(r) for r in await cursor.fetchall()]
