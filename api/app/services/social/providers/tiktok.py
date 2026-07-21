from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode, urlparse

import httpx

from app.config import Settings, get_settings
from app.services.social.providers.base import SocialAccount, SocialProviderError

TIKTOK_BASE_SCOPES = ["user.info.basic", "video.upload"]
TIKTOK_DIRECT_POST_SCOPE = "video.publish"
TIKTOK_TITLE_LIMIT = 2200
TIKTOK_DIRECT_POST_DISABLED_ERROR = "TikTok Direct Post is not enabled or the app has not been approved for video.publish."


class TikTokProvider:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.api_base = (self.settings.tiktok_api_base_url or "https://open.tiktokapis.com").rstrip("/")
        self.auth_url = "https://www.tiktok.com/v2/auth/authorize/"

    @property
    def configured(self) -> bool:
        return bool(self.settings.tiktok_client_key and self.settings.tiktok_client_secret and self.settings.tiktok_redirect_uri)

    @property
    def direct_post_enabled(self) -> bool:
        return bool(self.settings.tiktok_enable_direct_post)

    @property
    def scopes(self) -> list[str]:
        scopes = list(TIKTOK_BASE_SCOPES)
        if self.direct_post_enabled:
            scopes.append(TIKTOK_DIRECT_POST_SCOPE)
        return scopes

    def assert_configured(self) -> None:
        if not self.configured:
            raise SocialProviderError("Server credentials not configured")

    def build_authorization_url(self, *, state: str) -> str:
        self.assert_configured()
        params = {
            "client_key": self.settings.tiktok_client_key,
            "response_type": "code",
            "scope": ",".join(self.scopes),
            "redirect_uri": self.settings.tiktok_redirect_uri,
            "state": state,
        }
        return f"{self.auth_url}?{urlencode(params)}"

    async def exchange_code_for_access_token(self, code: str) -> dict[str, Any]:
        self.assert_configured()
        return await self._oauth_post(
            {
                "client_key": self.settings.tiktok_client_key,
                "client_secret": self.settings.tiktok_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": self.settings.tiktok_redirect_uri,
            }
        )

    async def refresh_access_token(self, refresh_token: str) -> dict[str, Any]:
        self.assert_configured()
        return await self._oauth_post(
            {
                "client_key": self.settings.tiktok_client_key,
                "client_secret": self.settings.tiktok_client_secret,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            }
        )

    async def revoke_token(self, access_token: str) -> dict[str, Any]:
        return await self._oauth_post(
            {
                "client_key": self.settings.tiktok_client_key,
                "client_secret": self.settings.tiktok_client_secret,
                "token": access_token,
            },
            path="/v2/oauth/revoke/",
        )

    async def get_current_user_profile(self, access_token: str) -> dict[str, Any]:
        return await self._get(
            "/v2/user/info/",
            access_token,
            params={"fields": "open_id,union_id,avatar_url,avatar_url_100,display_name,profile_deep_link,is_verified"},
        )

    async def test_tiktok_connection(self, access_token: str) -> dict[str, Any]:
        data = await self.get_current_user_profile(access_token)
        user = data.get("data", {}).get("user", data.get("user", {}))
        return {
            "open_id": user.get("open_id"),
            "display_name": user.get("display_name"),
            "avatar_url": user.get("avatar_url") or user.get("avatar_url_100"),
            "profile_deep_link": user.get("profile_deep_link"),
        }

    def account_from_token_data(self, token_data: dict[str, Any], profile: dict[str, Any]) -> SocialAccount:
        user = profile.get("data", {}).get("user", profile.get("user", {}))
        open_id = token_data.get("open_id") or user.get("open_id")
        if not open_id:
            raise SocialProviderError("TikTok did not return an open_id")
        scopes = self._parse_scopes(token_data.get("scope"))
        access_token = token_data.get("access_token")
        if not access_token:
            raise SocialProviderError("TikTok did not return an access token")
        display_name = user.get("display_name") or f"TikTok user {open_id}"
        metadata = {
            "open_id": open_id,
            "union_id": user.get("union_id"),
            "avatar_url": user.get("avatar_url") or user.get("avatar_url_100"),
            "display_name": user.get("display_name"),
            "username": user.get("username"),
            "profile_deep_link": user.get("profile_deep_link"),
            "profile_web_link": user.get("profile_web_link"),
            "is_verified": user.get("is_verified"),
            "direct_post_enabled": self.direct_post_enabled and TIKTOK_DIRECT_POST_SCOPE in scopes,
            "upload_to_inbox_enabled": "video.upload" in scopes,
            "app_review_status_note": None,
        }
        return SocialAccount(
            id=str(open_id),
            name=str(display_name),
            category="tiktok_user",
            access_token=str(access_token),
            scopes=scopes,
            metadata=metadata,
            refresh_token=token_data.get("refresh_token"),
            token_expires_at=self._seconds_from_now(token_data.get("expires_in")),
            refresh_token_expires_at=self._seconds_from_now(token_data.get("refresh_expires_in")),
        )

    def validate_video_url(self, video_url: str | None) -> str:
        if not video_url:
            raise ValueError("TikTok requires a public HTTPS video URL for this test.")
        parsed = urlparse(video_url)
        if parsed.scheme != "https" or not parsed.netloc:
            raise ValueError("TikTok requires a public HTTPS video URL.")
        return video_url

    def validate_photo_url(self, photo_url: str | None) -> str:
        if not photo_url:
            raise ValueError("TikTok requires a public HTTPS photo URL.")
        parsed = urlparse(photo_url)
        if parsed.scheme != "https" or not parsed.netloc:
            raise ValueError("TikTok requires a public HTTPS photo URL.")
        return photo_url

    async def query_creator_info(self, access_token: str) -> dict[str, Any]:
        return await self._post("/v2/post/publish/creator_info/query/", access_token, json={})

    async def init_video_upload_to_inbox(self, access_token: str, video_url: str) -> dict[str, Any]:
        video_url = self.validate_video_url(video_url)
        return await self._post(
            "/v2/post/publish/inbox/video/init/",
            access_token,
            json={"source_info": {"source": "PULL_FROM_URL", "video_url": video_url}},
        )

    async def init_video_direct_post(
        self,
        access_token: str,
        video_url: str,
        title: str,
        privacy_level: str,
        *,
        disable_duet: bool = False,
        disable_comment: bool = False,
        disable_stitch: bool = False,
    ) -> dict[str, Any]:
        if not self.direct_post_enabled:
            raise SocialProviderError(TIKTOK_DIRECT_POST_DISABLED_ERROR)
        video_url = self.validate_video_url(video_url)
        if len(title) > TIKTOK_TITLE_LIMIT:
            raise ValueError(f"TikTok captions must be {TIKTOK_TITLE_LIMIT} characters or fewer.")
        return await self._post(
            "/v2/post/publish/video/init/",
            access_token,
            json={
                "post_info": {
                    "title": title,
                    "privacy_level": privacy_level,
                    "disable_duet": disable_duet,
                    "disable_comment": disable_comment,
                    "disable_stitch": disable_stitch,
                },
                "source_info": {"source": "PULL_FROM_URL", "video_url": video_url},
            },
        )

    async def upload_video_binary(self, upload_url: str, file_content: bytes, content_type: str = "video/mp4") -> None:
        async with httpx.AsyncClient() as client:
            resp = await client.put(upload_url, content=file_content, headers={"Content-Type": content_type}, timeout=120.0)
        if resp.status_code >= 400:
            raise SocialProviderError(f"TikTok binary upload failed with status {resp.status_code}")

    async def check_publish_status(self, access_token: str, publish_id: str) -> dict[str, Any]:
        if not publish_id:
            raise ValueError("publish_id is required")
        return await self._post("/v2/post/publish/status/fetch/", access_token, json={"publish_id": publish_id})

    async def _oauth_post(self, data: dict[str, Any], path: str = "/v2/oauth/token/") -> dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self.api_base}{path}",
                    data=data,
                    headers={"Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache"},
                    timeout=30.0,
                )
                payload = resp.json()
        except Exception as exc:
            raise SocialProviderError("TikTok OAuth request failed") from exc
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
            raise SocialProviderError("TikTok API request failed") from exc
        self._raise_for_error(resp.status_code, payload)
        return payload

    async def _post(self, path: str, access_token: str, *, json: dict[str, Any]) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self.api_base}{path}",
                    json=json,
                    headers=self._headers(access_token),
                    timeout=60.0,
                )
                payload = resp.json() if resp.content else {}
        except Exception as exc:
            raise SocialProviderError("TikTok API request failed") from exc
        self._raise_for_error(resp.status_code, payload)
        return payload

    def _headers(self, access_token: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json; charset=UTF-8",
        }

    def _raise_for_error(self, status_code: int, data: dict[str, Any]) -> None:
        error = data.get("error")
        if status_code < 400 and (not isinstance(error, dict) or error.get("code") in (None, "ok")) and "error_description" not in data:
            return
        message = ""
        if isinstance(error, dict):
            message = error.get("message") or error.get("code") or ""
        message = message or data.get("error_description") or data.get("error") or "TikTok API error"
        if "scope" in str(message).lower() or "not_authorized" in str(message).lower() or "permission" in str(message).lower():
            raise SocialProviderError("TikTok app review or required scope approval is missing.")
        raise SocialProviderError(str(message))

    def _parse_scopes(self, scope: str | None) -> list[str]:
        if not scope:
            return []
        return [part for part in scope.replace(" ", ",").split(",") if part]

    def _seconds_from_now(self, seconds: Any) -> str | None:
        try:
            value = int(seconds)
        except (TypeError, ValueError):
            return None
        return (datetime.now(timezone.utc) + timedelta(seconds=value)).isoformat()
