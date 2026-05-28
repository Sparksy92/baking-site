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
    import aiosqlite
    db_path = os.environ["DATABASE_PATH"]
    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            ("store_announcement", "Free shipping this weekend!"),
        )
        await db.commit()

    resp = await client.get("/api/settings/public")
    assert resp.json()["store_announcement"] == "Free shipping this weekend!"
