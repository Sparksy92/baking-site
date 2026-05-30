from __future__ import annotations

import logging

import resend

from app.config import get_settings

logger = logging.getLogger(__name__)


def _init_resend():
    settings = get_settings()
    resend.api_key = settings.resend_api_key


async def send_order_confirmation(order_data: dict, items: list[dict]) -> None:
    """Send order confirmation email to customer."""
    settings = get_settings()
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not set — skipping order confirmation email")
        return

    _init_resend()

    items_html = "".join(
        f"<tr><td>{i['product_name']} ({i['variant_size']}/{i['variant_color']})</td>"
        f"<td>×{i['quantity']}</td><td>${i['line_total_cents']/100:.2f}</td></tr>"
        for i in items
    )

    html = f"""
    <h2>Order Confirmed — {order_data['order_number']}</h2>
    <p>Thank you for your order, {order_data['customer_name']}!</p>
    <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead>
        <tbody>{items_html}</tbody>
    </table>
    <p><strong>Subtotal:</strong> ${order_data['subtotal_cents']/100:.2f}</p>
    <p><strong>Shipping:</strong> ${order_data['shipping_cents']/100:.2f}</p>
    {"<p><strong>Tax:</strong> $" + f"{order_data['tax_cents']/100:.2f}</p>" if order_data.get('tax_cents', 0) > 0 else ""}
    <p><strong>Total:</strong> ${order_data['total_cents']/100:.2f}</p>
    <p>We'll email you when your order ships.</p>
    """

    resend.Emails.send({
        "from": settings.email_from,
        "to": order_data["customer_email"],
        "subject": f"Order {order_data['order_number']} — {settings.brand_name}",
        "html": html,
    })

    logger.info("Order confirmation email sent: %s", order_data["order_number"])


async def send_payment_confirmed(order_data: dict) -> None:
    """Send payment confirmed email."""
    settings = get_settings()
    if not settings.resend_api_key:
        return

    _init_resend()

    resend.Emails.send({
        "from": settings.email_from,
        "to": order_data["customer_email"],
        "subject": f"Payment received — {order_data['order_number']}",
        "html": f"""
        <h2>Payment Received</h2>
        <p>Your payment for order <strong>{order_data['order_number']}</strong> has been confirmed.</p>
        <p>We're preparing your order for shipment.</p>
        """,
    })


async def send_shipping_notification(order_data: dict) -> None:
    """Send shipping notification with tracking info."""
    settings = get_settings()
    if not settings.resend_api_key:
        return

    _init_resend()

    tracking_html = ""
    if order_data.get("tracking_carrier") and order_data.get("tracking_number"):
        tracking_html = f"<p><strong>Carrier:</strong> {order_data['tracking_carrier']}<br><strong>Tracking:</strong> {order_data['tracking_number']}</p>"

    resend.Emails.send({
        "from": settings.email_from,
        "to": order_data["customer_email"],
        "subject": f"Your order has shipped — {order_data['order_number']}",
        "html": f"""
        <h2>Your Order Has Shipped!</h2>
        <p>Order <strong>{order_data['order_number']}</strong> is on its way.</p>
        {tracking_html}
        """,
    })

    logger.info("Shipping notification sent: %s", order_data["order_number"])
