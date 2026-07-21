from __future__ import annotations

import logging
import asyncio
from typing import Any
from urllib.parse import urlencode

import httpx

from app.config import Settings, get_settings
from app.services.social.providers.base import SocialPage, SocialProviderError

logger = logging.getLogger(__name__)

FACEBOOK_REQUEST_ATTEMPTS = 4
FACEBOOK_RETRY_DELAYS = (0.5, 1.5, 3.0)

_shared_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _shared_client
    if _shared_client is None or _shared_client.is_closed:
        _shared_client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=8.0),
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
        )
    return _shared_client

FACEBOOK_SCOPES = [
    "public_profile",
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
]


class FacebookProvider:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.api_version = self.settings.meta_api_version or "v25.0"
        self.graph_base = f"https://graph.facebook.com/{self.api_version}"
        self.dialog_base = f"https://www.facebook.com/{self.api_version}/dialog/oauth"

    @property
    def configured(self) -> bool:
        return bool(
            self.settings.meta_app_id
            and self.settings.meta_app_secret
            and self.settings.meta_redirect_uri
        )

    def assert_configured(self) -> None:
        if not self.configured:
            raise SocialProviderError("Server credentials not configured")

    def build_authorization_url(self, *, state: str) -> str:
        self.assert_configured()
        params: dict[str, str] = {
            "client_id": self.settings.meta_app_id,
            "redirect_uri": self.settings.meta_redirect_uri,
            "state": state,
            "response_type": "code",
        }
        if self.settings.meta_config_id:
            params["config_id"] = self.settings.meta_config_id
        else:
            params["scope"] = ",".join(FACEBOOK_SCOPES)
        return f"{self.dialog_base}?{urlencode(params)}"

    async def exchange_code_for_user_token(self, code: str) -> dict[str, Any]:
        self.assert_configured()
        params = {
            "client_id": self.settings.meta_app_id,
            "client_secret": self.settings.meta_app_secret,
            "redirect_uri": self.settings.meta_redirect_uri,
            "code": code,
        }
        return await self._get("/oauth/access_token", params=params)

    async def exchange_for_long_lived_user_token(self, short_lived_token: str) -> dict[str, Any]:
        self.assert_configured()
        params = {
            "grant_type": "fb_exchange_token",
            "client_id": self.settings.meta_app_id,
            "client_secret": self.settings.meta_app_secret,
            "fb_exchange_token": short_lived_token,
        }
        return await self._get("/oauth/access_token", params=params)

    async def get_user_profile(self, user_token: str) -> dict[str, Any]:
        return await self._get(
            "/me",
            params={"fields": "id,name"},
            token=user_token,
        )

    async def list_pages(self, user_token: str) -> list[SocialPage]:
        data = await self._get(
            "/me/accounts",
            params={
                "fields": "id,name,category,access_token,tasks",
                "limit": 100,
            },
            token=user_token,
        )
        raw_pages = data.get("data", [])
        pages: list[SocialPage] = []
        skipped_pages = 0
        for page in raw_pages:
            token = page.get("access_token")
            page_id = page.get("id")
            name = page.get("name")
            if not token or not page_id or not name:
                skipped_pages += 1
                continue
            pages.append(
                SocialPage(
                    id=str(page_id),
                    name=str(name),
                    category=page.get("category"),
                    access_token=str(token),
                    scopes=FACEBOOK_SCOPES,
                )
            )
        logger.info(
            "Facebook Pages listed: raw_count=%s usable_count=%s skipped_count=%s",
            len(raw_pages),
            len(pages),
            skipped_pages,
        )
        return pages

    async def get_page_connection_details(self, page_id: str, page_access_token: str) -> dict[str, Any]:
        return await self._get(
            f"/{page_id}",
            params={"fields": "id,name,category"},
            token=page_access_token,
        )

    async def test_page_connection(self, page_access_token: str, page_id: str) -> dict[str, Any]:
        data = await self.get_page_connection_details(page_id, page_access_token)
        return {"ok": True, "page_id": data.get("id"), "page_name": data.get("name")}

    async def publish_text_post(self, page_access_token: str, page_id: str, message: str) -> dict[str, Any]:
        return await self._post(
            f"/{page_id}/feed",
            data={"message": message},
            token=page_access_token,
        )

    async def publish_link_post(
        self,
        page_access_token: str,
        page_id: str,
        message: str,
        link: str,
    ) -> dict[str, Any]:
        return await self._post(
            f"/{page_id}/feed",
            data={"message": message, "link": link},
            token=page_access_token,
        )

    async def publish_image_post(
        self,
        page_access_token: str,
        page_id: str,
        message: str,
        image_url: str,
    ) -> dict[str, Any]:
        """Post a photo to a Facebook Page.

        Uses /{page_id}/photos with url= for hosted images.
        Returns {"id": "<post_id>"} on success.
        """
        return await self._post(
            f"/{page_id}/photos",
            data={"message": message, "url": image_url},
            token=page_access_token,
        )

    async def publish_video_post(
        self,
        page_access_token: str,
        page_id: str,
        description: str,
        video_url: str,
        *,
        is_reel: bool = False,
        title: str = "",
    ) -> dict[str, Any]:
        """Post a video or Reel to a Facebook Page.

        Uses /{page_id}/videos with file_url= for hosted videos.
        Pass is_reel=True to request Reel placement (content_category=REELS).
        Returns {"id": "<video_id>"} on success.
        """
        data: dict[str, Any] = {
            "description": description,
            "file_url": video_url,
        }
        if title:
            data["title"] = title
        if is_reel:
            data["content_category"] = "REELS"
        return await self._post(
            f"/{page_id}/videos",
            data=data,
            token=page_access_token,
        )

    async def publish_story(
        self,
        page_access_token: str,
        page_id: str,
        image_url: str,
    ) -> dict[str, Any]:
        """Post a photo Story to a Facebook Page.

        Stories expire after 24 hours automatically.
        Requires an image URL — text-only Stories are not supported by the API.
        Uses /{page_id}/photo_stories endpoint.
        Returns {"post_id": "<id>"} on success.
        """
        return await self._post(
            f"/{page_id}/photo_stories",
            data={"photo_id": image_url},
            token=page_access_token,
        )

    async def get_post_insights(
        self,
        page_access_token: str,
        platform_post_id: str,
    ) -> dict[str, Any]:
        """Fetch engagement metrics for a published Facebook post.

        Returns a dict with: likes, comments, shares, reach, impressions.
        Falls back to 0 for any metric not available.
        """
        fields = "likes.summary(true),comments.summary(true),shares"
        try:
            post_data = await self._get(
                f"/{platform_post_id}",
                params={"fields": fields},
                token=page_access_token,
            )
        except Exception:
            post_data = {}

        likes = post_data.get("likes", {}).get("summary", {}).get("total_count", 0)
        comments = post_data.get("comments", {}).get("summary", {}).get("total_count", 0)
        shares = post_data.get("shares", {}).get("count", 0)

        # Page-level reach requires /{post_id}/insights endpoint
        reach = 0
        impressions = 0
        try:
            insights = await self._get(
                f"/{platform_post_id}/insights",
                params={"metric": "post_impressions,post_impressions_unique"},
                token=page_access_token,
            )
            for item in insights.get("data", []):
                name = item.get("name", "")
                values = item.get("values", [{}])
                val = values[0].get("value", 0) if values else 0
                if name == "post_impressions_unique":
                    reach = val
                elif name == "post_impressions":
                    impressions = val
        except Exception:
            pass

        return {
            "likes": likes,
            "comments": comments,
            "shares": shares,
            "reach": reach,
            "impressions": impressions,
        }

    async def _get(self, path: str, *, params: dict[str, Any], token: str | None = None) -> dict[str, Any]:
        resp, data = await self._request_with_retry("GET", path, params=params, token=token)
        self._raise_for_graph_error(resp.status_code, data)
        return data

    async def _post(self, path: str, *, data: dict[str, Any], token: str | None = None) -> dict[str, Any]:
        resp, payload = await self._request_with_retry("POST", path, data=data, token=token)
        self._raise_for_graph_error(resp.status_code, payload)
        return payload

    async def _request_with_retry(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        data: dict[str, Any] | None = None,
        token: str | None = None,
    ) -> tuple[httpx.Response, dict[str, Any]]:
        last_exc: httpx.HTTPError | None = None
        url = f"{self.graph_base}{path}"
        client = _get_client()
        headers = {"Authorization": f"Bearer {token}"} if token else {}

        for attempt in range(1, FACEBOOK_REQUEST_ATTEMPTS + 1):
            try:
                if method == "POST":
                    resp = await client.post(url, data=data, headers=headers)
                else:
                    resp = await client.get(url, params=params, headers=headers)
                return resp, resp.json()
            except httpx.HTTPError as exc:
                last_exc = exc
                if attempt == FACEBOOK_REQUEST_ATTEMPTS:
                    break
                delay = FACEBOOK_RETRY_DELAYS[min(attempt - 1, len(FACEBOOK_RETRY_DELAYS) - 1)]
                logger.warning(
                    "Facebook API %s request failed for path %s on attempt %s/%s: %s",
                    method,
                    path,
                    attempt,
                    FACEBOOK_REQUEST_ATTEMPTS,
                    exc.__class__.__name__,
                )
                await asyncio.sleep(delay)
            except ValueError as exc:
                logger.exception("Facebook API %s response was not JSON for path %s", method, path)
                raise SocialProviderError("Facebook API returned an unreadable response") from exc

        assert last_exc is not None
        logger.exception(
            "Facebook API %s request failed for path %s after %s attempts",
            method,
            path,
            FACEBOOK_REQUEST_ATTEMPTS,
            exc_info=last_exc,
        )
        raise SocialProviderError(f"Facebook API request failed: {last_exc.__class__.__name__}") from last_exc

    def _raise_for_graph_error(self, status_code: int, data: dict[str, Any]) -> None:
        if status_code >= 400 or "error" in data:
            error = data.get("error") or {}
            message = error.get("message") or "Facebook API error"
            logger.warning(
                "Facebook Graph API returned error: status=%s type=%s code=%s subcode=%s message=%s",
                status_code,
                error.get("type"),
                error.get("code"),
                error.get("error_subcode"),
                message,
            )
            raise SocialProviderError(message)
