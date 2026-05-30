import os
import tempfile
import pytest
from httpx import AsyncClient, ASGITransport

# Set test environment BEFORE any app imports
os.environ["ADMIN_JWT_SECRET"] = "test-secret-key"
os.environ["CUSTOMER_JWT_SECRET"] = "test-customer-secret-key"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_fake"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_fake"
os.environ["RESEND_API_KEY"] = "re_test_fake"
os.environ["STORE_DOMAIN"] = "http://localhost:5173"
os.environ["BRAND_NAME"] = "TestBrand"
os.environ["STORE_CURRENCY"] = "CAD"
os.environ["ORDER_NUMBER_PREFIX"] = "TST"
os.environ["CONTACT_EMAIL"] = "contact@testbrand.com"
os.environ["DEV_MODE"] = "true"


def _clear_rate_limits(app):
    """Reset in-memory rate limiter between tests."""
    from app.middleware.rate_limit import RateLimitMiddleware
    for mw in app.user_middleware:
        if mw.cls is RateLimitMiddleware:
            break
    # Walk the actual middleware stack
    handler = app.middleware_stack
    while handler:
        if isinstance(handler, RateLimitMiddleware):
            handler._hits.clear()
            break
        handler = getattr(handler, "app", None)


@pytest.fixture
async def client():
    """Provide an async test client with a fresh temporary database."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name

    os.environ["DATABASE_PATH"] = db_path

    # Clear cached settings so test env vars take effect
    from app.config import get_settings
    get_settings.cache_clear()

    from app.database import set_db_path, init_db
    set_db_path(db_path)

    await init_db()

    from app.main import app
    _clear_rate_limits(app)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    os.unlink(db_path)


@pytest.fixture
async def admin_client(client: AsyncClient):
    """Provide an authenticated admin client."""
    import aiosqlite
    from app.auth import hash_password

    db_path = os.environ["DATABASE_PATH"]
    pw_hash = hash_password("admin123")

    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            "INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)",
            ("admin", pw_hash, "owner"),
        )
        await db.commit()

    resp = await client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200
    yield client


@pytest.fixture
async def customer_client(client: AsyncClient):
    """Provide an authenticated customer client."""
    resp = await client.post("/api/customers/register", json={
        "email": "customer@test.com",
        "password": "TestPass123",
        "first_name": "Test",
        "last_name": "Customer",
    })
    assert resp.status_code == 201
    yield client
