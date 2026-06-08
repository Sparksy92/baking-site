from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from app.database import PostgresConnection

from app.customer_auth import get_optional_customer
from app.database import get_db
from app.models.schemas import CheckoutRequest, CheckoutResponse, OrderResponse, OrderItemResponse
from app.services.order_service import CheckoutError, create_order, validate_checkout
from app.routes.admin.store_credit import _apply_credit
from app.services.email_service import send_order_confirmation
from app.services import stripe_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["checkout"])


@router.post("/checkout", response_model=CheckoutResponse, status_code=status.HTTP_201_CREATED)
async def checkout(
    body: CheckoutRequest,
    request: Request,
    db: PostgresConnection = Depends(get_db),
    customer: dict | None = Depends(get_optional_customer),
):
    """Create order and redirect to Stripe Checkout.

    Uses an exclusive transaction to prevent stock race conditions:
    validate stock → create order → decrement stock atomically.
    Stripe session is created after the order to avoid orphan sessions.
    """
    # Acquire exclusive lock: validate + create order + decrement stock atomically
    customer_id = int(customer["sub"]) if customer else None

    await db.execute("BEGIN EXCLUSIVE")
    try:
        validated = await validate_checkout(db, body, customer_id=customer_id)
        order_number = await create_order(
            db, body, validated,
            payment_method=body.payment_method,
            payment_status="pending",
            stripe_session_id=None,
        )
    except CheckoutError as e:
        await db.rollback()
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception:
        await db.rollback()
        raise

    checkout_url = None
    session_id = None
    if body.payment_method == "stripe":
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
            await db.rollback()
            logger.exception("Stripe session creation failed")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Payment service unavailable. Please try again.",
            )

        # Link Stripe session (and customer account if logged in) to order
        if customer:
            await db.execute(
                "UPDATE orders SET stripe_session_id = ?, customer_id = ? WHERE order_number = ?",
                (session_id, int(customer["sub"]), order_number),
            )
        else:
            await db.execute(
                "UPDATE orders SET stripe_session_id = ? WHERE order_number = ?",
                (session_id, order_number),
            )
    else:
        # For e-transfers, just link customer if logged in
        if customer:
            await db.execute(
                "UPDATE orders SET customer_id = ? WHERE order_number = ?",
                (int(customer["sub"]), order_number),
            )
            
    # Deduct store credit if applied
    if validated.get("store_credit_applied_cents", 0) > 0 and customer_id:
        order_cursor = await db.execute(
            "SELECT id FROM orders WHERE order_number = ?", (order_number,)
        )
        order_row = await order_cursor.fetchone()
        await _apply_credit(
            db,
            customer_id=customer_id,
            amount_cents=-validated["store_credit_applied_cents"],
            reason="redemption",
            order_id=order_row["id"] if order_row else None,
        )

    await db.commit()

    # Send order confirmation email (order received, payment still pending)
    try:
        _cur = await db.execute("SELECT value FROM settings WHERE key='etransfer_email'")
        _row = await _cur.fetchone()
        etransfer_email = (_row["value"] if _row and _row["value"] else None) or settings.etransfer_email
        await send_order_confirmation(
            {
                "order_number": order_number,
                "customer_name": body.customer_name,
                "customer_email": body.customer_email,
                "payment_method": body.payment_method,
                "subtotal_cents": validated["subtotal_cents"],
                "shipping_cents": validated["shipping_cents"],
                "tax_cents": validated["tax_cents"],
                "total_cents": validated["total_cents"],
                "discount_cents": validated["discount_cents"],
                "promo_code": body.promo_code,
                "shipping_address_line1": body.shipping_address.line1,
                "shipping_address_line2": body.shipping_address.line2,
                "shipping_address_city": body.shipping_address.city,
                "shipping_address_province": body.shipping_address.province,
                "shipping_address_postal": body.shipping_address.postal_code,
                "shipping_address_country": body.shipping_address.country,
                "etransfer_email": etransfer_email,
            },
            validated["order_items"],
        )
    except Exception:
        logger.exception("Failed to send order confirmation email for %s", order_number)

    return CheckoutResponse(
        order_number=order_number,
        stripe_checkout_url=checkout_url,
        store_credit_applied_cents=validated.get("store_credit_applied_cents", 0),
    )


@router.post("/checkout/payment-intent", status_code=status.HTTP_201_CREATED)
async def create_payment_intent(
    body: CheckoutRequest,
    request: Request,
    db: PostgresConnection = Depends(get_db),
    customer: dict | None = Depends(get_optional_customer),
):
    """Create order + Stripe PaymentIntent for Apple Pay / Google Pay express checkout.

    The storefront confirms the PaymentIntent client-side via Stripe.js.
    Stripe webhook updates payment_status to 'paid' on confirmation.
    """
    customer_id = int(customer["sub"]) if customer else None

    await db.execute("BEGIN EXCLUSIVE")
    try:
        validated = await validate_checkout(db, body, customer_id=customer_id)
        order_number = await create_order(
            db, body, validated,
            payment_method="stripe",
            payment_status="pending",
            stripe_session_id=None,
        )
    except CheckoutError as e:
        await db.rollback()
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception:
        await db.rollback()
        raise

    try:
        from app.config import get_settings
        settings = get_settings()
        client_secret, pi_id = await stripe_service.create_payment_intent(
            order_number=order_number,
            total_cents=validated["total_cents"],
            currency=settings.store_currency,
            customer_email=body.customer_email,
        )
    except Exception:
        await db.rollback()
        logger.exception("PaymentIntent creation failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment service unavailable. Please try again.",
        )

    # Link payment intent and customer to order
    await db.execute(
        "UPDATE orders SET stripe_session_id = ?, customer_id = ? WHERE order_number = ?",
        (pi_id, customer_id, order_number),
    )

    # Deduct store credit if applied
    if validated.get("store_credit_applied_cents", 0) > 0 and customer_id:
        order_cursor = await db.execute(
            "SELECT id FROM orders WHERE order_number = ?", (order_number,)
        )
        order_row = await order_cursor.fetchone()
        await _apply_credit(
            db,
            customer_id=customer_id,
            amount_cents=-validated["store_credit_applied_cents"],
            reason="redemption",
            order_id=order_row["id"] if order_row else None,
        )

    await db.commit()

    return {
        "order_number": order_number,
        "client_secret": client_secret,
        "total_cents": validated["total_cents"],
        "store_credit_applied_cents": validated.get("store_credit_applied_cents", 0),
    }


@router.get("/orders/{order_number}", response_model=OrderResponse)
async def lookup_order(
    order_number: str,
    email: str = Query(..., description="Customer email for privacy gate"),
    db: PostgresConnection = Depends(get_db),
):
    """Public order lookup — requires matching email."""
    cursor = await db.execute(
        "SELECT * FROM orders WHERE order_number = ? AND LOWER(customer_email) = LOWER(?)",
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
        payment_method=order["payment_method"],
        items=items,
        subtotal_cents=order["subtotal_cents"],
        shipping_cents=order["shipping_cents"],
        tax_cents=order["tax_cents"],
        total_cents=order["total_cents"],
        tracking_number=order["tracking_number"],
        tracking_carrier=order["tracking_carrier"],
        created_at=order["created_at"],
    )
