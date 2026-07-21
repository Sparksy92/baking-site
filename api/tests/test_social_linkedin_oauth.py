from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest

from app.services.social.oauth_state import consume_oauth_state, create_oauth_state
from app.services.social.providers.base import SocialAccount, SocialProviderError
from app.services.social.providers.linkedin import (
    LINKEDIN_PERMISSION_ERROR,
    LINKEDIN_SCOPES,
    LinkedInProvider,
)
from app.services.social.service import (
    get_serialized_connection,
    select_account_connection,
    store_oauth_accounts,
)
from app.services.social.token_crypto import decrypt_token


def test_linkedin_oauth_url_includes_required_scopes():
    url = LinkedInProvider().build_authorization_url(state="state123")
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    scopes = set(params["scope"][0].split(" "))
    assert set(LINKEDIN_SCOPES).issubset(scopes)
    assert params["redirect_uri"][0] == "http://test/api/social/linkedin/callback"


@pytest.mark.asyncio
async def test_linkedin_organization_discovery_from_acls(monkeypatch):
    async def fake_get(self, path, access_token, *, params):
        assert path == "/organizationAcls"
        assert params["q"] == "roleAssignee"
        return {
            "elements": [
                {
                    "organization": "urn:li:organization:12345",
                    "organization~": {
                        "id": 12345,
                        "localizedName": "Brand Company",
                        "vanityName": "brand-company",
                        "localizedWebsite": "https://example.com",
                    },
                    "role": "ADMINISTRATOR",
                    "state": "APPROVED",
                }
            ]
        }

    monkeypatch.setattr(LinkedInProvider, "_get", fake_get)
    organizations = await LinkedInProvider().list_admin_organizations(
        "linkedin-access-token",
        token_data={
            "scope": " ".join(LINKEDIN_SCOPES),
            "expires_in": 3600,
            "refresh_token": "linkedin-refresh-token",
            "refresh_token_expires_in": 7200,
        },
        profile={"name": "Admin User", "email": "admin@example.com"},
    )
    assert len(organizations) == 1
    assert organizations[0].id == "urn:li:organization:12345"
    assert organizations[0].metadata["organization_id"] == "12345"
    assert organizations[0].metadata["connection_owner_email"] == "admin@example.com"
    assert organizations[0].refresh_token == "linkedin-refresh-token"
    assert organizations[0].token_expires_at
    assert organizations[0].refresh_token_expires_at


@pytest.mark.asyncio
async def test_select_linkedin_organization_stores_encrypted_tokens_and_expiry(client):
    from app.database import db_connection

    async with db_connection() as db:
        state = await create_oauth_state(db, provider="linkedin", admin_user_id="admin")
        state_row = await consume_oauth_state(db, state=state, provider="linkedin")
        await store_oauth_accounts(
            db,
            oauth_state_id=state_row["id"],
            provider="linkedin",
            accounts=[
                SocialAccount(
                    id="urn:li:organization:12345",
                    name="Brand Company",
                    category="organization_page",
                    access_token="linkedin-access-token",
                    scopes=["w_organization_social"],
                    metadata={"organization_urn": "urn:li:organization:12345", "organization_id": "12345"},
                    refresh_token="linkedin-refresh-token",
                    token_expires_at="2027-01-01T00:00:00+00:00",
                    refresh_token_expires_at="2027-03-01T00:00:00+00:00",
                )
            ],
        )
        response = await select_account_connection(
            db,
            external_account_id="urn:li:organization:12345",
            provider="linkedin",
            account_type="organization_page",
            admin_user_id="admin",
            external_user_id="member_123",
        )
        assert response["provider"] == "linkedin"
        assert response["metadata"]["organization_id"] == "12345"
        assert response["token_expires_at"]
        assert response["refresh_token_expires_at"]
        assert "encrypted_access_token" not in response

        cursor = await db.execute(
            "SELECT encrypted_access_token, encrypted_refresh_token FROM social_connections WHERE provider = 'linkedin'"
        )
        row = await cursor.fetchone()
        assert row["encrypted_access_token"] != "linkedin-access-token"
        assert row["encrypted_refresh_token"] != "linkedin-refresh-token"
        assert decrypt_token(row["encrypted_access_token"]) == "linkedin-access-token"
        assert decrypt_token(row["encrypted_refresh_token"]) == "linkedin-refresh-token"


@pytest.mark.asyncio
async def test_linkedin_api_responses_never_return_tokens(admin_client):
    await _seed_linkedin_connection(admin_client)
    status_resp = await admin_client.get("/api/social/linkedin/status")
    assert status_resp.status_code == 200
    payload = str(status_resp.json())
    assert "linkedin-access-token" not in payload
    assert "linkedin-refresh-token" not in payload
    assert "encrypted_access_token" not in payload
    assert "encrypted_refresh_token" not in payload


