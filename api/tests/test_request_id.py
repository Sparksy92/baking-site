"""Request ID middleware tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_response_has_request_id(client: AsyncClient):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert "x-request-id" in resp.headers
    assert len(resp.headers["x-request-id"]) > 0


@pytest.mark.asyncio
async def test_passthrough_request_id(client: AsyncClient):
    custom_id = "test-req-12345"
    resp = await client.get("/api/health", headers={"x-request-id": custom_id})
    assert resp.headers["x-request-id"] == custom_id
