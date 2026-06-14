from __future__ import annotations

import logging

import resend

from app.config import get_settings
from app.services.email_templates import (
    order_confirmation_template,
    shipping_notification_template,
    order_cancelled_template,
    refund_confirmation_template,
    password_reset_template,
)
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

    html = order_confirmation_template(order_data, items, settings)

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

    html = shipping_notification_template(order_data, settings)

    resend.Emails.send({
        "from": settings.email_from,
        "to": order_data["customer_email"],
        "subject": f"Your order has shipped — {order_data['order_number']}",
        "html": html,
    })

    logger.info("Shipping notification sent: %s", order_data["order_number"])


async def send_order_cancelled(order_data: dict, reason: str = "expired") -> None:
    """Send order cancellation email to customer."""
    settings = get_settings()
    if not settings.resend_api_key:
        return

    _init_resend()

    html = order_cancelled_template(order_data, reason, settings)

    resend.Emails.send({
        "from": settings.email_from,
        "to": order_data["customer_email"],
        "subject": f"Order {order_data['order_number']} cancelled — {settings.brand_name}",
        "html": html,
    })

    logger.info("Order cancelled email sent: %s (reason: %s)", order_data["order_number"], reason)


async def send_refund_confirmation(order_data: dict, refund_amount_cents: int) -> None:
    """Send refund confirmation email to customer."""
    settings = get_settings()
    if not settings.resend_api_key:
        return

    _init_resend()

    html = refund_confirmation_template(order_data, refund_amount_cents, settings)

    resend.Emails.send({
        "from": settings.email_from,
        "to": order_data["customer_email"],
        "subject": f"Refund processed — {order_data['order_number']}",
        "html": html,
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

    html = password_reset_template(first_name, reset_url, settings)

    resend.Emails.send({
        "from": settings.email_from,
        "to": email,
        "subject": f"Reset your password — {settings.brand_name}",
        "html": html,
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


async def send_order_request_notification(request_data: dict) -> None:
    """Send order request notification email to administrator (Kirstin)."""
    settings = get_settings()
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not set — skipping order request notification email")
        return

    _init_resend()

    # Destination is CONTACT_EMAIL or falls back to settings.email_from
    to_email = settings.contact_email or settings.email_from
    if not to_email:
        logger.warning("No contact email or email_from configured - skipping order request notification email")
        return

    items_html = ""
    for item in request_data.get("requested_items") or []:
        option_str = f" ({item.get('option')})" if item.get("option") else ""
        notes_str = f"<br/><small>Notes: {item.get('notes')}</small>" if item.get("notes") else ""
        items_html += f"<li>{item.get('quantity')}x {item.get('product_name')}{option_str}{notes_str}</li>"

    desired_date_str = str(request_data.get("desired_date")) if request_data.get("desired_date") else "Not specified"
    allergy_notes = request_data.get("allergy_notes") or "None"
    special_instructions = request_data.get("special_instructions") or "None"

    admin_link = f"{settings.store_domain}/admin/order-requests"

    html = f"""
    <h2>New Order Request Received</h2>
    <p><strong>Customer Details:</strong></p>
    <ul>
        <li><strong>Name:</strong> {request_data.get('customer_name')}</li>
        <li><strong>Email:</strong> {request_data.get('customer_email')}</li>
        <li><strong>Phone:</strong> {request_data.get('customer_phone') or 'Not provided'}</li>
        <li><strong>Preferred Contact:</strong> {request_data.get('preferred_contact_method')}</li>
    </ul>

    <p><strong>Order Details:</strong></p>
    <ul>
        <li><strong>Desired Date:</strong> {desired_date_str}</li>
        <li><strong>Pickup/Delivery:</strong> {request_data.get('pickup_or_delivery', 'pickup').capitalize()}</li>
        <li><strong>Allergy Notes:</strong> {allergy_notes}</li>
        <li><strong>Special Instructions:</strong> {special_instructions}</li>
    </ul>

    <p><strong>Requested Items:</strong></p>
    <ul>
        {items_html}
    </ul>

    <p style="margin-top:24px">
        <a href="{admin_link}" style="display:inline-block;padding:12px 24px;background:#6F7D5C;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">
            View in Admin Inbox (Request ID: {request_data.get('id')})
        </a>
    </p>
    """

    resend.Emails.send({
        "from": settings.email_from,
        "to": to_email,
        "subject": f"New Custom Order Request from {request_data.get('customer_name')}",
        "html": html,
    })

    logger.info("Order request notification email sent to %s for request ID %s", to_email, request_data.get("id"))

