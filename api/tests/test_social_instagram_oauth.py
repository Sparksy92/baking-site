from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest

from app.services.social.oauth_state import consume_oauth_state, create_oauth_state
from app.services.social.providers.base import SocialAccount, SocialProviderError
from app.services.social.providers.instagram import INSTAGRAM_SCOPES, InstagramProvider
from app.services.social.service import (
    get_serialized_connection,
    select_account_connection,
    store_oauth_accounts,
)
from app.services.social.token_crypto import decrypt_token


def test_instagram_oauth_url_includes_required_scopes():
    url = InstagramProvider().build_authorization_url(state="state123")
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    scopes = set(params["scope"][0].split(","))
    assert set(INSTAGRAM_SCOPES).issubset(scopes)
    assert params["redirect_uri"][0] == "http://test/api/social/instagram/callback"


@pytest.mark.asyncio
async def test_instagram_account_discovery_from_meta_pages(monkeypatch):
    async def fake_get(self, path, *, params):
        assert path == "/me/accounts"
        return {
            "data": [
                {
                    "id": "page_1",
                    "name": "Brand Page",
                    "access_token": "EAAB-page-token",
                    "instagram_business_account": {
                        "id": "ig_123",
                        "username": "brand",
                        "name": "Brand",
                        "profile_picture_url": "https://example.com/profile.jpg",
                        "media_count": 12,
                    },
                },
                {"id": "page_2", "name": "No IG", "access_token": "EAAB-other"},
            ]
        }

    monkeypatch.setattr(InstagramProvider, "_get", fake_get)
    accounts = await InstagramProvider().list_instagram_accounts("EAAB-user-token")
    assert len(accounts) == 1
    assert accounts[0].id == "ig_123"
    assert accounts[0].metadata["linked_facebook_page_id"] == "page_1"
    assert accounts[0].metadata["instagram_username"] == "brand"


@pytest.mark.asyncio
async def test_select_instagram_account_stores_encrypted_token_and_metadata(client):
    from app.database import db_connection

    async with db_connection() as db:
        state = await create_oauth_state(db, provider="instagram", admin_user_id="admin")
        state_row = await consume_oauth_state(db, state=state, provider="instagram")
        await store_oauth_accounts(
            db,
            oauth_state_id=state_row["id"],
            provider="instagram",
            accounts=[
                SocialAccount(
                    id="ig_123",
                    name="brand",
                    category="professional_account",
                    access_token="EAAB-instagram-page-token",
                    scopes=["instagram_basic", "instagram_content_publish"],
                    metadata={
                        "instagram_username": "brand",
                        "linked_facebook_page_id": "page_1",
                        "linked_facebook_page_name": "Brand Page",
                    },
                )
            ],
        )
        response = await select_account_connection(
            db,
            external_account_id="ig_123",
            provider="instagram",
            account_type="professional_account",
            admin_user_id="admin",
            external_user_id="user_123",
        )
        assert response["provider"] == "instagram"
        assert response["metadata"]["linked_facebook_page_name"] == "Brand Page"
        assert "encrypted_access_token" not in response

        cursor = await db.execute("SELECT encrypted_access_token FROM social_connections WHERE provider = 'instagram'")
        row = await cursor.fetchone()
        assert row["encrypted_access_token"] != "EAAB-instagram-page-token"
        assert decrypt_token(row["encrypted_access_token"]) == "EAAB-instagram-page-token"


@pytest.mark.asyncio
async def test_instagram_api_responses_never_return_tokens(admin_client):
    from app.database import db_connection

    async with db_connection() as db:
        state = await create_oauth_state(db, provider="instagram", admin_user_id="admin")
        state_row = await consume_oauth_state(db, state=state, provider="instagram")
        await store_oauth_accounts(
            db,
            oauth_state_id=state_row["id"],
            provider="instagram",
            accounts=[
                SocialAccount(
                    "ig_123",
                    "brand",
                    "professional_account",
                    "EAAB-instagram-page-token",
                    ["instagram_basic"],
                    {"instagram_username": "brand", "linked_facebook_page_name": "Brand Page"},
                )
            ],
        )

    select_resp = await admin_client.post("/api/social/instagram/accounts/select", json={"ig_user_id": "ig_123"})
    assert select_resp.status_code == 200
    assert "EAAB-instagram-page-token" not in str(select_resp.json())

    status_resp = await admin_client.get("/api/social/instagram/status")
    assert status_resp.status_code == 200
    assert "EAAB-instagram-page-token" not in str(status_resp.json())
    assert "encrypted_access_token" not in str(status_resp.json())


