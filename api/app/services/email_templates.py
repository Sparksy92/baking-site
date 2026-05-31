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

    content = f"""
    <h2 style="margin-top: 0; color: #111827; font-size: 20px;">Order Confirmed</h2>
    <p style="color: #4b5563; line-height: 1.6;">Hi {order_data['customer_name']},</p>
    <p style="color: #4b5563; line-height: 1.6;">We're getting your order ready to be shipped. We will notify you when it has been sent.</p>
    
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
