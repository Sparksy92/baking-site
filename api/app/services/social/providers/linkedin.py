from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx

from app.config import Settings, get_settings
from app.services.social.providers.base import SocialAccount, SocialProviderError

LINKEDIN_SCOPES = [
    "openid",
    "profile",
    "email",
    "r_organization_social",
    "w_organization_social",
    "rw_organization_admin",
]

LINKEDIN_COMMENTARY_LIMIT = 3000
LINKEDIN_PERMISSION_ERROR = (
    "LinkedIn has not approved the required organization posting permissions yet. "
    "Request Community Management API access and retry once approved."
)


class LinkedInProvider:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.api_base = "https://api.linkedin.com/rest"
        self.oauth_base = "https://www.linkedin.com/oauth/v2"
        self.userinfo_url = "https://api.linkedin.com/v2/userinfo"
        self.api_version = self.settings.linkedin_api_version or "202601"

    @property
    def redirect_uri(self) -> str:
        return self.settings.linkedin_redirect_uri

    @property
    def configured(self) -> bool:
        return bool(self.settings.linkedin_client_id and self.settings.linkedin_client_secret and self.redirect_uri)

    def assert_configured(self) -> None:
        if not self.configured:
            raise SocialProviderError("Server credentials not configured")

    def build_authorization_url(self, *, state: str) -> str:
        self.assert_configured()
        params = {
            "response_type": "code",
            "client_id": self.settings.linkedin_client_id,
            "redirect_uri": self.redirect_uri,
            "state": state,
            "scope": " ".join(LINKEDIN_SCOPES),
        }
        return f"{self.oauth_base}/authorization?{urlencode(params)}"

    async def exchange_code_for_access_token(self, code: str) -> dict[str, Any]:
        self.assert_configured()
        return await self._oauth_post(
            "/accessToken",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": self.settings.linkedin_client_id,
                "client_secret": self.settings.linkedin_client_secret,
                "redirect_uri": self.redirect_uri,
            },
        )

    async def refresh_access_token(self, refresh_token: str) -> dict[str, Any]:
        self.assert_configured()
        return await self._oauth_post(
            "/accessToken",
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": self.settings.linkedin_client_id,
                "client_secret": self.settings.linkedin_client_secret,
            },
        )

    async def get_current_user_profile(self, access_token: str) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    self.userinfo_url,
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=30.0,
                )
                data = resp.json()
        except Exception as exc:
            raise SocialProviderError("LinkedIn profile request failed") from exc
        self._raise_for_error(resp.status_code, data)
        return data

    async def list_admin_organizations(
        self,
        access_token: str,
        *,
        token_data: dict[str, Any] | None = None,
        profile: dict[str, Any] | None = None,
    ) -> list[SocialAccount]:
        data = await self._get(
            "/organizationAcls",
            access_token,
            params={
                "q": "roleAssignee",
                "role": "ADMINISTRATOR",
                "state": "APPROVED",
                "projection": "(elements*(organization,organization~(id,localizedName,vanityName,localizedWebsite,logoV2),role,state))",
            },
        )
        elements = data.get("elements", [])
        accounts: list[SocialAccount] = []
        scopes = self._parse_scope(token_data.get("scope") if token_data else None)
        if not scopes:
            scopes = LINKEDIN_SCOPES
        expires_at = self._seconds_from_now(token_data.get("expires_in")) if token_data else None
        refresh_expires_at = self._seconds_from_now(token_data.get("refresh_token_expires_in")) if token_data else None
        refresh_token = token_data.get("refresh_token") if token_data else None

        for element in elements:
            org_urn = str(element.get("organization") or "")
            org_id = self._organization_id_from_urn(org_urn)
            details = element.get("organization~") or {}
            if not org_id and details.get("id"):
                org_id = str(details["id"])
                org_urn = f"urn:li:organization:{org_id}"
            if not org_id:
                continue
            name = details.get("localizedName") or f"LinkedIn Organization {org_id}"
            metadata = {
                "organization_urn": org_urn,
                "organization_id": org_id,
                "vanity_name": details.get("vanityName"),
                "localized_name": details.get("localizedName"),
                "website_url": details.get("localizedWebsite"),
                "logo_url": self._logo_urn(details.get("logoV2")),
                "connection_owner_name": profile.get("name") if profile else None,
                "connection_owner_email": profile.get("email") if profile else None,
                "linkedin_app_product_status": "approved",
                "approval_note": None,
                "role": element.get("role"),
                "state": element.get("state"),
            }
            accounts.append(
                SocialAccount(
                    id=org_urn,
                    name=str(name),
                    category="organization_page",
                    access_token=access_token,
                    scopes=scopes,
                    metadata=metadata,
                    refresh_token=refresh_token,
                    token_expires_at=expires_at,
                    refresh_token_expires_at=refresh_expires_at,
                )
            )
        return accounts

    async def get_organization_details(self, organization_id_or_urn: str, access_token: str) -> dict[str, Any]:
        organization_id = self._organization_id_from_urn(organization_id_or_urn) or organization_id_or_urn
        return await self._get(f"/organizations/{organization_id}", access_token, params={})

    async def test_organization_connection(self, access_token: str, organization_id_or_urn: str) -> dict[str, Any]:
        details = await self.get_organization_details(organization_id_or_urn, access_token)
        organization_id = str(details.get("id") or self._organization_id_from_urn(organization_id_or_urn) or organization_id_or_urn)
        return {
            "organization_id": organization_id,
            "organization_urn": details.get("$URN") or f"urn:li:organization:{organization_id}",
            "name": details.get("localizedName"),
            "vanity_name": details.get("vanityName"),
        }

    async def publish_text_post(self, access_token: str, organization_urn: str, commentary: str) -> dict[str, Any]:
        return await self._publish_post(access_token, organization_urn, commentary)

    async def publish_image_post(
        self,
        access_token: str,
        organization_urn: str,
        commentary: str,
        image_url: str,
    ) -> dict[str, Any]:
        """Publish an image post to a LinkedIn Organization Page.

        Steps:
          1. Register an image upload → get asset URN + upload URL
          2. Download image bytes from image_url and PUT to upload URL
          3. Create post with content.media referencing the asset URN
        """
        import httpx as _httpx

        org_id = self._organization_id_from_urn(organization_urn) or organization_urn

        # Step 1 — Register upload
        register_payload = {
            "registerUploadRequest": {
                "owner": organization_urn,
                "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
                "serviceRelationships": [
                    {"identifier": "urn:li:userGeneratedContent", "relationshipType": "OWNER"}
                ],
                "supportedUploadMechanism": ["SYNCHRONOUS_UPLOAD"],
            }
        }
        try:
            async with _httpx.AsyncClient() as client:
                reg_resp = await client.post(
                    f"{self.api_base}/assets?action=registerUpload",
                    json=register_payload,
                    headers=self._headers(access_token),
                    timeout=30.0,
                )
            reg_data = reg_resp.json()
        except Exception as exc:
            raise SocialProviderError("LinkedIn image register failed") from exc
        self._raise_for_error(reg_resp.status_code, reg_data)

        value = reg_data.get("value", {})
        asset_urn = value.get("asset")
        upload_url = (
            value.get("uploadMechanism", {})
            .get("com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest", {})
            .get("uploadUrl")
        )
        if not asset_urn or not upload_url:
            raise SocialProviderError("LinkedIn did not return asset URN or upload URL")

        # Step 2 — Download + upload image bytes
        try:
            async with _httpx.AsyncClient(timeout=120) as client:
                img_resp = await client.get(image_url)
                img_resp.raise_for_status()
                up_resp = await client.put(
                    upload_url,
                    content=img_resp.content,
                    headers={"Authorization": f"Bearer {access_token}", "Content-Type": "image/jpeg"},
                )
        except Exception as exc:
            raise SocialProviderError(f"LinkedIn image upload failed: {exc}") from exc

        # Step 3 — Create post with image content
        return await self._publish_post(
            access_token,
            organization_urn,
            commentary,
            content={
                "media": {
                    "status": "READY",
                    "description": {"text": commentary[:200]},
                    "media": asset_urn,
                    "title": {"text": commentary[:100]},
                }
            },
        )

    async def publish_video_post(
        self,
        access_token: str,
        organization_urn: str,
        commentary: str,
        video_url: str,
    ) -> dict[str, Any]:
        """Publish a video post to a LinkedIn Organization Page.

        Uses the same register-upload → upload → post flow as images,
        with the feedshare-video recipe.
        """
        import httpx as _httpx

        register_payload = {
            "registerUploadRequest": {
                "owner": organization_urn,
                "recipes": ["urn:li:digitalmediaRecipe:feedshare-video"],
                "serviceRelationships": [
                    {"identifier": "urn:li:userGeneratedContent", "relationshipType": "OWNER"}
                ],
                "supportedUploadMechanism": ["SYNCHRONOUS_UPLOAD"],
            }
        }
        try:
            async with _httpx.AsyncClient() as client:
                reg_resp = await client.post(
                    f"{self.api_base}/assets?action=registerUpload",
                    json=register_payload,
                    headers=self._headers(access_token),
                    timeout=30.0,
                )
            reg_data = reg_resp.json()
        except Exception as exc:
            raise SocialProviderError("LinkedIn video register failed") from exc
        self._raise_for_error(reg_resp.status_code, reg_data)

        value = reg_data.get("value", {})
        asset_urn = value.get("asset")
        upload_url = (
            value.get("uploadMechanism", {})
            .get("com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest", {})
            .get("uploadUrl")
        )
        if not asset_urn or not upload_url:
            raise SocialProviderError("LinkedIn did not return asset URN or upload URL for video")

        try:
            async with _httpx.AsyncClient(timeout=300) as client:
                vid_resp = await client.get(video_url)
                vid_resp.raise_for_status()
                up_resp = await client.put(
                    upload_url,
                    content=vid_resp.content,
                    headers={"Authorization": f"Bearer {access_token}", "Content-Type": "video/mp4"},
                )
        except Exception as exc:
            raise SocialProviderError(f"LinkedIn video upload failed: {exc}") from exc

        return await self._publish_post(
            access_token,
            organization_urn,
            commentary,
            content={
                "media": {
                    "status": "READY",
                    "description": {"text": commentary[:200]},
                    "media": asset_urn,
                    "title": {"text": commentary[:100]},
                }
            },
        )

    async def publish_link_post(
        self,
        access_token: str,
        organization_urn: str,
        commentary: str,
        link_url: str,
    ) -> dict[str, Any]:
        return await self._publish_post(
            access_token,
            organization_urn,
            commentary,
            content={"article": {"source": link_url, "title": "Shared link"}},
        )

    async def _publish_post(
        self,
        access_token: str,
        organization_urn: str,
        commentary: str,
        content: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if not organization_urn.startswith("urn:li:organization:"):
            raise SocialProviderError("LinkedIn organization author URN is invalid")
        payload: dict[str, Any] = {
            "author": organization_urn,
            "commentary": commentary,
            "visibility": "PUBLIC",
            "distribution": {
                "feedDistribution": "MAIN_FEED",
                "targetEntities": [],
                "thirdPartyDistributionChannels": [],
            },
            "lifecycleState": "PUBLISHED",
            "isReshareDisabledByAuthor": False,
        }
        if content:
            payload["content"] = content
        data, headers = await self._post("/posts", access_token, json=payload)
        return {"id": headers.get("x-restli-id") or data.get("id"), "raw": data}

    async def _oauth_post(self, path: str, *, data: dict[str, Any]) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self.oauth_base}{path}",
                    data=data,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    timeout=30.0,
                )
                payload = resp.json()
        except Exception as exc:
            raise SocialProviderError("LinkedIn OAuth request failed") from exc
        self._raise_for_error(resp.status_code, payload)
        return payload

    async def _get(self, path: str, access_token: str, *, params: dict[str, Any]) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self.api_base}{path}",
                    params=params,
                    headers=self._headers(access_token),
                    timeout=30.0,
                )
                payload = resp.json()
        except Exception as exc:
            raise SocialProviderError("LinkedIn API request failed") from exc
        self._raise_for_error(resp.status_code, payload)
        return payload

    async def _post(self, path: str, access_token: str, *, json: dict[str, Any]) -> tuple[dict[str, Any], dict[str, str]]:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self.api_base}{path}",
                    json=json,
                    headers=self._headers(access_token),
                    timeout=30.0,
                )
                payload = resp.json() if resp.content else {}
        except Exception as exc:
            raise SocialProviderError("LinkedIn API request failed") from exc
        self._raise_for_error(resp.status_code, payload)
        return payload, dict(resp.headers)

    def _headers(self, access_token: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {access_token}",
            "LinkedIn-Version": self.api_version,
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
        }

    def _raise_for_error(self, status_code: int, data: dict[str, Any]) -> None:
        if status_code < 400 and "error" not in data and "serviceErrorCode" not in data:
            return
        message = (
            data.get("message")
            or data.get("error_description")
            or data.get("error")
            or "LinkedIn API error"
        )
        if status_code == 403 or "permission" in str(message).lower() or "scope" in str(message).lower():
            raise SocialProviderError(LINKEDIN_PERMISSION_ERROR)
        raise SocialProviderError(str(message))

    def _organization_id_from_urn(self, urn: str) -> str | None:
        if not urn.startswith("urn:li:organization:"):
            return None
        return urn.rsplit(":", 1)[-1] or None

    def _parse_scope(self, scope: str | None) -> list[str]:
        if not scope:
            return []
        return [part for part in scope.replace(",", " ").split() if part]

    def _seconds_from_now(self, seconds: Any) -> str | None:
        try:
            value = int(seconds)
        except (TypeError, ValueError):
            return None
        return (datetime.now(timezone.utc) + timedelta(seconds=value)).isoformat()

    def _logo_urn(self, logo: Any) -> str | None:
        if not isinstance(logo, dict):
            return None
        return logo.get("cropped") or logo.get("original")
