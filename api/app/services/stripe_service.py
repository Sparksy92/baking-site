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

    # Add tax as a line item
    if tax_cents > 0:
        line_items.append({
            "price_data": {
                "currency": settings.store_currency.lower(),
                "product_data": {"name": "Tax (HST)"},
                "unit_amount": tax_cents,
            },
            "quantity": 1,
        })

    session = s.checkout.Session.create(
        mode="payment",
        customer_email=customer_email,
        line_items=line_items,
        metadata={"order_number": order_number},
        success_url=f"{settings.store_domain}/confirmation/{order_number}?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.store_domain}/cart",
    )

    return session.url, session.id


def update_session_metadata(session_id: str, order_number: str) -> None:
    """Update Stripe session metadata with actual order number."""
    s = _get_stripe()
    s.checkout.Session.modify(session_id, metadata={"order_number": order_number})


def verify_webhook_signature(payload: bytes, sig_header: str) -> dict:
    """Verify Stripe webhook signature and return event dict."""
    settings = get_settings()
    s = _get_stripe()
    event = s.Webhook.construct_event(
        payload, sig_header, settings.stripe_webhook_secret
    )
    return event
