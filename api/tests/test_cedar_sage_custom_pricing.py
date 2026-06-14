import pytest
from httpx import AsyncClient
from unittest.mock import patch, MagicMock

# Helper to seed a product with custom attributes
async def _seed_custom_product(
    admin_client: AsyncClient, 
    slug: str, 
    price_cents: int = 1000, 
    pricing_mode: str = "fixed", 
    availability_status: str = "available",
    is_quote_only: bool = False,
    is_preorder_only: bool = False,
    is_weekend_only: bool = False
):
    # Create product with custom fields
    resp = await admin_client.post("/api/admin/products", json={
        "name": slug.replace("-", " ").title(),
        "slug": slug,
        "pricing_mode": pricing_mode,
        "availability_status": availability_status,
        "is_quote_only": is_quote_only,
        "is_preorder_only": is_preorder_only,
        "is_weekend_only": is_weekend_only,
    })
    assert resp.status_code == 201
    product_id = resp.json()["id"]

    # Create variant
    resp = await admin_client.post(f"/api/admin/products/{product_id}/variants", json={
        "size": "Standard",
        "color": "Default",
        "price_cents": price_cents,
        "stock_quantity": 10,
    })
    assert resp.status_code == 201
    variant_id = resp.json()["id"]

    return product_id, variant_id


def _checkout_body(variant_id: int):
    return {
        "customer_name": "Test Customer",
        "customer_email": "test@example.com",
        "shipping_address": {
            "line1": "123 Test St",
            "city": "Toronto",
            "province": "ON",
            "postal_code": "M5V 1A1",
            "country": "CA",
        },
        "items": [{"variant_id": variant_id, "quantity": 1}],
    }


# ── Checkout Protection Tests ─────────────────────────────────────

@pytest.mark.asyncio
async def test_checkout_zero_priced_product_rejected(admin_client: AsyncClient):
    _, variant_id = await _seed_custom_product(admin_client, "zero-price-item", price_cents=0)
    resp = await admin_client.post("/api/checkout", json=_checkout_body(variant_id))
    assert resp.status_code == 400
    assert "cannot be checked out instantly" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_checkout_quote_only_pricing_rejected(admin_client: AsyncClient):
    _, variant_id = await _seed_custom_product(admin_client, "quote-only-item", pricing_mode="quote_only")
    resp = await admin_client.post("/api/checkout", json=_checkout_body(variant_id))
    assert resp.status_code == 400
    assert "cannot be checked out instantly" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_checkout_seasonal_pricing_rejected(admin_client: AsyncClient):
    _, variant_id = await _seed_custom_product(admin_client, "seasonal-item", pricing_mode="seasonal")
    resp = await admin_client.post("/api/checkout", json=_checkout_body(variant_id))
    assert resp.status_code == 400
    assert "cannot be checked out instantly" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_checkout_unavailable_pricing_rejected(admin_client: AsyncClient):
    _, variant_id = await _seed_custom_product(admin_client, "unavailable-item", pricing_mode="unavailable")
    resp = await admin_client.post("/api/checkout", json=_checkout_body(variant_id))
    assert resp.status_code == 400
    assert "cannot be checked out instantly" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_checkout_hidden_product_rejected(admin_client: AsyncClient):
    _, variant_id = await _seed_custom_product(admin_client, "hidden-item", availability_status="hidden")
    resp = await admin_client.post("/api/checkout", json=_checkout_body(variant_id))
    assert resp.status_code == 400
    assert "cannot be checked out instantly" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_checkout_is_quote_only_rejected(admin_client: AsyncClient):
    _, variant_id = await _seed_custom_product(admin_client, "quote-flag-item", is_quote_only=True)
    resp = await admin_client.post("/api/checkout", json=_checkout_body(variant_id))
    assert resp.status_code == 400
    assert "cannot be checked out instantly" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_checkout_valid_fixed_price_success(admin_client: AsyncClient):
    _, variant_id = await _seed_custom_product(admin_client, "valid-fixed-item", price_cents=1500)
    
    mock_session = MagicMock()
    mock_session.url = "https://checkout.stripe.com/pay/test"
    mock_session.id = "cs_test"
    
    with patch("app.services.stripe_service.stripe") as mock_stripe:
        mock_stripe.checkout.Session.create.return_value = mock_session
        with patch("app.services.email_service.resend"):
            resp = await admin_client.post("/api/checkout", json=_checkout_body(variant_id))
    
    assert resp.status_code == 201
    assert "order_number" in resp.json()


