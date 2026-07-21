from __future__ import annotations

import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode, urlparse

import httpx

from app.config import Settings, get_settings
from app.services.social.providers.base import SocialAccount, SocialProviderError

X_REQUIRED_SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"]
X_WRITE_ACCESS_ERROR = (
    "X rejected the post because the app does not have write access. "
    "Confirm app permissions and API access in the X Developer Portal, then reconnect the account."
)
X_MISSING_WRITE_SCOPE_ERROR = "This account was connected without tweet.write permission. Reconnect X/Twitter and approve write access."
X_MEDIA_DISABLED_ERROR = "X media posting is not enabled yet. Text and link posts are available."
X_DEFAULT_TEST_POST = "Test post from the ecommerce social platform. This confirms X/Twitter publishing is connected."


class XProvider:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.api_base = (self.settings.x_api_base_url or "https://api.x.com").rstrip("/")
        self.auth_url = "https://x.com/i/oauth2/authorize"

    @property
    def configured(self) -> bool:
        return bool(self.settings.x_client_id and self.settings.x_redirect_uri)

    @property
    def media_posts_enabled(self) -> bool:
        return bool(self.settings.x_enable_media_posts)

    @property
    def max_caption_characters(self) -> int:
        return int(self.settings.x_max_caption_characters or 280)

    @property
    def scopes(self) -> list[str]:
        return list(X_REQUIRED_SCOPES)

    def assert_configured(self) -> None:
        if not self.configured:
            raise SocialProviderError("Server credentials not configured")

    def generate_pkce_code_verifier(self) -> str:
        return secrets.token_urlsafe(64)[:128]

    def generate_pkce_code_challenge(self, code_verifier: str) -> str:
        digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
        return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")

    def build_authorization_url(self, *, state: str, code_challenge: str) -> str:
        self.assert_configured()
        params = {
            "response_type": "code",
            "client_id": self.settings.x_client_id,
            "redirect_uri": self.settings.x_redirect_uri,
            "scope": " ".join(self.scopes),
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
        return f"{self.auth_url}?{urlencode(params)}"

    async def exchange_code_for_access_token(self, code: str, code_verifier: str) -> dict[str, Any]:
        self.assert_configured()
        return await self._oauth_post(
            {
                "code": code,
                "grant_type": "authorization_code",
                "client_id": self.settings.x_client_id,
                "redirect_uri": self.settings.x_redirect_uri,
                "code_verifier": code_verifier,
            }
        )

    async def refresh_access_token(self, refresh_token: str) -> dict[str, Any]:
        self.assert_configured()
        return await self._oauth_post(
            {
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
                "client_id": self.settings.x_client_id,
            }
        )

    async def revoke_token(self, token: str) -> dict[str, Any]:
        self.assert_configured()
        return await self._oauth_post({"token": token, "client_id": self.settings.x_client_id}, path="/2/oauth2/revoke")

    async def get_current_user_profile(self, access_token: str) -> dict[str, Any]:
        return await self._get(
            "/2/users/me",
            access_token,
            params={
                "user.fields": "id,name,username,profile_image_url,verified,verified_type,protected,description,public_metrics",
            },
        )

    async def test_x_connection(self, access_token: str) -> dict[str, Any]:
        profile = await self.get_current_user_profile(access_token)
        user = profile.get("data", {})
        return {
            "user_id": user.get("id"),
            "username": user.get("username"),
            "display_name": user.get("name"),
            "profile_image_url": user.get("profile_image_url"),
        }

    def account_from_token_data(self, token_data: dict[str, Any], profile: dict[str, Any]) -> SocialAccount:
        user = profile.get("data", {})
        user_id = user.get("id")
        if not user_id:
            raise SocialProviderError("X did not return a user ID")
        access_token = token_data.get("access_token")
        if not access_token:
            raise SocialProviderError("X did not return an access token")
        scopes = self._parse_scopes(token_data.get("scope"))
        username = user.get("username")
        name = user.get("name") or username or f"X user {user_id}"
        metadata = {
            "username": username,
            "name": user.get("name"),
            "profile_image_url": user.get("profile_image_url"),
            "verified": user.get("verified"),
            "verified_type": user.get("verified_type"),
            "protected": user.get("protected"),
            "description": user.get("description"),
            "public_metrics": user.get("public_metrics"),
            "x_api_access_note": "Confirm write permissions and paid/usage-enabled API access in the X Developer Portal before enabling auto-publish.",
            "media_posts_enabled": self.media_posts_enabled,
        }
        return SocialAccount(
            id=str(user_id),
            name=str(name),
            category="user_account",
            access_token=str(access_token),
            scopes=scopes,
            metadata=metadata,
            refresh_token=token_data.get("refresh_token"),
            token_expires_at=self._seconds_from_now(token_data.get("expires_in")),
            refresh_token_expires_at=None,
        )

    def validate_text(self, text: str | None, *, allow_empty: bool = False) -> str:
        value = (text or "").strip()
        if not value and not allow_empty:
            raise ValueError("X/Twitter post text is required.")
        if len(value) > self.max_caption_characters:
            raise ValueError(f"X/Twitter posts must be {self.max_caption_characters} characters or fewer.")
        return value

    def validate_url(self, url: str | None) -> str:
        value = (url or "").strip()
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("A valid http or https link URL is required.")
        return value

    def combine_text_and_link(self, text: str, link_url: str) -> str:
        text_value = self.validate_text(text)
        link_value = self.validate_url(link_url)
        combined = f"{text_value}\n{link_value}"
        if len(combined) > self.max_caption_characters:
            raise ValueError(f"X/Twitter post text and URL must fit within {self.max_caption_characters} characters.")
        return combined

    async def publish_text_post(self, access_token: str, text: str) -> dict[str, Any]:
        text = self.validate_text(text)
        return await self._post("/2/tweets", access_token, json={"text": text})

    async def publish_link_post(self, access_token: str, text: str, link_url: str) -> dict[str, Any]:
        return await self.publish_text_post(access_token, self.combine_text_and_link(text, link_url))

    async def upload_media(self, _access_token: str, _media: Any) -> dict[str, Any]:
        if not self.media_posts_enabled:
            raise SocialProviderError(X_MEDIA_DISABLED_ERROR)
        raise SocialProviderError(X_MEDIA_DISABLED_ERROR)

    async def publish_media_post(self, _access_token: str, _text: str | None, _media_ids: list[str]) -> dict[str, Any]:
        if not self.media_posts_enabled:
            raise SocialProviderError(X_MEDIA_DISABLED_ERROR)
        raise SocialProviderError(X_MEDIA_DISABLED_ERROR)

    async def _oauth_post(self, data: dict[str, Any], path: str = "/2/oauth2/token") -> dict[str, Any]:
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        if self.settings.x_client_secret:
            raw = f"{self.settings.x_client_id}:{self.settings.x_client_secret}".encode("utf-8")
            headers["Authorization"] = f"Basic {base64.b64encode(raw).decode('ascii')}"
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(f"{self.api_base}{path}", data=data, headers=headers, timeout=30.0)
                payload = resp.json() if resp.content else {}
        except Exception as exc:
            raise SocialProviderError("X OAuth request failed") from exc
        self._raise_for_error(resp.status_code, payload)
        return payload

    async def _get(self, path: str, access_token: str, *, params: dict[str, Any]) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"{self.api_base}{path}", params=params, headers=self._headers(access_token), timeout=30.0)
                payload = resp.json() if resp.content else {}
        except Exception as exc:
            raise SocialProviderError("X API request failed") from exc
        self._raise_for_error(resp.status_code, payload)
        return payload

    async def _post(self, path: str, access_token: str, *, json: dict[str, Any]) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(f"{self.api_base}{path}", json=json, headers=self._headers(access_token), timeout=30.0)
                payload = resp.json() if resp.content else {}
        except Exception as exc:
            raise SocialProviderError("X API request failed") from exc
        self._raise_for_error(resp.status_code, payload)
        return payload

    def _headers(self, access_token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    def _raise_for_error(self, status_code: int, data: dict[str, Any]) -> None:
        if status_code < 400 and not data.get("errors"):
            return
        message = self._extract_error_message(data) or "X API error"
        lowered = message.lower()
        if "tweet.write" in lowered or "scope" in lowered:
            raise SocialProviderError(X_MISSING_WRITE_SCOPE_ERROR)
        if status_code in {401, 403} and any(part in lowered for part in ("write", "permission", "access", "forbidden", "unauthorized")):
            raise SocialProviderError(X_WRITE_ACCESS_ERROR)
        if status_code == 429 or "rate limit" in lowered:
            raise SocialProviderError("X rate limit reached. Try again later.")
        raise SocialProviderError(message)

    def _extract_error_message(self, data: dict[str, Any]) -> str:
        if isinstance(data.get("error"), str):
            return data["error_description"] if data.get("error_description") else data["error"]
        errors = data.get("errors")
        if isinstance(errors, list) and errors:
            first = errors[0]
            if isinstance(first, dict):
                return first.get("detail") or first.get("title") or first.get("message") or str(first)
            return str(first)
        if isinstance(data.get("detail"), str):
            return data["detail"]
        if isinstance(data.get("title"), str):
            return data["title"]
        return ""

    def _parse_scopes(self, scope: str | None) -> list[str]:
        if not scope:
            return []
        return [part for part in scope.replace(",", " ").split() if part]

    def _seconds_from_now(self, seconds: Any) -> str | None:
        try:
            value = int(seconds)
        except (TypeError, ValueError):
            return None
        return (datetime.now(timezone.utc) + timedelta(seconds=value)).isoformat()
