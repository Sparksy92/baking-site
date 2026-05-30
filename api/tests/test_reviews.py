"""Product reviews endpoint tests."""
import pytest
from httpx import AsyncClient


async def _create_product(admin_client: AsyncClient) -> int:
    resp = await admin_client.post("/api/admin/products", json={"name": "Review Tee", "slug": "review-tee"})
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_list_reviews_empty(client: AsyncClient, admin_client: AsyncClient):
    pid = await _create_product(admin_client)
    resp = await client.get(f"/api/products/{pid}/reviews")
    assert resp.status_code == 200
    data = resp.json()
    assert data["reviews"] == []
    assert data["summary"]["total_reviews"] == 0
    assert data["summary"]["average_rating"] == 0


@pytest.mark.asyncio
async def test_create_review(admin_client: AsyncClient, customer_client: AsyncClient):
    pid = await _create_product(admin_client)
    resp = await customer_client.post(f"/api/products/{pid}/reviews", json={
        "rating": 5,
        "title": "Great shirt!",
        "body": "Love the design",
    })
    assert resp.status_code == 201
    assert resp.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_create_review_duplicate(admin_client: AsyncClient, customer_client: AsyncClient):
    pid = await _create_product(admin_client)
    await customer_client.post(f"/api/products/{pid}/reviews", json={"rating": 4})
    resp = await customer_client.post(f"/api/products/{pid}/reviews", json={"rating": 3})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_create_review_invalid_rating(admin_client: AsyncClient, customer_client: AsyncClient):
    pid = await _create_product(admin_client)
    resp = await customer_client.post(f"/api/products/{pid}/reviews", json={"rating": 6})
    assert resp.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_create_review_nonexistent_product(customer_client: AsyncClient):
    resp = await customer_client.post("/api/products/9999/reviews", json={"rating": 5})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_pending_reviews_not_shown(admin_client: AsyncClient, customer_client: AsyncClient, client: AsyncClient):
    pid = await _create_product(admin_client)
    await customer_client.post(f"/api/products/{pid}/reviews", json={"rating": 4, "title": "Pending"})

    # Public listing should NOT show pending reviews
    resp = await client.get(f"/api/products/{pid}/reviews")
    assert resp.json()["reviews"] == []
    assert resp.json()["summary"]["total_reviews"] == 0


@pytest.mark.asyncio
async def test_admin_moderate_approve(admin_client: AsyncClient, customer_client: AsyncClient, client: AsyncClient):
    pid = await _create_product(admin_client)
    create_resp = await customer_client.post(f"/api/products/{pid}/reviews", json={"rating": 5, "title": "Approved"})
    review_id = create_resp.json()["id"]

    # Admin approves
    resp = await admin_client.patch(f"/api/admin/reviews/{review_id}", json={"status": "approved"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"

    # Now visible publicly
    public_resp = await client.get(f"/api/products/{pid}/reviews")
    assert len(public_resp.json()["reviews"]) == 1
    assert public_resp.json()["summary"]["average_rating"] == 5.0


@pytest.mark.asyncio
async def test_admin_moderate_reject(admin_client: AsyncClient, customer_client: AsyncClient, client: AsyncClient):
    pid = await _create_product(admin_client)
    create_resp = await customer_client.post(f"/api/products/{pid}/reviews", json={"rating": 2})
    review_id = create_resp.json()["id"]

    # Admin rejects
    resp = await admin_client.patch(f"/api/admin/reviews/{review_id}", json={"status": "rejected"})
    assert resp.status_code == 200

    # Still not visible
    public_resp = await client.get(f"/api/products/{pid}/reviews")
    assert public_resp.json()["reviews"] == []


@pytest.mark.asyncio
async def test_admin_list_pending(admin_client: AsyncClient, customer_client: AsyncClient):
    pid = await _create_product(admin_client)
    await customer_client.post(f"/api/products/{pid}/reviews", json={"rating": 3})

    resp = await admin_client.get("/api/admin/reviews?status=pending")
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


@pytest.mark.asyncio
async def test_admin_delete_review(admin_client: AsyncClient, customer_client: AsyncClient):
    pid = await _create_product(admin_client)
    create_resp = await customer_client.post(f"/api/products/{pid}/reviews", json={"rating": 1})
    review_id = create_resp.json()["id"]

    resp = await admin_client.delete(f"/api/admin/reviews/{review_id}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True


@pytest.mark.asyncio
async def test_reviews_require_auth(client: AsyncClient, admin_client: AsyncClient):
    pid = await _create_product(admin_client)
    # Public listing doesn't require auth
    assert (await client.get(f"/api/products/{pid}/reviews")).status_code == 200
    # Creating a review does
    resp = await client.post(f"/api/products/{pid}/reviews", json={"rating": 5})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_admin_reviews_require_auth(client: AsyncClient):
    assert (await client.get("/api/admin/reviews")).status_code == 401
    assert (await client.patch("/api/admin/reviews/1", json={"status": "approved"})).status_code == 401
