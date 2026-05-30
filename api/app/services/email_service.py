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


async def send_order_cancelled(order_data: dict, reason: str = "expired") -> None:
    """Send order cancellation email to customer."""
    settings = get_settings()
    if not settings.resend_api_key:
        return

    _init_resend()

    reason_text = {
        "expired": "Your payment session expired before it could be completed.",
        "cancelled": "Your order has been cancelled.",
    }.get(reason, "Your order has been cancelled.")

    resend.Emails.send({
        "from": settings.email_from,
        "to": order_data["customer_email"],
        "subject": f"Order {order_data['order_number']} cancelled — {settings.brand_name}",
        "html": f"""
        <h2>Order Cancelled</h2>
        <p>Order <strong>{order_data['order_number']}</strong> has been cancelled.</p>
        <p>{reason_text}</p>
        <p>No charges were made. If you'd like to try again, please visit our store.</p>
        <p><a href="{settings.store_domain}">Return to Store</a></p>
        """,
    })

    logger.info("Order cancelled email sent: %s (reason: %s)", order_data["order_number"], reason)


async def send_refund_confirmation(order_data: dict, refund_amount_cents: int) -> None:
    """Send refund confirmation email to customer."""
    settings = get_settings()
    if not settings.resend_api_key:
        return

    _init_resend()

    resend.Emails.send({
        "from": settings.email_from,
        "to": order_data["customer_email"],
        "subject": f"Refund processed — {order_data['order_number']}",
        "html": f"""
        <h2>Refund Processed</h2>
        <p>Hi {order_data['customer_name']},</p>
        <p>A refund of <strong>${refund_amount_cents / 100:.2f} {settings.store_currency}</strong>
        has been issued for order <strong>{order_data['order_number']}</strong>.</p>
        <p>It may take 5–10 business days for the refund to appear on your statement,
        depending on your bank.</p>
        <p>If you have any questions, please <a href="{settings.store_domain}/contact">contact us</a>.</p>
        """,
    })

    logger.info("Refund email sent: %s ($%.2f)", order_data["order_number"], refund_amount_cents / 100)


async def send_contact_form(name: str, email: str, subject: str, message: str, order_number: str | None = None) -> None:
    """Send contact form submission to the store's contact email."""
    settings = get_settings()
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not set — skipping contact form email")
        return

    to_email = settings.contact_email
    if not to_email:
        logger.warning("CONTACT_EMAIL not set — skipping contact form email")
        return

    _init_resend()

    order_html = ""
    if order_number:
        order_html = f"<p><strong>Order Number:</strong> {order_number}</p>"

    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="border-bottom: 2px solid #eee; padding-bottom: 10px;">New Contact Form Inquiry</h2>
        <p><strong>Name:</strong> {name}</p>
        <p><strong>Email:</strong> {email}</p>
        <p><strong>Subject:</strong> {subject}</p>
        {order_html}
        <h3 style="margin-top: 20px;">Message:</h3>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #eee;">
            <p style="margin: 0; white-space: pre-wrap;">{message}</p>
        </div>
        <p style="margin-top: 30px; font-size: 12px; color: #999;">
            Sent from the {settings.brand_name} website contact form
        </p>
    </div>
    """

    resend.Emails.send({
        "from": settings.email_from,
        "to": to_email,
        "reply_to": email,
        "subject": f"Contact: {subject} — {settings.brand_name}",
        "html": html,
    })

    logger.info("Contact form email sent from %s (subject: %s)", email, subject)


async def send_password_reset(email: str, first_name: str, reset_url: str) -> None:
    """Send password reset email to customer."""
    settings = get_settings()
    if not settings.resend_api_key:
        return

    _init_resend()

    resend.Emails.send({
        "from": settings.email_from,
        "to": email,
        "subject": f"Reset your password — {settings.brand_name}",
        "html": f"""
        <h2>Password Reset</h2>
        <p>Hi {first_name},</p>
        <p>We received a request to reset your password. Click the link below to set a new one:</p>
        <p><a href="{reset_url}" style="display:inline-block;padding:12px 24px;background:#1A1A1A;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Reset Password</a></p>
        <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        """,
    })

    logger.info("Password reset email sent to %s", email)


async def send_low_stock_alert(variants: list[dict]) -> None:
    """Send low-stock alert email to admin.

    variants: list of dicts with product_name, size, color, stock_quantity
    """
    settings = get_settings()
    recipient = settings.low_stock_alert_email or settings.contact_email
    if not settings.resend_api_key or not recipient:
        return

    _init_resend()

    rows_html = "".join(
        f"<tr><td style='padding:6px 12px;border-bottom:1px solid #eee'>{v['product_name']}</td>"
        f"<td style='padding:6px 12px;border-bottom:1px solid #eee'>{v['size']}/{v['color']}</td>"
        f"<td style='padding:6px 12px;border-bottom:1px solid #eee;font-weight:bold;"
        f"color:{'#dc2626' if v['stock_quantity'] == 0 else '#ea580c'}'>{v['stock_quantity']}</td></tr>"
        for v in variants
    )

    resend.Emails.send({
        "from": settings.email_from,
        "to": recipient,
        "subject": f"Low Stock Alert — {settings.brand_name}",
        "html": f"""
        <h2>Low Stock Alert</h2>
        <p>The following variants have dropped below the threshold ({settings.low_stock_threshold} units):</p>
        <table style="border-collapse:collapse;width:100%">
        <tr style="background:#f9fafb">
            <th style="padding:8px 12px;text-align:left">Product</th>
            <th style="padding:8px 12px;text-align:left">Variant</th>
            <th style="padding:8px 12px;text-align:left">Stock</th>
        </tr>
        {rows_html}
        </table>
        <p style="margin-top:16px"><a href="{settings.store_domain}/admin/products" style="display:inline-block;padding:10px 20px;background:#1A1A1A;color:#fff;text-decoration:none;border-radius:6px">View Products</a></p>
        """,
    })

    logger.info("Low stock alert sent for %d variants", len(variants))


async def send_back_in_stock_notification(
    email: str,
    product_name: str,
    variant_desc: str,
    product_slug: str,
) -> None:
    """Send back-in-stock notification to subscriber."""
    settings = get_settings()
    if not settings.resend_api_key:
        logger.warning("Resend not configured — skipping back-in-stock email")
        return

    _init_resend()

    product_url = f"{settings.store_domain}/product/{product_slug}"

    resend.Emails.send({
        "from": settings.email_from,
        "to": email,
        "subject": f"{product_name} is back in stock! — {settings.brand_name}",
        "html": f"""
        <h2>Good news!</h2>
        <p><strong>{product_name}</strong> ({variant_desc}) is back in stock.</p>
        <p>Grab it before it sells out again:</p>
        <p style="margin-top:16px">
            <a href="{product_url}" style="display:inline-block;padding:12px 24px;background:#C53030;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">
                Shop Now
            </a>
        </p>
        <p style="margin-top:24px;font-size:12px;color:#666">
            You received this because you signed up for a back-in-stock notification at {settings.brand_name}.
        </p>
        """,
    })

    logger.info("Back-in-stock notification sent to %s for %s", email, product_name)
