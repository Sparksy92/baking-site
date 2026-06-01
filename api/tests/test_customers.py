"""Customer account tests — registration, login, logout, profile, password management."""
import pytest
from httpx import AsyncClient


# ── Registration ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_creates_customer(client: AsyncClient):
    resp = await client.post("/api/customers/register", json={
        "email": "new@example.com",
        "password": "SecurePass1",
        "first_name": "Jane",
        "last_name": "Doe",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "new@example.com"
    assert data["first_name"] == "Jane"
    assert "id" in data


@pytest.mark.asyncio
async def test_register_auto_login_sets_cookie(client: AsyncClient):
    resp = await client.post("/api/customers/register", json={
        "email": "cookie@example.com",
        "password": "SecurePass1",
        "first_name": "Cookie",
        "last_name": "Test",
    })
    assert resp.status_code == 201
    # Cookie should be set — verify we can call /me
    resp2 = await client.get("/api/customers/me")
    assert resp2.status_code == 200
    assert resp2.json()["email"] == "cookie@example.com"


@pytest.mark.asyncio
async def test_register_duplicate_email_rejected(client: AsyncClient):
    await client.post("/api/customers/register", json={
        "email": "dupe@example.com",
        "password": "SecurePass1",
        "first_name": "First",
        "last_name": "User",
    })
    resp = await client.post("/api/customers/register", json={
        "email": "dupe@example.com",
        "password": "DifferentPass1",
        "first_name": "Second",
        "last_name": "User",
    })
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_register_duplicate_email_case_insensitive(client: AsyncClient):
    await client.post("/api/customers/register", json={
        "email": "CaseTest@Example.com",
        "password": "SecurePass1",
        "first_name": "First",
        "last_name": "User",
    })
    resp = await client.post("/api/customers/register", json={
        "email": "casetest@example.com",
        "password": "DifferentPass1",
        "first_name": "Second",
        "last_name": "User",
    })
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_register_short_password_rejected(client: AsyncClient):
    resp = await client.post("/api/customers/register", json={
        "email": "short@example.com",
        "password": "abc",
        "first_name": "Short",
        "last_name": "Pw",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_invalid_email_rejected(client: AsyncClient):
    resp = await client.post("/api/customers/register", json={
        "email": "not-an-email",
        "password": "SecurePass1",
        "first_name": "Bad",
        "last_name": "Email",
    })
    assert resp.status_code == 422


# ── Login ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_success(customer_client: AsyncClient):
    """customer_client fixture registers and auto-logins — verify /me works."""
    resp = await customer_client.get("/api/customers/me")
    assert resp.status_code == 200
    assert resp.json()["email"] == "customer@test.com"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    await client.post("/api/customers/register", json={
        "email": "login@example.com",
        "password": "CorrectPass1",
        "first_name": "Login",
        "last_name": "Test",
    })
    # Logout first
    await client.post("/api/customers/logout")
    resp = await client.post("/api/customers/login", json={
        "email": "login@example.com",
        "password": "WrongPass999",
    })
    assert resp.status_code == 401
    assert "Invalid email or password" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_login_nonexistent_email(client: AsyncClient):
    resp = await client.post("/api/customers/login", json={
        "email": "nobody@example.com",
        "password": "Whatever123",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_case_insensitive_email(client: AsyncClient):
    await client.post("/api/customers/register", json={
        "email": "CaseLogin@Example.com",
        "password": "SecurePass1",
        "first_name": "Case",
        "last_name": "Login",
    })
    await client.post("/api/customers/logout")
    resp = await client.post("/api/customers/login", json={
        "email": "caselogin@example.com",
        "password": "SecurePass1",
    })
    assert resp.status_code == 200


# ── Logout ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_logout_clears_session(customer_client: AsyncClient):
    resp = await customer_client.post("/api/customers/logout")
    assert resp.status_code == 200
    # /me should now fail
    resp2 = await customer_client.get("/api/customers/me")
    assert resp2.status_code == 401


# ── Me / Unauthenticated ──────────────────────────────────────

@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/customers/me")
    assert resp.status_code == 401


# ── Profile Update ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_profile(customer_client: AsyncClient):
    resp = await customer_client.patch("/api/customers/me", json={
        "first_name": "Updated",
        "phone": "555-1234",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["first_name"] == "Updated"
    assert data["phone"] == "555-1234"
    # last_name unchanged
    assert data["last_name"] == "Customer"


@pytest.mark.asyncio
async def test_update_profile_empty_body(customer_client: AsyncClient):
    resp = await customer_client.patch("/api/customers/me", json={})
    assert resp.status_code == 400
    assert "No fields" in resp.json()["detail"]


# ── Password Change ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_change_password_success(customer_client: AsyncClient):
    resp = await customer_client.post("/api/customers/me/change-password", json={
        "current_password": "TestPass123",
        "new_password": "NewSecure456",
    })
    assert resp.status_code == 200
    assert "updated" in resp.json()["detail"].lower()

    # Logout and login with new password
    await customer_client.post("/api/customers/logout")
    resp2 = await customer_client.post("/api/customers/login", json={
        "email": "customer@test.com",
        "password": "NewSecure456",
    })
    assert resp2.status_code == 200


@pytest.mark.asyncio
async def test_change_password_wrong_current(customer_client: AsyncClient):
    resp = await customer_client.post("/api/customers/me/change-password", json={
        "current_password": "WrongOldPass",
        "new_password": "NewPass456",
    })
    assert resp.status_code == 400
    assert "incorrect" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_change_password_too_short(customer_client: AsyncClient):
    resp = await customer_client.post("/api/customers/me/change-password", json={
        "current_password": "TestPass123",
        "new_password": "short",
    })
    assert resp.status_code == 422


# ── Forgot / Reset Password ──────────────────────────────────

@pytest.mark.asyncio
async def test_forgot_password_always_returns_success(client: AsyncClient):
    """Should return success even for non-existent email (prevent enumeration)."""
    resp = await client.post("/api/customers/forgot-password", json={
        "email": "nobody@example.com",
    })
    assert resp.status_code == 200
    assert "reset link" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_forgot_password_creates_token(client: AsyncClient):
    """After forgot-password, the customer should have a reset token in DB."""
    import os
    from app.database import get_db
    await client.post("/api/customers/register", json={
        "email": "reset@example.com",
        "password": "SecurePass1",
        "first_name": "Reset",
        "last_name": "Test",
    })
    await client.post("/api/customers/logout")

    from unittest.mock import patch
    with patch("app.services.email_service.resend"):
        resp = await client.post("/api/customers/forgot-password", json={
            "email": "reset@example.com",
        })
    assert resp.status_code == 200

    async for db in get_db():
        pass
        cursor = await db.execute(
            "SELECT password_reset_token, password_reset_expires FROM customers WHERE email = 'reset@example.com'"
        )
        row = await cursor.fetchone()
        assert row["password_reset_token"] is not None
        assert row["password_reset_expires"] is not None


@pytest.mark.asyncio
async def test_reset_password_with_valid_token(client: AsyncClient):
    """Full forgot → reset flow using a token from the DB."""
    import os
    from app.database import get_db
    await client.post("/api/customers/register", json={
        "email": "fullreset@example.com",
        "password": "OldPass123",
        "first_name": "Full",
        "last_name": "Reset",
    })
    await client.post("/api/customers/logout")

    from unittest.mock import patch
    with patch("app.services.email_service.resend"):
        await client.post("/api/customers/forgot-password", json={
            "email": "fullreset@example.com",
        })

    # Get token from DB
    async for db in get_db():
        pass
        cursor = await db.execute(
            "SELECT password_reset_token FROM customers WHERE email = 'fullreset@example.com'"
        )
        row = await cursor.fetchone()
        token = row["password_reset_token"]

    # Reset with token
    resp = await client.post("/api/customers/reset-password", json={
        "token": token,
        "new_password": "BrandNew789",
    })
    assert resp.status_code == 200

    # Login with new password
    resp2 = await client.post("/api/customers/login", json={
        "email": "fullreset@example.com",
        "password": "BrandNew789",
    })
    assert resp2.status_code == 200


@pytest.mark.asyncio
async def test_reset_password_invalid_token(client: AsyncClient):
    resp = await client.post("/api/customers/reset-password", json={
        "token": "totally-bogus-token",
        "new_password": "NewPass123",
    })
    assert resp.status_code == 400
    assert "Invalid" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_reset_password_expired_token(client: AsyncClient):
    """Expired token should be rejected."""
    import os
    from app.database import get_db
    from datetime import datetime, timedelta, timezone

    await client.post("/api/customers/register", json={
        "email": "expired@example.com",
        "password": "OldPass123",
        "first_name": "Expired",
        "last_name": "Token",
    })

    # Manually set an expired token
    expired = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    async for db in get_db():
        await db.execute(
            "UPDATE customers SET password_reset_token = 'expired-token', password_reset_expires = ? WHERE email = 'expired@example.com'",
            (expired,),
        )
        await db.commit()

    resp = await client.post("/api/customers/reset-password", json={
        "token": "expired-token",
        "new_password": "NewPass123",
    })
    assert resp.status_code == 400
    assert "expired" in resp.json()["detail"].lower()


# ── Authenticated Order Detail ─────────────────────────────────

@pytest.mark.asyncio
async def test_order_detail_authenticated(client: AsyncClient):
    """Logged-in customer can view their order without providing email."""
    import os
    from app.database import get_db
    resp = await client.post("/api/customers/register", json={
        "email": "orderdetail@example.com",
        "password": "SecurePass1",
        "first_name": "Order",
        "last_name": "Detail",
    })
    customer_id = resp.json()["id"]

    # Insert order + item directly in DB
    async for db in get_db():
        cursor = await db.execute("""
            INSERT INTO orders (order_number, customer_name, customer_email, customer_id,
                               status, payment_status, subtotal_cents, shipping_cents, discount_cents,
                               tax_cents, total_cents, shipping_address_line1, shipping_address_city,
                               shipping_address_province, shipping_address_postal)
            VALUES ('ORD-DETAIL-1', 'Order Detail', 'orderdetail@example.com', ?,
                    'processing', 'confirmed', 3000, 0, 0, 390, 3390, '1 Test St', 'Ottawa', 'ON', 'K1A0A0')
        """, (customer_id,))
        order_id = cursor.lastrowid
        await db.execute("""
            INSERT INTO order_items (order_id, product_id, variant_id, product_name,
                                    variant_size, variant_color, quantity, unit_price_cents, line_total_cents)
            VALUES (?, NULL, NULL, 'Detail Tee', 'M', 'Black', 1, 3000, 3000)
        """, (order_id,))
        await db.commit()

    resp = await client.get("/api/customers/me/orders/ORD-DETAIL-1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["order_number"] == "ORD-DETAIL-1"
    assert len(data["items"]) == 1
    assert data["items"][0]["product_name"] == "Detail Tee"
    assert data["total_cents"] == 3390
    assert "tracking_number" in data


@pytest.mark.asyncio
async def test_order_detail_unauthenticated(client: AsyncClient):
    """Unauthenticated request to order detail returns 401."""
    resp = await client.get("/api/customers/me/orders/FAKE-ORDER")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_order_detail_wrong_customer(client: AsyncClient):
    """Customer cannot view another customer's order."""
    import os
    from app.database import get_db
    # Customer A registers
    resp = await client.post("/api/customers/register", json={
        "email": "custA@example.com",
        "password": "SecurePass1",
        "first_name": "A",
        "last_name": "Customer",
    })
    cust_a_id = resp.json()["id"]

    # Insert order belonging to Customer A
    async for db in get_db():
        await db.execute("""
            INSERT INTO orders (order_number, customer_name, customer_email, customer_id,
                               status, payment_status, subtotal_cents, shipping_cents, discount_cents,
                               tax_cents, total_cents, shipping_address_line1, shipping_address_city,
                               shipping_address_province, shipping_address_postal)
            VALUES ('ORD-SECRET-1', 'A Customer', 'custA@example.com', ?,
                    'processing', 'confirmed', 2500, 0, 0, 325, 2825, '2 Test St', 'Toronto', 'ON', 'M5V1A1')
        """, (cust_a_id,))
        await db.commit()

    # Customer B registers (new session)
    await client.post("/api/customers/logout")
    await client.post("/api/customers/register", json={
        "email": "custB@example.com",
        "password": "SecurePass1",
        "first_name": "B",
        "last_name": "Customer",
    })

    # Customer B tries to access Customer A's order
    resp = await client.get("/api/customers/me/orders/ORD-SECRET-1")
    assert resp.status_code == 404
