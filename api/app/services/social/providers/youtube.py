"""YouTube Data API v3 OAuth provider.

Handles Google OAuth 2.0 for YouTube channel access.

Scopes required:
  https://www.googleapis.com/auth/youtube.upload
  https://www.googleapis.com/auth/youtube.readonly
"""
from __future__ import annotations

from typing import Any
from urllib.parse import urlencode

import httpx

from app.config import Settings, get_settings
from app.services.social.providers.base import SocialProviderError

YOUTUBE_SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
]

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
YOUTUBE_CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels"


class YouTubeProvider:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    @property
    def configured(self) -> bool:
        return bool(
            self.settings.youtube_client_id
            and self.settings.youtube_client_secret
            and self.settings.youtube_redirect_uri
        )

    def assert_configured(self) -> None:
        if not self.configured:
            raise SocialProviderError(
                "YouTube credentials not configured. "
                "Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REDIRECT_URI."
            )

    def build_authorization_url(self, *, state: str) -> str:
        self.assert_configured()
        params = {
            "client_id": self.settings.youtube_client_id,
            "redirect_uri": self.settings.youtube_redirect_uri,
            "response_type": "code",
            "scope": " ".join(YOUTUBE_SCOPES),
            "access_type": "offline",   # get refresh token
            "prompt": "consent",        # force consent to always return refresh token
            "state": state,
        }
        return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    async def exchange_code_for_access_token(self, code: str) -> dict[str, Any]:
        self.assert_configured()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.settings.youtube_redirect_uri,
                    "client_id": self.settings.youtube_client_id,
                    "client_secret": self.settings.youtube_client_secret,
                },
            )
        data = resp.json()
        if "error" in data:
            raise SocialProviderError(f"Google token exchange failed: {data.get('error_description', data['error'])}")
        return data

    async def refresh_access_token(self, refresh_token: str) -> dict[str, Any]:
        self.assert_configured()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": self.settings.youtube_client_id,
                    "client_secret": self.settings.youtube_client_secret,
                },
            )
        data = resp.json()
        if "error" in data:
            raise SocialProviderError(f"Google token refresh failed: {data.get('error_description', data['error'])}")
        return data

    async def get_channel_info(self, access_token: str) -> dict[str, Any]:
        """Return the authenticated user's YouTube channel details."""
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                YOUTUBE_CHANNELS_URL,
                headers={"Authorization": f"Bearer {access_token}"},
                params={"part": "snippet,statistics", "mine": "true"},
            )
        data = resp.json()
        if "error" in data:
            raise SocialProviderError(f"YouTube channel lookup failed: {data['error'].get('message', 'Unknown')}")
        items = data.get("items", [])
        if not items:
            raise SocialProviderError("No YouTube channel found for this Google account.")
        ch = items[0]
        return {
            "channel_id": ch["id"],
            "title": ch["snippet"]["title"],
            "custom_url": ch["snippet"].get("customUrl", ""),
            "subscriber_count": ch.get("statistics", {}).get("subscriberCount"),
            "thumbnail": ch["snippet"].get("thumbnails", {}).get("default", {}).get("url"),
        }

    async def get_user_profile(self, access_token: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
        return resp.json()
