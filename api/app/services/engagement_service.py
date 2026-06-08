"""Engagement metrics sync service.

Polls Meta Graph API for insights on published posts. Stores reach,
impressions, likes, comments, shares, clicks in social_posts.

Runs as a background task every 4 hours. Manual trigger available via admin API.

Meta insights endpoint: /{post_id}/insights
Metrics available:
  - post_impressions (reach)
  - post_engaged_users
  - post_reactions_by_type_total (like, love, wow, etc)
  - post_comments
  - post_shares
  - post_clicks
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

import httpx

from app.config import get_settings
from app.database import db_connection

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.facebook.com/v19.0"


async def sync_all_engagement_metrics() -> dict:
    """Fetch and store engagement metrics for all published posts.

    Returns summary: {synced: int, failed: int, skipped: int}
    """
    settings = get_settings()
    summary = {"synced": 0, "failed": 0, "skipped": 0}

    if not settings.meta_page_access_token:
        logger.info("Meta not configured — skipping engagement sync")
        return summary

    # Find published posts needing metrics update (updated > 4 hours ago or never)
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=4)).isoformat()

    try:
        async with db_connection() as db:
            cursor = await db.execute(
                """SELECT id, platform, platform_post_id, metrics_updated_at
                   FROM social_posts
                   WHERE status = 'published'
                   AND platform_post_id IS NOT NULL
                   AND platform IN ('facebook', 'instagram')
                   AND (metrics_updated_at IS NULL OR metrics_updated_at < ?)
                   ORDER BY published_at DESC
                   LIMIT 50""",
                (cutoff,),
            )
            posts = await cursor.fetchall()
    except Exception as e:
        logger.error(f"Engagement sync failed to query posts: {e}")
        return summary

    if not posts:
        logger.debug("No posts need engagement sync")
        return summary

    for post in posts:
        post_id = post["id"]
        platform = post["platform"]
        platform_post_id = post["platform_post_id"]

        if not platform_post_id:
            summary["skipped"] += 1
            continue

        try:
            metrics = await _fetch_meta_insights(platform_post_id, platform, settings.meta_page_access_token)
            await _store_metrics(post_id, metrics)
            summary["synced"] += 1
            logger.info(f"Synced metrics for post {post_id}: impressions={metrics.get('impressions', 0)}")

        except Exception as e:
            logger.error(f"Failed to sync metrics for post {post_id}: {e}")
            summary["failed"] += 1

    return summary


async def _fetch_meta_insights(post_id: str, platform: str, access_token: str) -> dict:
    """Fetch insights from Meta Graph API for a single post.

    Returns dict with: impressions, reach, likes, comments, shares, clicks
    """
    metrics = "post_impressions,post_impressions_unique,post_reactions_by_type_total,post_comments,post_shares,post_clicks"

    url = f"{GRAPH_BASE}/{post_id}/insights"
    params = {
        "metric": metrics,
        "access_token": access_token,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params, timeout=15.0)
        data = resp.json()

    if "error" in data:
        raise ValueError(f"Meta API error: {data['error'].get('message', 'Unknown')}")

    insights = data.get("data", [])
    result = {
        "impressions": 0,
        "reach": 0,
        "likes": 0,
        "comments": 0,
        "shares": 0,
        "clicks": 0,
    }

    for item in insights:
        name = item.get("name", "")
        values = item.get("values", [{}])
        value = values[0].get("value", 0) if values else 0

        if name == "post_impressions":
            result["impressions"] = value
        elif name == "post_impressions_unique":
            result["reach"] = value
        elif name == "post_reactions_by_type_total" and isinstance(value, dict):
            result["likes"] = value.get("like", 0) + value.get("love", 0)
        elif name == "post_comments":
            result["comments"] = value
        elif name == "post_shares":
            result["shares"] = value
        elif name == "post_clicks":
            result["clicks"] = value

    return result


async def _store_metrics(post_id: int, metrics: dict) -> None:
    """Store engagement metrics on social_posts row."""
    async with db_connection() as db:
        await db.execute(
            """UPDATE social_posts
               SET impressions = ?, reach = ?, likes = ?, comments_count = ?,
                   shares = ?, clicks = ?, metrics_updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (
                metrics.get("impressions", 0),
                metrics.get("reach", 0),
                metrics.get("likes", 0),
                metrics.get("comments", 0),
                metrics.get("shares", 0),
                metrics.get("clicks", 0),
                post_id,
            ),
        )
        await db.commit()
