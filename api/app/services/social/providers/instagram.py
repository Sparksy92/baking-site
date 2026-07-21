from __future__ import annotations

from typing import Any
from urllib.parse import urlencode

import httpx

from app.config import Settings, get_settings
from app.services.social.providers.base import SocialAccount, SocialProviderError

INSTAGRAM_SCOPES = [
    "public_profile",
    "pages_show_list",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish",
]

INSTAGRAM_CAPTION_LIMIT = 2200


class InstagramProvider:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.api_version = self.settings.meta_api_version or "v25.0"
        self.graph_base = f"https://graph.facebook.com/{self.api_version}"
        self.dialog_base = f"https://www.facebook.com/{self.api_version}/dialog/oauth"

    @property
    def redirect_uri(self) -> str:
        return self.settings.meta_instagram_redirect_uri or self.settings.meta_redirect_uri

    @property
    def configured(self) -> bool:
        return bool(self.settings.meta_app_id and self.settings.meta_app_secret and self.redirect_uri)

    def assert_configured(self) -> None:
        if not self.configured:
            raise SocialProviderError("Server credentials not configured")

    def build_authorization_url(self, *, state: str) -> str:
        self.assert_configured()
        params = {
            "client_id": self.settings.meta_app_id,
            "redirect_uri": self.redirect_uri,
            "state": state,
            "scope": ",".join(INSTAGRAM_SCOPES),
            "response_type": "code",
        }
        return f"{self.dialog_base}?{urlencode(params)}"

    async def exchange_code_for_user_token(self, code: str) -> dict[str, Any]:
        self.assert_configured()
        return await self._get(
            "/oauth/access_token",
            params={
                "client_id": self.settings.meta_app_id,
                "client_secret": self.settings.meta_app_secret,
                "redirect_uri": self.redirect_uri,
                "code": code,
            },
        )

    async def exchange_for_long_lived_user_token(self, short_lived_token: str) -> dict[str, Any]:
        self.assert_configured()
        return await self._get(
            "/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": self.settings.meta_app_id,
                "client_secret": self.settings.meta_app_secret,
                "fb_exchange_token": short_lived_token,
            },
        )

    async def get_user_profile(self, user_token: str) -> dict[str, Any]:
        return await self._get("/me", params={"fields": "id,name", "access_token": user_token})

    async def list_facebook_pages_with_instagram_accounts(self, user_token: str) -> list[dict[str, Any]]:
        data = await self._get(
            "/me/accounts",
            params={
                "fields": (
                    "id,name,category,access_token,"
                    "instagram_business_account{id,username,name,profile_picture_url,media_count}"
                ),
                "access_token": user_token,
                "limit": 100,
            },
        )
        return data.get("data", [])

    async def list_instagram_accounts(self, user_token: str) -> list[SocialAccount]:
        pages = await self.list_facebook_pages_with_instagram_accounts(user_token)
        accounts: list[SocialAccount] = []
        for page in pages:
            ig = page.get("instagram_business_account")
            page_token = page.get("access_token")
            if not ig or not page_token or not ig.get("id"):
                continue
            username = ig.get("username") or ig.get("name") or f"ig_{ig['id']}"
            metadata = {
                "instagram_username": ig.get("username"),
                "instagram_account_name": ig.get("name"),
                "instagram_profile_picture_url": ig.get("profile_picture_url"),
                "linked_facebook_page_id": page.get("id"),
                "linked_facebook_page_name": page.get("name"),
                "media_count": ig.get("media_count"),
                "account_type": "professional_account",
            }
            accounts.append(
                SocialAccount(
                    id=str(ig["id"]),
                    name=str(username),
                    category="professional_account",
                    access_token=str(page_token),
                    scopes=INSTAGRAM_SCOPES,
                    metadata=metadata,
                )
            )
        return accounts

    async def get_instagram_account_details(self, ig_user_id: str, token: str) -> dict[str, Any]:
        return await self._get(
            f"/{ig_user_id}",
            params={
                "fields": "id,username,name,profile_picture_url,media_count",
                "access_token": token,
            },
        )

    async def test_instagram_connection(self, token: str, ig_user_id: str) -> dict[str, Any]:
        data = await self.get_instagram_account_details(ig_user_id, token)
        return {
            "ok": True,
            "ig_user_id": data.get("id"),
            "username": data.get("username"),
            "name": data.get("name"),
        }

    async def create_image_media_container(
        self,
        token: str,
        ig_user_id: str,
        image_url: str,
        caption: str,
    ) -> dict[str, Any]:
        return await self._post(
            f"/{ig_user_id}/media",
            data={
                "image_url": image_url,
                "caption": caption,
                "access_token": token,
            },
        )

    async def publish_media_container(self, token: str, ig_user_id: str, creation_id: str) -> dict[str, Any]:
        return await self._post(
            f"/{ig_user_id}/media_publish",
            data={"creation_id": creation_id, "access_token": token},
        )

    async def publish_single_image_post(
        self,
        token: str,
        ig_user_id: str,
        image_url: str,
        caption: str,
    ) -> dict[str, Any]:
        container = await self.create_image_media_container(token, ig_user_id, image_url, caption)
        creation_id = container.get("id")
        if not creation_id:
            raise SocialProviderError("Instagram did not return a media container ID")
        return await self.publish_media_container(token, ig_user_id, str(creation_id))

    async def publish_story(
        self,
        token: str,
        ig_user_id: str,
        image_url: str,
    ) -> dict[str, Any]:
        """Publish an Instagram image Story (ephemeral, 24h).

        Uses media_type=STORIES in the container creation call.
        Stories do not support captions — any caption param is ignored by the API.
        Returns the published media dict with 'id'.
        """
        container = await self._post(
            f"/{ig_user_id}/media",
            data={
                "image_url": image_url,
                "media_type": "STORIES",
                "access_token": token,
            },
        )
        creation_id = container.get("id")
        if not creation_id:
            raise SocialProviderError("Instagram did not return a Story container ID")
        return await self.publish_media_container(token, ig_user_id, str(creation_id))

    async def _get(self, path: str, *, params: dict[str, Any]) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"{self.graph_base}{path}", params=params, timeout=30.0)
                data = resp.json()
        except Exception as exc:
            raise SocialProviderError("Instagram API request failed") from exc
        self._raise_for_graph_error(resp.status_code, data)
        return data

    async def _post(self, path: str, *, data: dict[str, Any]) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(f"{self.graph_base}{path}", data=data, timeout=30.0)
                payload = resp.json()
        except Exception as exc:
            raise SocialProviderError("Instagram API request failed") from exc
        self._raise_for_graph_error(resp.status_code, payload)
        return payload

    def _raise_for_graph_error(self, status_code: int, data: dict[str, Any]) -> None:
        if status_code >= 400 or "error" in data:
            error = data.get("error") or {}
            message = error.get("message") or "Instagram API error"
            raise SocialProviderError(message)
