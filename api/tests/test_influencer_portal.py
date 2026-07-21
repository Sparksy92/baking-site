"""Tests for the influencer submission portal.

Covers:
  - Portal token generation (admin API)
  - Public portal endpoints: GET brief, POST submit, GET submissions
  - Validation: invalid token, wrong collab status, invalid content_type
  - No auth required for public portal routes
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _create_influencer(admin_client: AsyncClient, name: str = "Jane Doe") -> int:
    resp = await admin_client.post("/api/admin/social/influencers", json={
        "name": name,
        "platform": "instagram",
        "handle": f"@{name.lower().replace(' ', '_')}",
        "follower_count": 50000,
        "engagement_rate": 3.5,
        "niche": "fashion",
        "email": f"{name.lower().replace(' ', '.')}@example.com",
    })
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["influencer_id"]


async def _create_collaboration(admin_client: AsyncClient, influencer_id: int, **overrides) -> int:
    payload = {
        "influencer_id": influencer_id,
        "campaign_name": "Summer Drop 2025",
        "status": "active",
        "deliverables": {"posts": 3, "stories": 2},
        "compensation_cents": 50000,
        "content_requirements": "Use #SummerDrop, tag @brand, show product.",
        "start_date": "2025-06-01",
        "end_date": "2025-06-30",
        **overrides,
    }
    resp = await admin_client.post("/api/admin/social/influencers/collaborations", json=payload)
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["collaboration_id"]


async def _get_portal_token(admin_client: AsyncClient, collab_id: int) -> str:
    resp = await admin_client.post(
        f"/api/admin/social/influencers/collaborations/{collab_id}/portal-token"
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "portal_url" in data
    token = data["portal_url"].split("/")[-1]
    assert len(token) > 10
    return token


# ── Portal token generation (admin) ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_portal_token(admin_client: AsyncClient):
    inf_id = await _create_influencer(admin_client, "Alice Influencer")
    collab_id = await _create_collaboration(admin_client, inf_id)
    resp = await admin_client.post(
        f"/api/admin/social/influencers/collaborations/{collab_id}/portal-token"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "portal_url" in data
    assert "/portal/influencer/" in data["portal_url"]


@pytest.mark.asyncio
async def test_portal_token_is_idempotent(admin_client: AsyncClient):
    """Calling portal-token twice for the same collab returns the same token."""
    inf_id = await _create_influencer(admin_client, "Bob Repeat")
    collab_id = await _create_collaboration(admin_client, inf_id)
    resp1 = await admin_client.post(
        f"/api/admin/social/influencers/collaborations/{collab_id}/portal-token"
    )
    resp2 = await admin_client.post(
        f"/api/admin/social/influencers/collaborations/{collab_id}/portal-token"
    )
    assert resp1.json()["portal_url"] == resp2.json()["portal_url"]


@pytest.mark.asyncio
async def test_portal_token_nonexistent_collab_returns_404(admin_client: AsyncClient):
    resp = await admin_client.post(
        "/api/admin/social/influencers/collaborations/999999/portal-token"
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_portal_token_requires_admin_auth(client: AsyncClient):
    resp = await client.post(
        "/api/admin/social/influencers/collaborations/1/portal-token"
    )
    assert resp.status_code == 401


# ── Public portal: GET brief ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_portal_get_brief_valid_token(admin_client: AsyncClient, client: AsyncClient):
    inf_id = await _create_influencer(admin_client, "Carol Brief")
    collab_id = await _create_collaboration(admin_client, inf_id, campaign_name="Winter Drop")
    token = await _get_portal_token(admin_client, collab_id)

    resp = await client.get(f"/api/portal/influencer/{token}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["campaign_name"] == "Winter Drop"
    assert data["influencer_name"] == "Carol Brief"
    assert "deliverables" in data
    assert "content_requirements" in data
    assert "collaboration_id" in data


@pytest.mark.asyncio
async def test_portal_get_brief_does_not_expose_sensitive_fields(
    admin_client: AsyncClient, client: AsyncClient
):
    inf_id = await _create_influencer(admin_client, "Dave Private")
    collab_id = await _create_collaboration(admin_client, inf_id, compensation_cents=100000)
    token = await _get_portal_token(admin_client, collab_id)

    resp = await client.get(f"/api/portal/influencer/{token}")
    assert resp.status_code == 200
    data = resp.json()
    # Compensation is internal — must NOT be exposed
    assert "compensation_cents" not in data
    assert "created_by" not in data


@pytest.mark.asyncio
async def test_portal_get_brief_invalid_token_returns_404(client: AsyncClient):
    resp = await client.get("/api/portal/influencer/totally-invalid-token-xyz")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_portal_get_brief_no_auth_required(client: AsyncClient):
    """Public portal must be accessible without any auth header."""
    resp = await client.get("/api/portal/influencer/no-such-token")
    # 404 is correct — no auth challenge (401)
    assert resp.status_code == 404


# ── Public portal: POST submit ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_portal_submit_content(admin_client: AsyncClient, client: AsyncClient):
    inf_id = await _create_influencer(admin_client, "Eva Submit")
    collab_id = await _create_collaboration(admin_client, inf_id, status="active")
    token = await _get_portal_token(admin_client, collab_id)

    resp = await client.post(f"/api/portal/influencer/{token}/submit", json={
        "content_type": "post",
        "caption": "Check out this amazing product! #SummerDrop",
        "media_urls": ["https://cdn.example.com/video.mp4"],
        "submitted_by_name": "Eva Submit",
        "submitted_by_email": "eva@example.com",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "submission_id" in data
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_portal_submit_all_content_types(admin_client: AsyncClient, client: AsyncClient):
    for ct in ("post", "story", "reel", "video", "image"):
        inf_id = await _create_influencer(admin_client, f"Influencer {ct}")
        collab_id = await _create_collaboration(admin_client, inf_id)
        token = await _get_portal_token(admin_client, collab_id)
        resp = await client.post(f"/api/portal/influencer/{token}/submit", json={
            "content_type": ct,
            "caption": f"Test {ct} submission",
            "media_urls": ["https://cdn.example.com/asset.mp4"],
        })
        assert resp.status_code == 200, f"Failed for content_type={ct}: {resp.text}"


@pytest.mark.asyncio
async def test_portal_submit_invalid_content_type(admin_client: AsyncClient, client: AsyncClient):
    inf_id = await _create_influencer(admin_client, "Frank Invalid")
    collab_id = await _create_collaboration(admin_client, inf_id)
    token = await _get_portal_token(admin_client, collab_id)

    resp = await client.post(f"/api/portal/influencer/{token}/submit", json={
        "content_type": "podcast",
        "caption": "Bad content type",
        "media_urls": [],
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_portal_submit_invalid_token_returns_404(client: AsyncClient):
    resp = await client.post("/api/portal/influencer/bad-token/submit", json={
        "content_type": "post",
        "caption": "Test",
        "media_urls": [],
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_portal_submit_rejected_for_completed_collab(
    admin_client: AsyncClient, client: AsyncClient
):
    inf_id = await _create_influencer(admin_client, "Grace Completed")
    collab_id = await _create_collaboration(admin_client, inf_id, status="completed")
    token = await _get_portal_token(admin_client, collab_id)

    resp = await client.post(f"/api/portal/influencer/{token}/submit", json={
        "content_type": "post",
        "caption": "Too late",
        "media_urls": [],
    })
    assert resp.status_code == 400
    assert "completed" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_portal_submit_rejected_for_cancelled_collab(
    admin_client: AsyncClient, client: AsyncClient
):
    inf_id = await _create_influencer(admin_client, "Hank Cancelled")
    collab_id = await _create_collaboration(admin_client, inf_id, status="cancelled")
    token = await _get_portal_token(admin_client, collab_id)

    resp = await client.post(f"/api/portal/influencer/{token}/submit", json={
        "content_type": "post",
        "caption": "Cancelled",
        "media_urls": [],
    })
    assert resp.status_code == 400


# ── Public portal: GET submissions ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_portal_list_submissions_empty(admin_client: AsyncClient, client: AsyncClient):
    inf_id = await _create_influencer(admin_client, "Ida Empty")
    collab_id = await _create_collaboration(admin_client, inf_id)
    token = await _get_portal_token(admin_client, collab_id)

    resp = await client.get(f"/api/portal/influencer/{token}/submissions")
    assert resp.status_code == 200
    data = resp.json()
    assert "submissions" in data
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_portal_list_submissions_after_submit(
    admin_client: AsyncClient, client: AsyncClient
):
    inf_id = await _create_influencer(admin_client, "Jack Submitter")
    collab_id = await _create_collaboration(admin_client, inf_id)
    token = await _get_portal_token(admin_client, collab_id)

    # Submit 2 items
    for i in range(2):
        await client.post(f"/api/portal/influencer/{token}/submit", json={
            "content_type": "post",
            "caption": f"Submission {i+1}",
            "media_urls": [f"https://cdn.example.com/img{i}.jpg"],
        })

    resp = await client.get(f"/api/portal/influencer/{token}/submissions")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    for sub in data["submissions"]:
        assert "id" in sub
        assert "status" in sub
        assert sub["status"] == "pending"


@pytest.mark.asyncio
async def test_portal_list_submissions_invalid_token(client: AsyncClient):
    resp = await client.get("/api/portal/influencer/bad-token/submissions")
    assert resp.status_code == 404


# ── Admin: review submission ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_can_review_submission(admin_client: AsyncClient, client: AsyncClient):
    inf_id = await _create_influencer(admin_client, "Karen Review")
    collab_id = await _create_collaboration(admin_client, inf_id)
    token = await _get_portal_token(admin_client, collab_id)

    submit_resp = await client.post(f"/api/portal/influencer/{token}/submit", json={
        "content_type": "reel",
        "caption": "Check this reel out!",
        "media_urls": ["https://cdn.example.com/reel.mp4"],
    })
    submission_id = submit_resp.json()["submission_id"]

    # Admin reviews
    resp = await admin_client.patch(
        f"/api/admin/social/influencers/submissions/{submission_id}/review",
        json={"status": "approved", "feedback": "Looks great!"},
    )
    assert resp.status_code in (200, 204)
