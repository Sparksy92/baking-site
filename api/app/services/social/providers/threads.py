"""Threads (Meta) OAuth and publishing provider.

Threads uses the same Meta app credentials (meta_app_id / meta_app_secret) as
Instagram, but with a separate redirect URI and the Threads-specific scopes.
The API base is https://graph.threads.net (not graph.facebook.com).

OAuth flow:
  1. Redirect user to  https://threads.net/oauth/authorize
  2. Receive ?code= callback at THREADS_REDIRECT_URI
  3. Exchange code → short-lived user token
  4. Exchange short-lived → long-lived token (60-day)
  5. Publish via  POST /v1.0/{user-id}/threads  (create container)
               + POST /v1.0/{user-id}/threads_publish  (publish container)

Docs: https://developers.facebook.com/docs/threads
"""
from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlencode

import httpx

from app.config import Settings, get_settings
from app.services.social.providers.base import SocialProviderError

logger = logging.getLogger(__name__)

THREADS_AUTH_BASE   = "https://threads.net/oauth/authorize"
THREADS_TOKEN_URL   = "https://graph.threads.net/oauth/access_token"
THREADS_LONG_TOKEN  = "https://graph.threads.net/access_token"
THREADS_API_BASE    = "https://graph.threads.net/v1.0"

THREADS_SCOPES = [
    "threads_basic",
    "threads_content_publish",
    "threads_read_replies",
    "threads_manage_replies",
    "threads_manage_insights",
]

THREADS_CAPTION_LIMIT = 500


