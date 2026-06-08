"""Meta/Facebook/Instagram reply publishing service.

Publishes replies to comments via Meta Graph API.

Endpoints:
  - Facebook Page comments: POST /{post-id}/comments
  - Instagram comments: POST /{media-id}/comments (requires instagram_basic permission)

Note: This requires specific permissions that may need separate approval from Meta.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx

from app.config import get_settings
from app.database import db_connection

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.facebook.com/v19.0"


async def publish_facebook_reply(
    page_access_token: str,
    post_id: str,
    comment_id: str | None,  # if replying to a specific comment
    message: str,
) -> str:
    """Publish a reply to a Facebook post or comment.

    Args:
        page_access_token: Page access token (not user token)
        post_id: The post ID to reply to
        comment_id: Optional - reply to a specific comment thread
        message: Reply text

    Returns:
        The published comment ID
    """
    # If replying to a specific comment, use that as the parent
    if comment_id:
        url = f"{GRAPH_BASE}/{comment_id}/comments"
    else:
        url = f"{GRAPH_BASE}/{post_id}/comments"

    params = {
        "message": message,
        "access_token": page_access_token,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, params=params, timeout=15.0)
        data = resp.json()

    if "error" in data:
        error_msg = data["error"].get("message", "Unknown error")
        error_code = data["error"].get("code", "unknown")
        logger.error(f"Facebook reply failed: {error_msg} (code: {error_code})")
        raise PublishReplyError(f"Facebook API error: {error_msg}")

    comment_id = data.get("id")
    if not comment_id:
        raise PublishReplyError("No comment ID returned from Facebook")

    return comment_id


async def publish_instagram_reply(
    ig_account_id: str,  # Instagram Business Account ID
    media_id: str,       # Instagram media/post ID
    comment_id: str | None,  # if replying to a specific comment
    message: str,
    access_token: str,
) -> str:
    """Publish a reply to an Instagram comment.

    Requires instagram_basic permission.
    Note: Instagram replies must be to comments on your own posts.
    """
    # Get the comment ID to reply to
    if comment_id:
        reply_to_id = comment_id
    else:
        # Need to get a comment ID from the media
        # For simplicity, we'll reply to the media itself (creates a new top-level comment)
        reply_to_id = media_id

    url = f"{GRAPH_BASE}/{reply_to_id}/replies"

    params = {
        "message": message,
        "access_token": access_token,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, params=params, timeout=15.0)
        data = resp.json()

    if "error" in data:
        error_msg = data["error"].get("message", "Unknown error")
        error_code = data["error"].get("code", "unknown")
        logger.error(f"Instagram reply failed: {error_msg} (code: {error_code})")
        raise PublishReplyError(f"Instagram API error: {error_msg}")

    reply_id = data.get("id")
    if not reply_id:
        raise PublishReplyError("No reply ID returned from Instagram")

    return reply_id


async def send_reply_to_platform(
    engagement_event_id: int,
    reply_content: str,
) -> dict:
    """Main entry point: send a reply to the appropriate platform.

    Looks up the engagement event, determines platform, publishes reply.
    Updates the engagement event with external reply ID.
    """
    async with db_connection() as db:
        cursor = await db.execute(
            """SELECT e.*, sp.platform_post_id
               FROM social_engagement_events e
               LEFT JOIN social_posts sp ON e.platform_post_id = sp.platform_post_id
               WHERE e.id = ?""",
            (engagement_event_id,),
        )
        row = await cursor.fetchone()

    if not row:
        raise ValueError(f"Engagement event {engagement_event_id} not found")

    event = dict(row)
    platform = event["platform"]

    # Get credentials
    settings = get_settings()

    if platform == "facebook":
        if not settings.meta_page_access_token:
            raise PublishReplyError("Facebook not configured")

        external_comment_id = await publish_facebook_reply(
            page_access_token=settings.meta_page_access_token,
            post_id=event["platform_post_id"] or event["external_post_id"],
            comment_id=event["external_comment_id"],
            message=reply_content,
        )

    elif platform == "instagram":
        if not settings.meta_page_access_token:
            raise PublishReplyError("Instagram not configured")

        # For Instagram, we need the IG account ID and media ID
        # The platform_post_id from webhooks is the media ID
        external_comment_id = await publish_instagram_reply(
            ig_account_id=settings.meta_instagram_account_id or "",
            media_id=event["platform_post_id"] or event["external_post_id"],
            comment_id=event["external_comment_id"],
            message=reply_content,
            access_token=settings.meta_page_access_token,
        )

    elif platform == "linkedin":
        # LinkedIn replies not yet implemented
        raise PublishReplyError("LinkedIn replies not yet implemented")

    else:
        raise PublishReplyError(f"Unknown platform: {platform}")

    # Mark as replied in our DB
    async with db_connection() as db:
        await db.execute(
            """UPDATE social_engagement_events
               SET replied_at = ?, reply_content = ?, external_comment_id = ?
               WHERE id = ?""",
            (datetime.now(timezone.utc).isoformat(), reply_content, external_comment_id, engagement_event_id),
        )
        await db.commit()

    logger.info(f"Published reply to {platform}: engagement={engagement_event_id}, external_id={external_comment_id}")

    return {
        "sent": True,
        "platform": platform,
        "external_comment_id": external_comment_id,
    }


class PublishReplyError(Exception):
    """Error publishing reply to social platform."""
    pass