@pytest.mark.asyncio
async def test_linkedin_test_connection_success(admin_client, monkeypatch):
    await _seed_linkedin_connection(admin_client)

    async def fake_test(self, token, organization_urn):
        assert token == "linkedin-access-token"
        assert organization_urn == "urn:li:organization:12345"
        return {"organization_id": "12345", "organization_urn": organization_urn, "name": "Brand Company"}

    monkeypatch.setattr(LinkedInProvider, "test_organization_connection", fake_test)
    resp = await admin_client.post("/api/social/linkedin/test-connection")
    assert resp.status_code == 200
    assert resp.json()["organization_id"] == "12345"


@pytest.mark.asyncio
async def test_linkedin_test_connection_handles_missing_permission(admin_client, monkeypatch):
    await _seed_linkedin_connection(admin_client)

    async def fake_test(self, token, organization_urn):
        raise SocialProviderError(LINKEDIN_PERMISSION_ERROR)

    monkeypatch.setattr(LinkedInProvider, "test_organization_connection", fake_test)
    resp = await admin_client.post("/api/social/linkedin/test-connection")
    assert resp.status_code == 502
    assert "LinkedIn has not approved" in resp.json()["detail"]

    from app.database import db_connection

    async with db_connection() as db:
        connection = await get_serialized_connection(
            db,
            provider="linkedin",
            account_type="organization_page",
        )
        assert connection["status"] == "pending_review"
        assert "LinkedIn has not approved" in connection["last_error"]


@pytest.mark.asyncio
async def test_linkedin_test_connection_handles_expired_token(admin_client):
    await _seed_linkedin_connection(admin_client, token_expires_at="2020-01-01T00:00:00+00:00", refresh_token=None)
    resp = await admin_client.post("/api/social/linkedin/test-connection")
    assert resp.status_code == 400
    assert "token expired" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_linkedin_test_post_success(admin_client, monkeypatch):
    await _seed_linkedin_connection(admin_client)

    async def fake_publish(self, token, organization_urn, commentary):
        assert token == "linkedin-access-token"
        assert organization_urn == "urn:li:organization:12345"
        assert "Test" in commentary
        return {"id": "urn:li:share:111"}

    monkeypatch.setattr(LinkedInProvider, "publish_text_post", fake_publish)
    resp = await admin_client.post("/api/social/linkedin/test-post", json={"commentary": "Test LinkedIn post"})
    assert resp.status_code == 200
    assert resp.json()["post_id"] == "urn:li:share:111"


@pytest.mark.asyncio
async def test_linkedin_test_post_handles_organization_permission_failure(admin_client, monkeypatch):
    await _seed_linkedin_connection(admin_client)

    async def fake_publish(self, token, organization_urn, commentary, link_url):
        raise SocialProviderError(LINKEDIN_PERMISSION_ERROR)

    monkeypatch.setattr(LinkedInProvider, "publish_link_post", fake_publish)
    resp = await admin_client.post(
        "/api/social/linkedin/test-post",
        json={"commentary": "Test LinkedIn link", "link_url": "https://example.com/post"},
    )
    assert resp.status_code == 502
    assert "LinkedIn has not approved" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_linkedin_required_headers_added_to_api_requests(monkeypatch):
    captured: dict[str, str] = {}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"id": 12345, "localizedName": "Brand Company"}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def get(self, url, params, headers, timeout):
            captured.update(headers)
            return FakeResponse()

    monkeypatch.setattr("httpx.AsyncClient", lambda: FakeClient())
    await LinkedInProvider().get_organization_details("12345", "linkedin-access-token")
    assert captured["Authorization"] == "Bearer linkedin-access-token"
    assert captured["LinkedIn-Version"] == "202601"
    assert captured["X-Restli-Protocol-Version"] == "2.0.0"
    assert captured["Content-Type"] == "application/json"


async def _seed_linkedin_connection(admin_client, *, token_expires_at="2027-01-01T00:00:00+00:00", refresh_token="linkedin-refresh-token"):
    from app.database import db_connection

    async with db_connection() as db:
        state = await create_oauth_state(db, provider="linkedin", admin_user_id="admin")
        state_row = await consume_oauth_state(db, state=state, provider="linkedin")
        await store_oauth_accounts(
            db,
            oauth_state_id=state_row["id"],
            provider="linkedin",
            accounts=[
                SocialAccount(
                    id="urn:li:organization:12345",
                    name="Brand Company",
                    category="organization_page",
                    access_token="linkedin-access-token",
                    scopes=["w_organization_social", "r_organization_social", "rw_organization_admin"],
                    metadata={
                        "organization_urn": "urn:li:organization:12345",
                        "organization_id": "12345",
                        "localized_name": "Brand Company",
                    },
                    refresh_token=refresh_token,
                    token_expires_at=token_expires_at,
                    refresh_token_expires_at="2027-03-01T00:00:00+00:00" if refresh_token else None,
                )
            ],
        )
        await select_account_connection(
            db,
            external_account_id="urn:li:organization:12345",
            provider="linkedin",
            account_type="organization_page",
            admin_user_id="admin",
            external_user_id=None,
        )
