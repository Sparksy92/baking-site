from __future__ import annotations

import pytest

from app.services.social.oauth_state import consume_oauth_state, create_oauth_state
from app.services.social.providers.facebook import FacebookProvider
from app.services.social.service import get_serialized_connection, select_page_connection, store_oauth_pages
from app.services.social.providers.base import SocialPage, SocialProviderError
from app.services.social.token_crypto import decrypt_token, encrypt_token


def test_social_token_encryption_round_trip():
    encrypted = encrypt_token("EAAB-test-token")
    assert encrypted
    assert encrypted != "EAAB-test-token"
    assert decrypt_token(encrypted) == "EAAB-test-token"


@pytest.mark.asyncio
async def test_oauth_state_generation_and_validation(client):
    from app.database import db_connection

    async with db_connection() as db:
        state = await create_oauth_state(db, provider="facebook", admin_user_id="admin")
        assert state
        row = await consume_oauth_state(db, state=state, provider="facebook")
        assert row is not None
        assert row["admin_user_id"] == "admin"
        assert await consume_oauth_state(db, state=state, provider="facebook") is None


@pytest.mark.asyncio
async def test_select_page_stores_encrypted_token_and_sanitizes_response(client):
    from app.database import db_connection

    async with db_connection() as db:
        state = await create_oauth_state(db, provider="facebook", admin_user_id="admin")
        state_row = await consume_oauth_state(db, state=state, provider="facebook")
        await store_oauth_pages(
            db,
            oauth_state_id=state_row["id"],
            provider="facebook",
            pages=[
                SocialPage(
                    id="page_123",
                    name="Test Page",
                    category="Retail",
                    access_token="EAAB-page-token",
                    scopes=["pages_show_list", "pages_manage_posts"],
                )
            ],
        )
        response = await select_page_connection(
            db,
            page_id="page_123",
            provider="facebook",
            admin_user_id="admin",
            external_user_id="user_123",
        )
        assert response["display_name"] == "Test Page"
        assert "access_token" not in response
        assert "encrypted_access_token" not in response

        cursor = await db.execute("SELECT encrypted_access_token FROM social_connections WHERE provider = 'facebook'")
        row = await cursor.fetchone()
        assert row["encrypted_access_token"] != "EAAB-page-token"
        assert decrypt_token(row["encrypted_access_token"]) == "EAAB-page-token"


@pytest.mark.asyncio
async def test_facebook_api_responses_do_not_return_tokens(admin_client):
    from app.database import db_connection

    async with db_connection() as db:
        state = await create_oauth_state(db, provider="facebook", admin_user_id="admin")
        state_row = await consume_oauth_state(db, state=state, provider="facebook")
        await store_oauth_pages(
            db,
            oauth_state_id=state_row["id"],
            provider="facebook",
            pages=[SocialPage("page_123", "Test Page", "Retail", "EAAB-page-token", ["pages_manage_posts"])],
        )

    select_resp = await admin_client.post("/api/social/facebook/pages/select", json={"page_id": "page_123"})
    assert select_resp.status_code == 200
    payload = select_resp.json()
    assert "EAAB-page-token" not in str(payload)
    assert "encrypted_access_token" not in str(payload)

    status_resp = await admin_client.get("/api/social/facebook/status")
    assert status_resp.status_code == 200
    assert "EAAB-page-token" not in str(status_resp.json())


@pytest.mark.asyncio
async def test_test_connection_success(admin_client, monkeypatch):
    from app.database import db_connection

    async with db_connection() as db:
        state = await create_oauth_state(db, provider="facebook", admin_user_id="admin")
        state_row = await consume_oauth_state(db, state=state, provider="facebook")
        await store_oauth_pages(
            db,
            oauth_state_id=state_row["id"],
            provider="facebook",
            pages=[SocialPage("page_123", "Test Page", "Retail", "EAAB-page-token", ["pages_manage_posts"])],
        )
        await select_page_connection(
            db,
            page_id="page_123",
            provider="facebook",
            admin_user_id="admin",
            external_user_id=None,
        )

    async def fake_test(self, token, page_id):
        assert token == "EAAB-page-token"
        assert page_id == "page_123"
        return {"ok": True, "page_id": page_id, "page_name": "Test Page"}

    monkeypatch.setattr(FacebookProvider, "test_page_connection", fake_test)
    resp = await admin_client.post("/api/social/facebook/test-connection")
    assert resp.status_code == 200
    assert resp.json()["page_name"] == "Test Page"