# ── Order Request Tests ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_public_order_request_submitted(client: AsyncClient):
    with patch("app.services.email_service.resend") as mock_resend:
        resp = await client.post("/api/order-requests", json={
            "customer_name": "Jane Doe",
            "customer_email": "jane@example.com",
            "customer_phone": "123-456-7890",
            "preferred_contact_method": "email",
            "requested_items": [
                {
                    "product_name": "Sourdough Bread",
                    "quantity": 2,
                    "notes": "Sliced"
                }
            ],
            "pickup_or_delivery": "pickup"
        })
    assert resp.status_code == 201
    data = resp.json()
    assert data["customer_name"] == "Jane Doe"
    assert data["status"] == "new"
    assert data["requested_items"][0]["product_name"] == "Sourdough Bread"
    assert "id" in data


@pytest.mark.asyncio
async def test_order_request_persists_even_if_email_fails(client: AsyncClient):
    with patch("app.services.email_service.resend.Emails.send", side_effect=Exception("API Error")):
        resp = await client.post("/api/order-requests", json={
            "customer_name": "Jane Doe",
            "customer_email": "jane@example.com",
            "preferred_contact_method": "email",
            "requested_items": [{"product_name": "Sourdough Bread", "quantity": 1}],
            "pickup_or_delivery": "pickup"
        })
    # Database save must succeed (201 Created) even if email fails
    assert resp.status_code == 201
    assert "id" in resp.json()


@pytest.mark.asyncio
async def test_admin_can_list_order_requests(admin_client: AsyncClient, client: AsyncClient):
    # Submit a request first
    await client.post("/api/order-requests", json={
        "customer_name": "List Test",
        "customer_email": "list@example.com",
        "preferred_contact_method": "email",
        "requested_items": [{"product_name": "Cake", "quantity": 1}],
        "pickup_or_delivery": "pickup"
    })

    # Admin list endpoint
    resp = await admin_client.get("/api/admin/order-requests")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert data["order_requests"][0]["customer_name"] == "List Test"


@pytest.mark.asyncio
async def test_admin_can_update_order_request(admin_client: AsyncClient, client: AsyncClient):
    # Submit request
    create_resp = await client.post("/api/order-requests", json={
        "customer_name": "Update Test",
        "customer_email": "update@example.com",
        "preferred_contact_method": "email",
        "requested_items": [{"product_name": "Cake", "quantity": 1}],
        "pickup_or_delivery": "pickup"
    })
    req_id = create_resp.json()["id"]

    # Admin update
    patch_resp = await admin_client.patch(f"/api/admin/order-requests/{req_id}", json={
        "status": "confirmed",
        "admin_notes": "All confirmed and set!"
    })
    assert patch_resp.status_code == 200
    data = patch_resp.json()
    assert data["status"] == "confirmed"
    assert data["admin_notes"] == "All confirmed and set!"


@pytest.mark.asyncio
async def test_unauthenticated_cannot_access_admin_endpoints(client: AsyncClient):
    # List endpoint
    list_resp = await client.get("/api/admin/order-requests")
    assert list_resp.status_code == 401

    # Detail endpoint
    detail_resp = await client.get("/api/admin/order-requests/1")
    assert detail_resp.status_code == 401

    # Patch endpoint
    patch_resp = await client.patch("/api/admin/order-requests/1", json={"status": "confirmed"})
    assert patch_resp.status_code == 401
