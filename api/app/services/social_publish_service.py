"""Outbound social publishing service.

Sprint 3: Facebook and Instagram via Meta Graph API.
Sprint 4: LinkedIn, TikTok, X will be added here.

Each platform returns a platform_post_id on success or raises on failure.
Callers store the result in social_posts and update status accordingly.
"""
from __future__ import annotations

import logging
import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.facebook.com/v19.0"


class PublishError(Exception):
    """Raised when a platform API call fails. Message is user-displayable."""


# ── Facebook ─────────────────────────────────────────────────────────────────

async def publish_to_facebook(content: str, image_url: str | None) -> str:
    """Post to the configured Facebook Page.

    Returns the platform post ID (e.g. '123456789_987654321').
    Raises PublishError on failure.
    """
    settings = get_settings()
    if not settings.meta_page_access_token or not settings.meta_facebook_page_id:
        raise PublishError("Facebook not configured. Set META_PAGE_ACCESS_TOKEN and META_FACEBOOK_PAGE_ID.")

    url = f"{GRAPH_BASE}/{settings.meta_facebook_page_id}/feed"
    payload: dict = {
        "message": content,
        "access_token": settings.meta_page_access_token,
    }

    if image_url:
        absolute_url = _make_absolute(image_url, settings.store_domain)
        payload["link"] = absolute_url

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, data=payload, timeout=30.0)
            data = resp.json()

        if "error" in data:
            raise PublishError(f"Facebook API error: {data['error'].get('message', 'Unknown error')}")

        post_id = data.get("id")
        if not post_id:
            raise PublishError("Facebook returned no post ID")

        logger.info(f"Published to Facebook: post_id={post_id}")
        return post_id

    except PublishError:
        raise
    except Exception as e:
        raise PublishError(f"Facebook publish failed: {e}") from e


# ── Instagram ────────────────────────────────────────────────────────────────

async def publish_to_instagram(content: str, image_url: str | None) -> str:
    """Post to the configured Instagram Business Account.

    Instagram Graph API requires a 2-step process:
      1. Create a media container (requires an image URL — Instagram rejects text-only posts)
      2. Publish the container

    Returns the media ID on success.
    Raises PublishError on failure or if no image is available.
    """
    settings = get_settings()
    if not settings.meta_page_access_token or not settings.meta_instagram_account_id:
        raise PublishError("Instagram not configured. Set META_PAGE_ACCESS_TOKEN and META_INSTAGRAM_ACCOUNT_ID.")

    if not image_url:
        raise PublishError(
            "Instagram requires an image. Set a featured image on the blog post before publishing to Instagram."
        )

    absolute_image = _make_absolute(image_url, settings.store_domain)

    async with httpx.AsyncClient() as client:
        # Step 1 — Create media container
        container_url = f"{GRAPH_BASE}/{settings.meta_instagram_account_id}/media"
        container_payload = {
            "image_url": absolute_image,
            "caption": content,
            "access_token": settings.meta_page_access_token,
        }
        try:
            resp = await client.post(container_url, data=container_payload, timeout=30.0)
            data = resp.json()
        except Exception as e:
            raise PublishError(f"Instagram container creation failed: {e}") from e

        if "error" in data:
            raise PublishError(f"Instagram API error (container): {data['error'].get('message', 'Unknown error')}")

        container_id = data.get("id")
        if not container_id:
            raise PublishError("Instagram returned no container ID")

        # Step 2 — Publish container
        publish_url = f"{GRAPH_BASE}/{settings.meta_instagram_account_id}/media_publish"
        publish_payload = {
            "creation_id": container_id,
            "access_token": settings.meta_page_access_token,
        }
        try:
            resp = await client.post(publish_url, data=publish_payload, timeout=30.0)
            data = resp.json()
        except Exception as e:
            raise PublishError(f"Instagram publish step failed: {e}") from e

        if "error" in data:
            raise PublishError(f"Instagram API error (publish): {data['error'].get('message', 'Unknown error')}")

        media_id = data.get("id")
        if not media_id:
            raise PublishError("Instagram returned no media ID after publish")

        logger.info(f"Published to Instagram: media_id={media_id}")
        return media_id


# ── Dispatcher ───────────────────────────────────────────────────────────────

async def publish_post(platform: str, content: str, image_url: str | None) -> str:
    """Dispatch to the correct platform publisher.

    Returns platform_post_id on success.
    Raises PublishError with a user-displayable message on failure.
    """
    if platform == "facebook":
        return await publish_to_facebook(content, image_url)
    elif platform == "instagram":
        return await publish_to_instagram(content, image_url)
    else:
        raise PublishError(
            f"Outbound publishing for '{platform}' is not yet implemented. "
            f"LinkedIn and TikTok are coming in Sprint 4."
        )


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_absolute(url: str, domain: str) -> str:
    """Ensure image URL is absolute. Relative paths are prefixed with store domain."""
    if url.startswith("http://") or url.startswith("https://"):
        return url
    domain = domain.rstrip("/")
    url = url.lstrip("/")
    return f"{domain}/{url}"
