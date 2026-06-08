import os
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
os.environ["POSTGRES_DB"] = "ecommerce_test"


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
    """Provide an async test client with a clean database."""
    from app.config import get_settings
    from app.database import init_db, close_db, db_connection

    get_settings.cache_clear()

    # Safety check
    if not get_settings().postgres_db.endswith('test'):
        raise RuntimeError("Refusing to run tests against non-test database to prevent data loss.")

    # Initialize connection pool and run migrations
    await init_db()

    # Truncate all tables to ensure clean state (use raw connection outside transaction)
    from app.database import _pool
    async with _pool.acquire() as conn:
        records = await conn.fetch("""
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            AND tablename != '_migrations';
        """)
        if records:
            tables = ", ".join([f'"{r["tablename"]}"' for r in records])
            await conn.execute(f"TRUNCATE {tables} RESTART IDENTITY CASCADE;")

    from app.main import app
    _clear_rate_limits(app)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    await close_db()


@pytest.fixture
async def admin_client(client: AsyncClient):
    """Provide an authenticated admin client."""
    from app.database import db_connection
    from app.auth import hash_password

    pw_hash = hash_password("admin123")

    async with db_connection() as db:
        await db.execute(
            "INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            ("admin", pw_hash, "owner"),
        )

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
