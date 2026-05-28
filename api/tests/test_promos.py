"""Promo code API tests — admin CRUD, validation, discount calculation."""
import pytest
from httpx import AsyncClient


# ── Helpers ─────────────────────────────────────────────────

async def _create_promo(
    admin_client: AsyncClient,
    code: str = "SAVE20",
    discount_type: str = "percent",
    discount_value: int = 20,
    minimum_order_cents: int = 0,
    max_uses: int | None = None,
    is_active: bool = True,
) -> dict:
    resp = await admin_client.post("/api/admin/promos", json={
        "code": code,
        "description": f"Test promo {code}",
        "discount_type": discount_type,
        "discount_value": discount_value,
        "minimum_order_cents": minimum_order_cents,
        "max_uses": max_uses,
        "is_active": is_active,
    })
    assert resp.status_code == 201
    return resp.json()


# ── Admin CRUD ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_create_promo(admin_client: AsyncClient):
    data = await _create_promo(admin_client, code="NEW10")
    assert data["code"] == "NEW10"
    assert "id" in data


@pytest.mark.asyncio
async def test_admin_list_promos(admin_client: AsyncClient):
    await _create_promo(admin_client, code="CODE1")
    await _create_promo(admin_client, code="CODE2")

    resp = await admin_client.get("/api/admin/promos")
    assert resp.status_code == 200
    promos = resp.json()
    assert len(promos) == 2
    codes = {p["code"] for p in promos}
    assert "CODE1" in codes
    assert "CODE2" in codes


@pytest.mark.asyncio
async def test_admin_update_promo(admin_client: AsyncClient):
    data = await _create_promo(admin_client, code="UPD1")
    resp = await admin_client.patch(f"/api/admin/promos/{data['id']}", json={
        "discount_value": 30,
    })
    assert resp.status_code == 200
    assert resp.json()["updated"] is True


@pytest.mark.asyncio
async def test_admin_deactivate_promo(admin_client: AsyncClient):
    data = await _create_promo(admin_client, code="DEACT")
    resp = await admin_client.patch(f"/api/admin/promos/{data['id']}", json={
        "is_active": False,
    })
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_admin_delete_promo(admin_client: AsyncClient):
    data = await _create_promo(admin_client, code="DEL1")
    resp = await admin_client.delete(f"/api/admin/promos/{data['id']}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True

    # Verify gone
    resp2 = await admin_client.get("/api/admin/promos")
    assert len(resp2.json()) == 0


@pytest.mark.asyncio
async def test_admin_duplicate_code_rejected(admin_client: AsyncClient):
    await _create_promo(admin_client, code="UNIQUE")
    resp = await admin_client.post("/api/admin/promos", json={
        "code": "UNIQUE",
        "discount_type": "percent",
        "discount_value": 10,
    })
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_admin_promo_requires_auth(client: AsyncClient):
    """Unauthenticated user cannot access admin promo endpoints."""
    resp = await client.get("/api/admin/promos")
    assert resp.status_code == 401

    resp2 = await client.post("/api/admin/promos", json={
        "code": "HACK", "discount_type": "percent", "discount_value": 99,
    })
    assert resp2.status_code == 401


# ── Promo Validation ────────────────────────────────────────

@pytest.mark.asyncio
async def test_validate_valid_promo(admin_client: AsyncClient, client: AsyncClient):
    await _create_promo(admin_client, code="VALID20", discount_type="percent", discount_value=20)

    resp = await client.post("/api/promos/validate?code=VALID20&subtotal_cents=5000")
    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is True
    assert data["discount_type"] == "percent"
    assert data["discount_value"] == 20


@pytest.mark.asyncio
async def test_validate_invalid_code(client: AsyncClient):
    resp = await client.post("/api/promos/validate?code=DOESNOTEXIST")
    data = resp.json()
    assert data["valid"] is False
    assert "Invalid" in data["message"]


@pytest.mark.asyncio
async def test_validate_case_insensitive(admin_client: AsyncClient, client: AsyncClient):
    await _create_promo(admin_client, code="CASEMIX")
    resp = await client.post("/api/promos/validate?code=casemix")
    assert resp.json()["valid"] is True


@pytest.mark.asyncio
async def test_validate_inactive_promo(admin_client: AsyncClient, client: AsyncClient):
    data = await _create_promo(admin_client, code="INACTIVE", is_active=True)
    await admin_client.patch(f"/api/admin/promos/{data['id']}", json={"is_active": False})

    resp = await client.post("/api/promos/validate?code=INACTIVE")
    assert resp.json()["valid"] is False


@pytest.mark.asyncio
async def test_validate_minimum_order_not_met(admin_client: AsyncClient, client: AsyncClient):
    await _create_promo(admin_client, code="MIN50", minimum_order_cents=5000)

    resp = await client.post("/api/promos/validate?code=MIN50&subtotal_cents=2000")
    data = resp.json()
    assert data["valid"] is False
    assert "Minimum" in data["message"]


@pytest.mark.asyncio
async def test_validate_minimum_order_met(admin_client: AsyncClient, client: AsyncClient):
    await _create_promo(admin_client, code="MIN50OK", minimum_order_cents=5000)

    resp = await client.post("/api/promos/validate?code=MIN50OK&subtotal_cents=6000")
    assert resp.json()["valid"] is True


@pytest.mark.asyncio
async def test_validate_expired_promo(admin_client: AsyncClient, client: AsyncClient):
    await admin_client.post("/api/admin/promos", json={
        "code": "EXPIRED",
        "discount_type": "percent",
        "discount_value": 10,
        "expires_at": "2020-01-01T00:00:00Z",
        "is_active": True,
    })

    resp = await client.post("/api/promos/validate?code=EXPIRED")
    data = resp.json()
    assert data["valid"] is False
    assert "expired" in data["message"].lower()


@pytest.mark.asyncio
async def test_validate_fixed_cents_discount(admin_client: AsyncClient, client: AsyncClient):
    await _create_promo(admin_client, code="FLAT500", discount_type="fixed_cents", discount_value=500)

    resp = await client.post("/api/promos/validate?code=FLAT500&subtotal_cents=3000")
    data = resp.json()
    assert data["valid"] is True
    assert data["discount_type"] == "fixed_cents"
    assert data["discount_value"] == 500


# ── Discount Calculation (unit-level) ───────────────────────

def test_calculate_percent_discount():
    from app.routes.promos import calculate_discount
    assert calculate_discount("percent", 20, 10000) == 2000  # 20% of $100


def test_calculate_fixed_discount():
    from app.routes.promos import calculate_discount
    assert calculate_discount("fixed_cents", 500, 3000) == 500  # $5 off $30


def test_calculate_fixed_discount_capped_at_subtotal():
    from app.routes.promos import calculate_discount
    assert calculate_discount("fixed_cents", 5000, 3000) == 3000  # can't exceed subtotal


def test_calculate_unknown_type():
    from app.routes.promos import calculate_discount
    assert calculate_discount("bogus", 100, 5000) == 0
