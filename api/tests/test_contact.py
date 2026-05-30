"""Contact form endpoint tests."""
from unittest.mock import patch

import pytest
from httpx import AsyncClient


VALID_CONTACT = {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "subject": "Order Question",
    "message": "Hi, I have a question about my recent order.",
}


@pytest.mark.asyncio
async def test_contact_form_success(client: AsyncClient):
    with patch("app.services.email_service.resend"):
        resp = await client.post("/api/contact", json=VALID_CONTACT)
    assert resp.status_code == 200
    assert resp.json()["success"] is True


@pytest.mark.asyncio
async def test_contact_form_with_order_number(client: AsyncClient):
    body = {**VALID_CONTACT, "order_number": "TST-ABC123"}
    with patch("app.services.email_service.resend"):
        resp = await client.post("/api/contact", json=body)
    assert resp.status_code == 200
    assert resp.json()["success"] is True


@pytest.mark.asyncio
async def test_contact_form_missing_name(client: AsyncClient):
    body = {**VALID_CONTACT}
    del body["name"]
    resp = await client.post("/api/contact", json=body)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_contact_form_missing_email(client: AsyncClient):
    body = {**VALID_CONTACT}
    del body["email"]
    resp = await client.post("/api/contact", json=body)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_contact_form_invalid_email(client: AsyncClient):
    body = {**VALID_CONTACT, "email": "not-an-email"}
    resp = await client.post("/api/contact", json=body)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_contact_form_message_too_short(client: AsyncClient):
    body = {**VALID_CONTACT, "message": "Hi"}
    resp = await client.post("/api/contact", json=body)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_contact_form_default_subject(client: AsyncClient):
    body = {"name": "John", "email": "john@test.com", "message": "Just saying hello to the team!"}
    with patch("app.services.email_service.resend"):
        resp = await client.post("/api/contact", json=body)
    assert resp.status_code == 200
