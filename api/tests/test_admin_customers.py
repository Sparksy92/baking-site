"""Admin customer management tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_admin_can_list_and_view_customers(admin_client: AsyncClient, customer_client: AsyncClient):
    resp = await admin_client.get("/api/admin/customers")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    customer = next(c for c in data["customers"] if c["email"] == "customer@test.com")
    assert customer["customer_type"] == "registered"
    assert customer["marketing_email_status"] == "non_subscribed"

    detail = await admin_client.get(f"/api/admin/customers/{customer['id']}")
    assert detail.status_code == 200
    assert detail.json()["customer"]["email"] == "customer@test.com"


@pytest.mark.asyncio
async def test_admin_can_update_customer_marketing_tags_and_notes(admin_client: AsyncClient, customer_client: AsyncClient):
    listed = await admin_client.get("/api/admin/customers?q=customer@test.com")
    customer_id = listed.json()["customers"][0]["id"]

    update = await admin_client.patch(f"/api/admin/customers/{customer_id}", json={
        "first_name": "Updated",
        "customer_type": "wholesale",
        "marketing_email_status": "subscribed",
        "marketing_email_source": "admin",
        "internal_note": "Prefers seasonal product drops.",
    })
    assert update.status_code == 200

    tags = await admin_client.put(f"/api/admin/customers/{customer_id}/tags", json={
        "tags": ["VIP", "Repeat Buyer", "VIP"],
    })
    assert tags.status_code == 200
    assert tags.json()["tags"] == ["VIP", "Repeat Buyer"]

    note = await admin_client.post(f"/api/admin/customers/{customer_id}/notes", json={
        "note": "Called about wholesale pricing.",
    })
    assert note.status_code == 201

    detail = await admin_client.get(f"/api/admin/customers/{customer_id}")
    body = detail.json()
    assert body["customer"]["first_name"] == "Updated"
    assert body["customer"]["customer_type"] == "wholesale"
    assert body["customer"]["marketing_email_status"] == "subscribed"
    assert body["tags"] == ["Repeat Buyer", "VIP"]
    assert body["notes"][0]["note"] == "Called about wholesale pricing."
    assert body["consent_events"][0]["status"] == "subscribed"

    newsletter = await admin_client.get("/api/admin/newsletter/subscribers")
    assert any(sub["email"] == "customer@test.com" for sub in newsletter.json()["subscribers"])


@pytest.mark.asyncio
async def test_admin_can_deactivate_and_reactivate_customer(admin_client: AsyncClient, customer_client: AsyncClient):
    listed = await admin_client.get("/api/admin/customers?q=customer@test.com")
    customer_id = listed.json()["customers"][0]["id"]

    resp = await admin_client.post(f"/api/admin/customers/{customer_id}/deactivate")
    assert resp.status_code == 200
    assert resp.json()["active"] is False

    detail = await admin_client.get(f"/api/admin/customers/{customer_id}")
    assert detail.json()["customer"]["is_active"] == 0

    resp = await admin_client.post(f"/api/admin/customers/{customer_id}/activate")
    assert resp.status_code == 200
    assert resp.json()["active"] is True


@pytest.mark.asyncio
async def test_admin_can_export_customers_csv(admin_client: AsyncClient, customer_client: AsyncClient):
    resp = await admin_client.get("/api/admin/customers/export")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "customer@test.com" in resp.text
    assert "marketing_email_status" in resp.text


@pytest.mark.asyncio
async def test_admin_password_reset_sends_email_and_records_note(admin_client: AsyncClient, customer_client: AsyncClient):
    listed = await admin_client.get("/api/admin/customers?q=customer@test.com")
    customer_id = listed.json()["customers"][0]["id"]

    from unittest.mock import patch
    with patch("app.services.email_service.resend"):
        resp = await admin_client.post(f"/api/admin/customers/{customer_id}/password-reset")

    assert resp.status_code == 200
    body = resp.json()
    assert body["email_sent"] is True
    assert body["reset_url"]
    assert "reset_token" not in body

    detail = await admin_client.get(f"/api/admin/customers/{customer_id}")
    assert detail.json()["notes"][0]["note"] == "Password reset email sent."


@pytest.mark.asyncio
async def test_customer_admin_requires_auth(client: AsyncClient):
    resp = await client.get("/api/admin/customers")
    assert resp.status_code == 401
