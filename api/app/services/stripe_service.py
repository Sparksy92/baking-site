from __future__ import annotations

import logging

import stripe

from app.config import get_settings

logger = logging.getLogger(__name__)


def _get_stripe():
    settings = get_settings()
    stripe.api_key = settings.stripe_secret_key
    return stripe


async def create_checkout_session(
    order_number: str,
    items: list[dict],
    subtotal_cents: int,
    discount_cents: int,
    shipping_cents: int,
    tax_cents: int,
    total_cents: int,
    customer_email: str,
) -> tuple[str, str]:
    """Create a Stripe Checkout session. Returns (checkout_url, session_id)."""
    settings = get_settings()
    s = _get_stripe()

    line_items = []
    for item in items:
        line_items.append({
            "price_data": {
                "currency": settings.store_currency.lower(),
                "product_data": {
                    "name": f"{item['product_name']} — {item['variant_size']}/{item['variant_color']}",
                },
                "unit_amount": item["unit_price_cents"],
            },
            "quantity": item["quantity"],
        })

    # Add shipping as a line item if applicable
    if shipping_cents > 0:
        line_items.append({
            "price_data": {
                "currency": settings.store_currency.lower(),
                "product_data": {"name": "Shipping"},
                "unit_amount": shipping_cents,
            },
            "quantity": 1,
        })

    # Add tax as a line item (only if tax is enabled via TAX_RATE > 0)
    if tax_cents > 0:
        line_items.append({
            "price_data": {
                "currency": settings.store_currency.lower(),
                "product_data": {"name": "Tax"},
                "unit_amount": tax_cents,
            },
            "quantity": 1,
        })

    # Apply discount via a one-time Stripe coupon so checkout total is correct
    session_params: dict = {
        "mode": "payment",
        "customer_email": customer_email,
        "line_items": line_items,
        "metadata": {"order_number": order_number},
        "success_url": f"{settings.store_domain}/confirmation/{order_number}?session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{settings.store_domain}/cart",
    }

    if discount_cents > 0:
        coupon = s.Coupon.create(
            amount_off=discount_cents,
            currency=settings.store_currency.lower(),
            duration="once",
            name=f"Promo discount — {order_number}",
        )
        session_params["discounts"] = [{"coupon": coupon.id}]

    session = s.checkout.Session.create(**session_params)

    return session.url, session.id


async def create_payment_intent(
    order_number: str,
    total_cents: int,
    currency: str,
    customer_email: str,
) -> tuple[str, str]:
    """Create a Stripe PaymentIntent for client-side confirmation (Apple/Google Pay).

    Returns (client_secret, payment_intent_id).
    """
    s = _get_stripe()
    pi = s.PaymentIntent.create(
        amount=total_cents,
        currency=currency.lower(),
        receipt_email=customer_email,
        metadata={"order_number": order_number},
        automatic_payment_methods={"enabled": True},
    )
    logger.info("PaymentIntent created: %s for order %s", pi.id, order_number)
    return pi.client_secret, pi.id


async def create_refund(
    payment_intent_id: str,
    amount_cents: int | None = None,
    reason: str = "requested_by_customer",
) -> str:
    """Create a Stripe refund. Returns refund ID.

    If amount_cents is None, refunds the full amount.
    reason must be one of: duplicate, fraudulent, requested_by_customer
    """
    s = _get_stripe()

    params: dict = {"payment_intent": payment_intent_id}
    if amount_cents is not None:
        params["amount"] = amount_cents
    if reason in ("duplicate", "fraudulent", "requested_by_customer"):
        params["reason"] = reason

    refund = s.Refund.create(**params)
    logger.info(
        "Stripe refund created: %s (amount: %s, PI: %s)",
        refund.id, amount_cents or "full", payment_intent_id,
    )
    return refund.id


def verify_webhook_signature(payload: bytes, sig_header: str) -> dict:
    """Verify Stripe webhook signature and return event dict."""
    settings = get_settings()
    s = _get_stripe()
    event = s.Webhook.construct_event(
        payload, sig_header, settings.stripe_webhook_secret
    )
    return event