class ThreadsProvider:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    @property
    def app_id(self) -> str:
        return self.settings.meta_app_id

    @property
    def app_secret(self) -> str:
        return self.settings.meta_app_secret

    @property
    def redirect_uri(self) -> str:
        return self.settings.meta_threads_redirect_uri

    @property
    def configured(self) -> bool:
        return bool(self.app_id and self.app_secret and self.redirect_uri)

    def assert_configured(self) -> None:
        if not self.configured:
            raise SocialProviderError(
                "Threads credentials not configured. "
                "Set META_APP_ID, META_APP_SECRET, META_THREADS_REDIRECT_URI in .env"
            )

    def build_authorization_url(self, *, state: str) -> str:
        self.assert_configured()
        params = {
            "client_id":     self.app_id,
            "redirect_uri":  self.redirect_uri,
            "scope":         ",".join(THREADS_SCOPES),
            "response_type": "code",
            "state":         state,
        }
        return f"{THREADS_AUTH_BASE}?{urlencode(params)}"

    async def exchange_code_for_token(self, code: str) -> dict[str, Any]:
        """Exchange an auth code for a short-lived user token, then upgrade to long-lived."""
        self.assert_configured()
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                THREADS_TOKEN_URL,
                data={
                    "client_id":     self.app_id,
                    "client_secret": self.app_secret,
                    "redirect_uri":  self.redirect_uri,
                    "code":          code,
                    "grant_type":    "authorization_code",
                },
            )
            data = resp.json()

        if "error" in data:
            raise SocialProviderError(f"Threads token exchange failed: {data.get('error_message', data)}")

        short_token = data.get("access_token")
        if not short_token:
            raise SocialProviderError("Threads did not return an access token")

        # Upgrade to long-lived token (60 days)
        long_token_data = await self._exchange_for_long_lived(short_token)
        return {
            "access_token": long_token_data.get("access_token", short_token),
            "token_type":   long_token_data.get("token_type", "bearer"),
            "expires_in":   long_token_data.get("expires_in"),
            "user_id":      data.get("user_id"),
        }

    async def _exchange_for_long_lived(self, short_token: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                THREADS_LONG_TOKEN,
                params={
                    "grant_type":        "th_exchange_token",
                    "client_secret":     self.app_secret,
                    "access_token":      short_token,
                },
            )
            data = resp.json()
        if "error" in data:
            logger.warning("Threads long-lived token exchange failed: %s — using short-lived token", data)
            return {}
        return data

    async def refresh_long_lived_token(self, long_lived_token: str) -> dict[str, Any]:
        """Refresh a Threads long-lived token before it expires (60-day rolling window).

        Uses grant_type=th_refresh_token — call at least once every 60 days.
        Returns new token data dict with access_token and expires_in keys.
        Raises SocialProviderError on failure.
        """
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                THREADS_LONG_TOKEN,
                params={
                    "grant_type":   "th_refresh_token",
                    "access_token": long_lived_token,
                },
            )
            data = resp.json()
        if "error" in data:
            raise SocialProviderError(
                f"Threads token refresh failed: {data.get('error', {}).get('message', data)}"
            )
        return data

    async def get_user_info(self, access_token: str) -> dict[str, Any]:
        """Fetch the connected Threads user's profile."""
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                f"{THREADS_API_BASE}/me",
                params={
                    "fields":        "id,username,name,threads_profile_picture_url,threads_biography",
                    "access_token":  access_token,
                },
            )
            data = resp.json()
        if "error" in data:
            raise SocialProviderError(f"Threads user info failed: {data['error'].get('message', data)}")
        return data

    async def publish_text(
        self,
        user_id: str,
        access_token: str,
        text: str,
        *,
        link_attachment: str | None = None,
    ) -> str:
        """Publish a text-only Thread. Returns the Threads post ID."""
        container_id = await self._create_container(
            user_id=user_id,
            access_token=access_token,
            media_type="TEXT",
            text=text[:THREADS_CAPTION_LIMIT],
            link_attachment=link_attachment,
        )
        return await self._publish_container(user_id=user_id, access_token=access_token, container_id=container_id)

    async def publish_image(
        self,
        user_id: str,
        access_token: str,
        text: str,
        image_url: str,
    ) -> str:
        """Publish a single image Thread. Returns the Threads post ID."""
        container_id = await self._create_container(
            user_id=user_id,
            access_token=access_token,
            media_type="IMAGE",
            text=text[:THREADS_CAPTION_LIMIT],
            image_url=image_url,
        )
        return await self._publish_container(user_id=user_id, access_token=access_token, container_id=container_id)

    async def publish_video(
        self,
        user_id: str,
        access_token: str,
        text: str,
        video_url: str,
    ) -> str:
        """Publish a video Thread. Returns the Threads post ID."""
        container_id = await self._create_container(
            user_id=user_id,
            access_token=access_token,
            media_type="VIDEO",
            text=text[:THREADS_CAPTION_LIMIT],
            video_url=video_url,
        )
        return await self._publish_container(user_id=user_id, access_token=access_token, container_id=container_id)

    async def _create_container(
        self,
        *,
        user_id: str,
        access_token: str,
        media_type: str,
        text: str,
        image_url: str | None = None,
        video_url: str | None = None,
        link_attachment: str | None = None,
    ) -> str:
        payload: dict[str, Any] = {
            "media_type":    media_type,
            "text":          text,
            "access_token":  access_token,
        }
        if image_url:
            payload["image_url"] = image_url
        if video_url:
            payload["video_url"] = video_url
        if link_attachment:
            payload["link_attachment"] = link_attachment

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{THREADS_API_BASE}/{user_id}/threads",
                data=payload,
            )
            data = resp.json()

        if "error" in data:
            raise SocialProviderError(f"Threads container creation failed: {data['error'].get('message', data)}")

        container_id = data.get("id")
        if not container_id:
            raise SocialProviderError("Threads did not return a container ID")
        return container_id

    async def _publish_container(
        self, *, user_id: str, access_token: str, container_id: str
    ) -> str:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{THREADS_API_BASE}/{user_id}/threads_publish",
                data={
                    "creation_id":  container_id,
                    "access_token": access_token,
                },
            )
            data = resp.json()

        if "error" in data:
            raise SocialProviderError(f"Threads publish failed: {data['error'].get('message', data)}")

        post_id = data.get("id")
        if not post_id:
            raise SocialProviderError("Threads did not return a post ID after publish")
        return post_id

    async def get_post_insights(self, post_id: str, access_token: str) -> dict[str, Any]:
        """Fetch engagement metrics for a published Thread."""
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                f"{THREADS_API_BASE}/{post_id}/insights",
                params={
                    "metric":       "views,likes,replies,reposts,quotes",
                    "access_token": access_token,
                },
            )
            data = resp.json()
        if "error" in data:
            raise SocialProviderError(f"Threads insights failed: {data['error'].get('message', data)}")
        return data
