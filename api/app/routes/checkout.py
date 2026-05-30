from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
import aiosqlite

from app.database import get_db
from app.models.schemas import CheckoutRequest, CheckoutResponse, OrderResponse, OrderItemResponse
from app.services.order_service import CheckoutError, create_order, validate_checkout
from app.services.email_service import send_order_confirmation
from app.services import stripe_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["checkout"])


@router.post("/checkout", response_model=CheckoutResponse, status_code=status.HTTP_201_CREATED)
async def checkout(
    body: CheckoutRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Create order and redirect to Stripe Checkout.

    Uses an exclusive transaction to prevent stock race conditions:
    validate stock → create order → decrement stock atomically.
    Stripe session is created after the order to avoid orphan sessions.
    """
    # Acquire exclusive lock: validate + create order + decrement stock atomically
    await db.execute("BEGIN EXCLUSIVE")
    try:
        validated = await validate_checkout(db, body)
        order_number = await create_order(
            db, body, validated,
            payment_status="pending",
            stripe_session_id=None,
        )
    except CheckoutError as e:
        await db.rollback()
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception:
        await db.rollback()
        raise

    # Create Stripe session after order exists (no orphan sessions)
    try:
        checkout_url, session_id = await stripe_service.create_checkout_session(
            order_number=order_number,
            items=validated["order_items"],
            subtotal_cents=validated["subtotal_cents"],
            discount_cents=validated["discount_cents"],
            shipping_cents=validated["shipping_cents"],
            tax_cents=validated["tax_cents"],
            total_cents=validated["total_cents"],
            customer_email=body.customer_email,
        )
    except Exception:
        logger.exception("Stripe session creation failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment service unavailable. Please try again.",
        )

    # Link Stripe session to order
    await db.execute(
        "UPDATE orders SET stripe_session_id = ? WHERE order_number = ?",
        (session_id, order_number),
    )
    await db.commit()

    # Send order confirmation email (order received, payment still pending)
    try:
        await send_order_confirmation(
            {
                "order_number": order_number,
                "customer_name": body.customer_name,
                "customer_email": body.customer_email,
                "subtotal_cents": validated["subtotal_cents"],
                "shipping_cents": validated["shipping_cents"],
                "tax_cents": validated["tax_cents"],
                "total_cents": validated["total_cents"],
            },
            validated["order_items"],
        )
    except Exception:
        logger.exception("Failed to send order confirmation email for %s", order_number)

    return CheckoutResponse(
        order_number=order_number,
        stripe_checkout_url=checkout_url,
    )


@router.get("/orders/{order_number}", response_model=OrderResponse)
async def lookup_order(
    order_number: str,
    email: str = Query(..., description="Customer email for privacy gate"),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Public order lookup — requires matching email."""
    cursor = await db.execute(
        "SELECT * FROM orders WHERE order_number = ? AND customer_email = ?",
        (order_number, email),
    )
    order = await cursor.fetchone()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found. Check the order number and email.",
        )

    # Fetch items
    cursor = await db.execute("SELECT * FROM order_items WHERE order_id = ?", (order["id"],))
    item_rows = await cursor.fetchall()

    items = [OrderItemResponse(
        product_name=item["product_name"],
        variant_size=item["variant_size"],
        variant_color=item["variant_color"],
        quantity=item["quantity"],
        unit_price_cents=item["unit_price_cents"],
        line_total_cents=item["line_total_cents"],
    ) for item in item_rows]

    return OrderResponse(
        order_number=order["order_number"],
        status=order["status"],
        payment_status=order["payment_status"],
        items=items,
        subtotal_cents=order["subtotal_cents"],
        shipping_cents=order["shipping_cents"],
        tax_cents=order["tax_cents"],
        total_cents=order["total_cents"],
        tracking_number=order["tracking_number"],
        tracking_carrier=order["tracking_carrier"],
        created_at=order["created_at"],
    )
