from app.config import Settings
from app.services.email_templates import order_confirmation_template, shipping_notification_template

def test_order_confirmation_template_renders():
    settings = Settings(brand_name="Test Brand", store_currency="CAD", store_domain="https://test.com")
    order_data = {
        "order_number": "TEST-123",
        "customer_name": "Blair",
        "customer_email": "blair@example.com",
        "subtotal_cents": 10000,
        "shipping_cents": 1200,
        "tax_cents": 1456,
        "total_cents": 12656,
        "shipping_address_line1": "123 Main St",
        "shipping_address_city": "Toronto",
        "shipping_address_province": "ON",
        "shipping_address_postal": "M1M 1M1",
        "shipping_address_country": "CA"
    }
    items = [
        {"product_name": "Test Shirt", "variant_size": "M", "variant_color": "Black", "quantity": 1, "line_total_cents": 5000},
        {"product_name": "Test Hat", "variant_size": "OS", "variant_color": "Red", "quantity": 2, "line_total_cents": 5000}
    ]
    
    html = order_confirmation_template(order_data, items, settings)
    
    assert "Order Confirmed" in html
    assert "TEST-123" in html
    assert "TEST BRAND" in html
    assert "Test Shirt" in html
    assert "126.56" in html

def test_shipping_notification_template_renders():
    settings = Settings(brand_name="Test Brand")
    order_data = {
        "order_number": "TEST-123",
        "customer_name": "Blair",
        "tracking_carrier": "Canada Post",
        "tracking_number": "1234567890"
    }
    
    html = shipping_notification_template(order_data, settings)
    
    assert "Your Order Has Shipped!" in html
    assert "1234567890" in html
    assert "Canada Post" in html
