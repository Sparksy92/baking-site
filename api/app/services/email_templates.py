from app.config import Settings

def base_email_template(title: str, content: str, settings: Settings) -> str:
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: {settings.brand_color_background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="background-color: {settings.brand_color_primary}; padding: 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">{settings.brand_name.upper()}</h1>
            </div>
            <div style="padding: 40px 30px;">
                {content}
            </div>
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #eeeeee;">
                <p style="margin: 0; color: #6b7280; font-size: 14px;">
                    Thank you for shopping with {settings.brand_name}.<br>
                    <a href="{settings.store_domain}" style="color: {settings.brand_color_accent}; text-decoration: none;">Visit our store</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    """

def order_confirmation_template(order_data: dict, items: list[dict], settings: Settings) -> str:
    items_html = "".join(
        f"""
        <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eeeeee;">
                <div style="font-weight: 600; color: #111827;">{i['product_name']}</div>
                <div style="font-size: 13px; color: #6b7280;">{i['variant_size']} / {i['variant_color']}</div>
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eeeeee; text-align: center; color: #4b5563;">{i['quantity']}</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eeeeee; text-align: right; color: #111827;">${i['line_total_cents']/100:.2f}</td>
        </tr>
        """
        for i in items
    )
    
    tax_html = ""
    if order_data.get('tax_cents', 0) > 0:
        tax_html = f"""
        <tr>
            <td colspan="2" style="padding: 8px 0; text-align: right; color: #6b7280;">Tax:</td>
            <td style="padding: 8px 0; text-align: right; color: #111827;">${order_data['tax_cents']/100:.2f}</td>
        </tr>
        """

    intro_html = ""
    if order_data.get('payment_method') == 'etransfer':
        intro_html = f"""
        <div style="background-color: #fefce8; border: 2px solid #fef08a; padding: 20px; border-radius: 8px; margin-bottom: 24px; margin-top: 20px;">
            <h3 style="margin-top: 0; color: #854d0e; font-size: 16px;">Action Required: Send your e-Transfer</h3>
            <p style="color: #a16207; line-height: 1.5; margin-bottom: 12px;">Your order has been received, but we need your payment to fulfill it.</p>
            <p style="color: #4b5563; line-height: 1.5; margin: 0;">1. Send an e-Transfer to: <strong style="color: #111827;">{order_data.get('etransfer_email') or settings.etransfer_email}</strong></p>
            <p style="color: #4b5563; line-height: 1.5; margin: 0;">2. Include your order number in the message/memo: <strong style="color: #111827;">#{order_data['order_number']}</strong></p>
        </div>
        """
    else:
        intro_html = f"""
        <p style="color: #4b5563; line-height: 1.6;">We're getting your order ready to be shipped. We will notify you when it has been sent.</p>
        """

    content = f"""
    <h2 style="margin-top: 0; color: #111827; font-size: 20px;">Order Confirmed</h2>
    <p style="color: #4b5563; line-height: 1.6;">Hi {order_data['customer_name']},</p>
    {intro_html}
    
    <div style="margin-top: 30px; margin-bottom: 30px;">
        <h3 style="font-size: 14px; text-transform: uppercase; color: #9ca3af; letter-spacing: 1px; border-bottom: 2px solid #eeeeee; padding-bottom: 8px; margin-bottom: 16px;">Order {order_data['order_number']}</h3>
        <table style="width: 100%; border-collapse: collapse;">
            <tbody>
                {items_html}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2" style="padding: 16px 0 8px 0; text-align: right; color: #6b7280;">Subtotal:</td>
                    <td style="padding: 16px 0 8px 0; text-align: right; color: #111827;">${order_data['subtotal_cents']/100:.2f}</td>
                </tr>
                <tr>
                    <td colspan="2" style="padding: 8px 0; text-align: right; color: #6b7280;">Shipping:</td>
                    <td style="padding: 8px 0; text-align: right; color: #111827;">${order_data['shipping_cents']/100:.2f}</td>
                </tr>
                {tax_html}
                <tr>
                    <td colspan="2" style="padding: 16px 0 8px 0; text-align: right; font-weight: bold; color: #111827; font-size: 16px; border-top: 2px solid #eeeeee;">Total:</td>
                    <td style="padding: 16px 0 8px 0; text-align: right; font-weight: bold; color: #111827; font-size: 16px; border-top: 2px solid #eeeeee;">${order_data['total_cents']/100:.2f}</td>
                </tr>
            </tfoot>
        </table>
    </div>
    
    <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px;">
        <h4 style="margin-top: 0; margin-bottom: 8px; font-size: 14px; color: #111827;">Shipping Address</h4>
        <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.5;">
            {order_data['customer_name']}<br>
            {order_data['shipping_address_line1']}<br>
            {order_data.get('shipping_address_line2') + '<br>' if order_data.get('shipping_address_line2') else ''}
            {order_data['shipping_address_city']}, {order_data['shipping_address_province']} {order_data['shipping_address_postal']}<br>
            {order_data['shipping_address_country']}
        </p>
    </div>
    """
    
    return base_email_template(f"Order Confirmed - {order_data['order_number']}", content, settings)

def shipping_notification_template(order_data: dict, settings: Settings) -> str:
    tracking_html = ""
    if order_data.get("tracking_carrier") and order_data.get("tracking_number"):
        tracking_html = f"""
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px; margin-top: 24px; text-align: center;">
            <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Tracking Details</p>
            <p style="margin: 0 0 4px 0; color: #111827; font-weight: 600;">{order_data['tracking_carrier']}</p>
            <p style="margin: 0; color: {settings.brand_color_accent}; font-family: monospace; font-size: 16px;">{order_data['tracking_number']}</p>
        </div>
        """

    content = f"""
    <h2 style="margin-top: 0; color: #111827; font-size: 20px;">Your Order Has Shipped!</h2>
    <p style="color: #4b5563; line-height: 1.6;">Hi {order_data['customer_name']},</p>
    <p style="color: #4b5563; line-height: 1.6;">Great news! Order <strong>{order_data['order_number']}</strong> has been packed and is on its way to you.</p>
    
    {tracking_html}
    
    <p style="color: #4b5563; line-height: 1.6; margin-top: 24px;">If you have any questions about your order, reply to this email or contact us.</p>
    """
    
    return base_email_template(f"Order Shipped - {order_data['order_number']}", content, settings)

def order_cancelled_template(order_data: dict, reason: str, settings: Settings) -> str:
    reason_text = {
        "expired": "Your payment session expired before it could be completed.",
        "cancelled": "Your order has been cancelled.",
    }.get(reason, "Your order has been cancelled.")

    content = f"""
    <h2 style="margin-top: 0; color: #111827; font-size: 20px;">Order Cancelled</h2>
    <p style="color: #4b5563; line-height: 1.6;">Order <strong>{order_data['order_number']}</strong> has been cancelled.</p>
    <p style="color: #4b5563; line-height: 1.6;">{reason_text}</p>
    <p style="color: #4b5563; line-height: 1.6;">No charges were made. If you'd like to try again, please visit our store.</p>
    <p style="margin-top: 24px;">
        <a href="{settings.store_domain}/shop" style="display:inline-block;padding:12px 24px;background:#1A1A1A;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Return to Store</a>
    </p>
    """
    
    return base_email_template(f"Order {order_data['order_number']} cancelled", content, settings)

def refund_confirmation_template(order_data: dict, refund_amount_cents: int, settings: Settings) -> str:
    content = f"""
    <h2 style="margin-top: 0; color: #111827; font-size: 20px;">Refund Processed</h2>
    <p style="color: #4b5563; line-height: 1.6;">Hi {order_data['customer_name']},</p>
    <p style="color: #4b5563; line-height: 1.6;">A refund of <strong>${refund_amount_cents / 100:.2f} {settings.store_currency}</strong> has been issued for order <strong>{order_data['order_number']}</strong>.</p>
    <p style="color: #4b5563; line-height: 1.6;">It may take 5–10 business days for the refund to appear on your statement, depending on your bank.</p>
    <p style="color: #4b5563; line-height: 1.6; margin-top: 24px;">If you have any questions, please <a href="{settings.store_domain}/contact" style="color: {settings.brand_color_accent}; text-decoration: none;">contact us</a>.</p>
    """
    
    return base_email_template(f"Refund processed - {order_data['order_number']}", content, settings)

def password_reset_template(first_name: str, reset_url: str, settings: Settings) -> str:
    content = f"""
    <h2 style="margin-top: 0; color: #111827; font-size: 20px;">Password Reset</h2>
    <p style="color: #4b5563; line-height: 1.6;">Hi {first_name},</p>
    <p style="color: #4b5563; line-height: 1.6;">We received a request to reset your password. Click the link below to set a new one:</p>
    <p style="margin-top: 24px; margin-bottom: 24px;">
        <a href="{reset_url}" style="display:inline-block;padding:12px 24px;background:#1A1A1A;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Reset Password</a>
    </p>
    <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    """
    
    return base_email_template("Reset your password", content, settings)