@pytest.mark.asyncio
async def test_test_connection_handles_revoked_token(admin_client, monkeypatch):
    from app.database import db_connection

    async with db_connection() as db:
        state = await create_oauth_state(db, provider="facebook", admin_user_id="admin")
        state_row = await consume_oauth_state(db, state=state, provider="facebook")
        await store_oauth_pages(
            db,
            oauth_state_id=state_row["id"],
            provider="facebook",
            pages=[SocialPage("page_123", "Test Page", "Retail", "EAAB-page-token", ["pages_manage_posts"])],
        )
        await select_page_connection(
            db,
            page_id="page_123",
            provider="facebook",
            admin_user_id="admin",
            external_user_id=None,
        )

    async def fake_test(self, token, page_id):
        raise SocialProviderError("Invalid OAuth access token")

    monkeypatch.setattr(FacebookProvider, "test_page_connection", fake_test)
    resp = await admin_client.post("/api/social/facebook/test-connection")
    assert resp.status_code == 502
    assert "Invalid OAuth access token" in resp.json()["detail"]

    async with db_connection() as db:
        connection = await get_serialized_connection(db, provider="facebook")
        assert connection["status"] == "error"
        assert connection["last_error"] == "Invalid OAuth access token"


@pytest.mark.asyncio
async def test_test_post_success(admin_client, monkeypatch):
    from app.database import db_connection

    async with db_connection() as db:
        state = await create_oauth_state(db, provider="facebook", admin_user_id="admin")
        state_row = await consume_oauth_state(db, state=state, provider="facebook")
        await store_oauth_pages(
            db,
            oauth_state_id=state_row["id"],
            provider="facebook",
            pages=[SocialPage("page_123", "Test Page", "Retail", "EAAB-page-token", ["pages_manage_posts"])],
        )
        await select_page_connection(
            db,
            page_id="page_123",
            provider="facebook",
            admin_user_id="admin",
            external_user_id=None,
        )

    async def fake_publish(self, token, page_id, message):
        assert token == "EAAB-page-token"
        assert page_id == "page_123"
        assert "Test post" in message
        return {"id": "page_123_post_456"}

    monkeypatch.setattr(FacebookProvider, "publish_text_post", fake_publish)
    resp = await admin_client.post("/api/social/facebook/test-post", json={})
    assert resp.status_code == 200
    assert resp.json()["post_id"] == "page_123_post_456"


@pytest.mark.asyncio
async def test_test_post_graph_failure(admin_client, monkeypatch):
    from app.database import db_connection

    async with db_connection() as db:
        state = await create_oauth_state(db, provider="facebook", admin_user_id="admin")
        state_row = await consume_oauth_state(db, state=state, provider="facebook")
        await store_oauth_pages(
            db,
            oauth_state_id=state_row["id"],
            provider="facebook",
            pages=[SocialPage("page_123", "Test Page", "Retail", "EAAB-page-token", ["pages_manage_posts"])],
        )
        await select_page_connection(
            db,
            page_id="page_123",
            provider="facebook",
            admin_user_id="admin",
            external_user_id=None,
        )

    async def fake_publish(self, token, page_id, message):
        raise SocialProviderError("Missing pages_manage_posts permission")

    monkeypatch.setattr(FacebookProvider, "publish_text_post", fake_publish)
    resp = await admin_client.post("/api/social/facebook/test-post", json={})
    assert resp.status_code == 502
    assert "pages_manage_posts" in resp.json()["detail"]