@pytest.mark.asyncio
async def test_instagram_test_connection_success(admin_client, monkeypatch):
    await _seed_instagram_connection(admin_client)

    async def fake_test(self, token, ig_user_id):
        assert token == "EAAB-instagram-page-token"
        assert ig_user_id == "ig_123"
        return {"ok": True, "ig_user_id": "ig_123", "username": "brand"}

    monkeypatch.setattr(InstagramProvider, "test_instagram_connection", fake_test)
    resp = await admin_client.post("/api/social/instagram/test-connection")
    assert resp.status_code == 200
    assert resp.json()["username"] == "brand"


@pytest.mark.asyncio
async def test_instagram_test_connection_handles_invalid_token(admin_client, monkeypatch):
    await _seed_instagram_connection(admin_client)

    async def fake_test(self, token, ig_user_id):
        raise SocialProviderError("Invalid OAuth access token")

    monkeypatch.setattr(InstagramProvider, "test_instagram_connection", fake_test)
    resp = await admin_client.post("/api/social/instagram/test-connection")
    assert resp.status_code == 502
    assert "Invalid OAuth access token" in resp.json()["detail"]

    from app.database import db_connection

    async with db_connection() as db:
        connection = await get_serialized_connection(
            db,
            provider="instagram",
            account_type="professional_account",
        )
        assert connection["status"] == "error"
        assert connection["last_error"] == "Invalid OAuth access token"


@pytest.mark.asyncio
async def test_instagram_test_post_requires_image_url(admin_client):
    await _seed_instagram_connection(admin_client)
    resp = await admin_client.post("/api/social/instagram/test-post", json={})
    assert resp.status_code == 400
    assert "Instagram requires an image" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_instagram_test_post_rejects_non_https_image_url(admin_client):
    await _seed_instagram_connection(admin_client)
    resp = await admin_client.post(
        "/api/social/instagram/test-post",
        json={"image_url": "http://example.com/image.jpg"},
    )
    assert resp.status_code == 400
    assert "public HTTPS" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_instagram_test_post_creates_container_then_publishes(admin_client, monkeypatch):
    await _seed_instagram_connection(admin_client)
    calls: list[str] = []

    async def fake_create(self, token, ig_user_id, image_url, caption):
        calls.append("create")
        assert token == "EAAB-instagram-page-token"
        assert ig_user_id == "ig_123"
        assert image_url == "https://example.com/image.jpg"
        assert "Test post" in caption
        return {"id": "container_123"}

    async def fake_publish(self, token, ig_user_id, creation_id):
        calls.append("publish")
        assert creation_id == "container_123"
        return {"id": "media_456"}

    monkeypatch.setattr(InstagramProvider, "create_image_media_container", fake_create)
    monkeypatch.setattr(InstagramProvider, "publish_media_container", fake_publish)
    resp = await admin_client.post(
        "/api/social/instagram/test-post",
        json={"image_url": "https://example.com/image.jpg"},
    )
    assert resp.status_code == 200
    assert resp.json()["media_id"] == "media_456"
    assert calls == ["create", "publish"]


@pytest.mark.asyncio
async def test_instagram_test_post_graph_error_stored(admin_client, monkeypatch):
    await _seed_instagram_connection(admin_client)

    async def fake_publish(self, token, ig_user_id, image_url, caption):
        raise SocialProviderError("Media container creation failed")

    monkeypatch.setattr(InstagramProvider, "publish_single_image_post", fake_publish)
    resp = await admin_client.post(
        "/api/social/instagram/test-post",
        json={"image_url": "https://example.com/image.jpg"},
    )
    assert resp.status_code == 502
    assert "Media container creation failed" in resp.json()["detail"]

    from app.database import db_connection

    async with db_connection() as db:
        connection = await get_serialized_connection(
            db,
            provider="instagram",
            account_type="professional_account",
        )
        assert connection["status"] == "error"
        assert connection["last_error"] == "Media container creation failed"


async def _seed_instagram_connection(admin_client):
    from app.database import db_connection

    async with db_connection() as db:
        state = await create_oauth_state(db, provider="instagram", admin_user_id="admin")
        state_row = await consume_oauth_state(db, state=state, provider="instagram")
        await store_oauth_accounts(
            db,
            oauth_state_id=state_row["id"],
            provider="instagram",
            accounts=[
                SocialAccount(
                    "ig_123",
                    "brand",
                    "professional_account",
                    "EAAB-instagram-page-token",
                    ["instagram_basic", "instagram_content_publish"],
                    {
                        "instagram_username": "brand",
                        "linked_facebook_page_id": "page_1",
                        "linked_facebook_page_name": "Brand Page",
                    },
                )
            ],
        )
        await select_account_connection(
            db,
            external_account_id="ig_123",
            provider="instagram",
            account_type="professional_account",
            admin_user_id="admin",
            external_user_id=None,
        )
