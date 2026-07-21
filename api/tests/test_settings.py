"""Public settings API tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_public_settings_returns_defaults(client: AsyncClient):
    """Public settings endpoint returns brand config defaults."""
    resp = await client.get("/api/settings/public")
    assert resp.status_code == 200
    data = resp.json()
    assert data["brand_name"] == "TestBrand"
    assert data["currency"] == "CAD"
    assert "tax_rate" in data
    assert "shipping_flat_rate_cents" in data
    assert "shipping_free_threshold_cents" in data


@pytest.mark.asyncio
async def test_public_settings_announcement_default_empty(client: AsyncClient):
    """store_announcement defaults to empty string."""
    resp = await client.get("/api/settings/public")
    assert resp.json()["store_announcement"] == ""


@pytest.mark.asyncio
async def test_public_settings_custom_announcement(client: AsyncClient):
    """store_announcement can be set via DB."""
    import os
    from app.database import get_db
    async for db in get_db():
        await db.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            ("store_announcement", "Free shipping this weekend!"),
        )
        await db.commit()

    resp = await client.get("/api/settings/public")
    assert resp.json()["store_announcement"] == "Free shipping this weekend!"


@pytest.mark.asyncio
async def test_admin_settings_cleans_legacy_values(admin_client: AsyncClient):
    """Admin settings GET endpoint cleans legacy The Artisan Bakery brand values."""
    from app.database import get_db
    async for db in get_db():
        await db.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            ("brand_name", "The Artisan Bakery"),
        )
        await db.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            ("contact_email", "hello@theartisanbakery.test"),
        )
        await db.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            ("about_content", "Welcome to The Artisan Bakery. We are a family-run homestead kitchen."),
        )
        await db.commit()

    resp = await admin_client.get("/api/admin/settings")
    assert resp.status_code == 200
    data = resp.json()
    
    brand_name_setting = next(s for s in data if s["key"] == "brand_name")
    contact_email_setting = next(s for s in data if s["key"] == "contact_email")
    about_content_setting = next(s for s in data if s["key"] == "about_content")
    
    assert brand_name_setting["value"] == "The Artisan Bakery"
    assert contact_email_setting["value"] == "hello@theartisanbakery.test"
    assert about_content_setting["value"] == "Welcome to The Artisan Bakery. We are a family-run kitchen."

