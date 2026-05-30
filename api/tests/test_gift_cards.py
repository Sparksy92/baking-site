"""Gift card tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_gift_card(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/gift-cards", json={
        "initial_balance_cents": 5000, "recipient_email": "friend@test.com",
    })
    assert resp.status_code == 201
    assert resp.json()["balance_cents"] == 5000
    assert len(resp.json()["code"]) > 0


@pytest.mark.asyncio
async def test_check_gift_card_balance(admin_client: AsyncClient, client: AsyncClient):
    resp = await admin_client.post("/api/admin/gift-cards", json={"initial_balance_cents": 2500})
    code = resp.json()["code"]

    resp = await client.post("/api/gift-cards/check", json={"code": code})
    assert resp.status_code == 200
    assert resp.json()["balance_cents"] == 2500


@pytest.mark.asyncio
async def test_check_nonexistent_card(client: AsyncClient):
    resp = await client.post("/api/gift-cards/check", json={"code": "FAKE-CODE-1234"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_adjust_gift_card(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/gift-cards", json={"initial_balance_cents": 5000})
    card_id = resp.json()["id"]

    resp = await admin_client.post(f"/api/admin/gift-cards/{card_id}/adjust", json={
        "amount_cents": -1000, "note": "Partial redemption",
    })
    assert resp.status_code == 200
    assert resp.json()["new_balance_cents"] == 4000


@pytest.mark.asyncio
async def test_overdraw_rejected(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/gift-cards", json={"initial_balance_cents": 1000})
    card_id = resp.json()["id"]

    resp = await admin_client.post(f"/api/admin/gift-cards/{card_id}/adjust", json={
        "amount_cents": -5000,
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_deactivate_gift_card(admin_client: AsyncClient, client: AsyncClient):
    resp = await admin_client.post("/api/admin/gift-cards", json={"initial_balance_cents": 3000})
    card_id = resp.json()["id"]
    code = resp.json()["code"]

    resp = await admin_client.patch(f"/api/admin/gift-cards/{card_id}/deactivate")
    assert resp.status_code == 200

    resp = await client.post("/api/gift-cards/check", json={"code": code})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_get_gift_card_with_transactions(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/gift-cards", json={"initial_balance_cents": 5000})
    card_id = resp.json()["id"]
    await admin_client.post(f"/api/admin/gift-cards/{card_id}/adjust", json={"amount_cents": -500, "note": "test"})

    resp = await admin_client.get(f"/api/admin/gift-cards/{card_id}")
    assert resp.status_code == 200
    assert len(resp.json()["transactions"]) == 1


@pytest.mark.asyncio
async def test_list_gift_cards(admin_client: AsyncClient):
    await admin_client.post("/api/admin/gift-cards", json={"initial_balance_cents": 1000})
    resp = await admin_client.get("/api/admin/gift-cards")
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


@pytest.mark.asyncio
async def test_gift_cards_admin_require_auth(client: AsyncClient):
    assert (await client.get("/api/admin/gift-cards")).status_code == 401
