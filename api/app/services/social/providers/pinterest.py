"""Pinterest provider — OAuth + Pin publishing via Pinterest API v5."""
from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlencode

import httpx

from app.config import Settings, get_settings
from app.services.social.providers.base import SocialAccount, SocialProviderError

logger = logging.getLogger(__name__)

PINTEREST_SCOPES = [
    "boards:read",
    "pins:read",
    "pins:write",
    "user_accounts:read",
]

PINTEREST_API_BASE = "https://api.pinterest.com/v5"
PINTEREST_AUTH_URL = "https://www.pinterest.com/oauth/"
PINTEREST_TOKEN_URL = "https://api.pinterest.com/v5/oauth/token"


class PinterestProvider:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    @property
    def client_id(self) -> str:
        return self.settings.pinterest_client_id or ""

    @property
    def client_secret(self) -> str:
        return self.settings.pinterest_client_secret or ""

    @property
    def redirect_uri(self) -> str:
        return f"{self.settings.store_domain}/api/social/callback/pinterest"

    def get_auth_url(self, state: str) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": ",".join(PINTEREST_SCOPES),
            "state": state,
        }
        return f"{PINTEREST_AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str) -> dict[str, Any]:
        """Exchange authorization code for access + refresh tokens."""
        import base64
        credentials = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode()).decode()
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                PINTEREST_TOKEN_URL,
                headers={
                    "Authorization": f"Basic {credentials}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                },
            )
        data = resp.json()
        if "access_token" not in data:
            raise SocialProviderError(f"Pinterest token exchange failed: {data}")
        return data

    async def _get(self, path: str, token: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{PINTEREST_API_BASE}{path}",
                headers={"Authorization": f"Bearer {token}"},
            )
        return resp.json()

    async def _post(self, path: str, token: str, payload: dict) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{PINTEREST_API_BASE}{path}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        return resp.json()

    async def get_user_info(self, token: str) -> dict[str, Any]:
        """Get the authenticated Pinterest user's account details."""
        data = await self._get("/user_account", token)
        if "username" not in data:
            raise SocialProviderError(f"Failed to get Pinterest user info: {data}")
        return {
            "username": data.get("username"),
            "display_name": data.get("profile_name") or data.get("username"),
            "profile_image": data.get("profile_image"),
        }

    async def get_boards(self, token: str) -> list[dict[str, Any]]:
        """List the user's boards."""
        data = await self._get("/boards", token)
        items = data.get("items", [])
        return [{"id": b["id"], "name": b["name"], "pin_count": b.get("pin_count", 0)} for b in items]

    async def publish_pin(
        self,
        token: str,
        board_id: str,
        title: str,
        description: str,
        image_url: str | None = None,
        video_url: str | None = None,
        link: str | None = None,
    ) -> str:
        """Create a Pin on the given board. Returns the new Pin ID.

        Pinterest API v5 requires either media_source.url for image pins
        or media_source.url for video pins with media_type='video'.
        """
        if not image_url and not video_url:
            raise SocialProviderError("Pinterest requires at least an image_url or video_url.")

        media_source: dict[str, Any]
        if video_url:
            media_source = {
                "source_type": "video_url",
                "url": video_url,
            }
        else:
            media_source = {
                "source_type": "image_url",
                "url": image_url,
                "is_standard": True,
            }

        payload: dict[str, Any] = {
            "board_id": board_id,
            "title": title[:100],
            "description": description[:500],
            "media_source": media_source,
        }
        if link:
            payload["link"] = link

        data = await self._post("/pins", token, payload)
        if "id" not in data:
            raise SocialProviderError(f"Pinterest Pin creation failed: {data}")

        logger.info(f"Pinterest Pin created: id={data['id']} board={board_id}")
        return data["id"]
