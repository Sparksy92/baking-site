"""Social proof endpoint tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_social_proof_returns_data(admin_client: AsyncClient, client: AsyncClient):
    # Create a product
    resp = await admin_client.post("/api/admin/products", json={"name": "Proof Tee", "slug": "proof-tee"})
    pid = resp.json()["id"]

    # Track a view event
    await client.post("/api/events", json={"event_type": "product_viewed", "session_id": "sp-1", "product_id": pid})

    resp = await client.get(f"/api/social-proof/{pid}")
    assert resp.status_code == 200
    data = resp.json()
    assert "viewers" in data
    assert "sold_this_week" in data
    assert data["viewers"] >= 1  # At least 1 due to jitter


@pytest.mark.asyncio
async def test_social_proof_no_product(client: AsyncClient):
    resp = await client.get("/api/social-proof/99999")
    assert resp.status_code == 200
    data = resp.json()
    assert data["viewers"] >= 1  # Jitter ensures never 0
    assert data["sold_this_week"] == 0
