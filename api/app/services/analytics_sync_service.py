"""Analytics sync service — pull post metrics back from TikTok and YouTube.

Runs as a background job every 6 hours. For each published post on these
platforms that has no metrics yet (or metrics older than 12 h), fetches
up-to-date view counts, likes, comments, and shares and writes them back
to social_posts.

TikTok:  Query Creator Info API for video stats by platform_post_id.
YouTube: YouTube Data API v3 videos.list for statistics.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

from app.database import db_connection

logger = logging.getLogger(__name__)

# How old metrics must be before we refresh (hours)
REFRESH_AFTER_HOURS = 12
# How far back in time to look for published posts (days)
SYNC_WINDOW_DAYS = 30


async def sync_tiktok_metrics() -> dict:
    """Pull engagement metrics for published TikTok posts."""
    from app.services.social.service import get_connection
    from app.services.social.token_crypto import decrypt_token
    import httpx

    synced = 0
    failed = 0
    skipped = 0

    cutoff = (datetime.now(timezone.utc) - timedelta(days=SYNC_WINDOW_DAYS)).isoformat()
    stale_cutoff = (datetime.now(timezone.utc) - timedelta(hours=REFRESH_AFTER_HOURS)).isoformat()

    async with db_connection() as db:
        cur = await db.execute(
            """SELECT id, platform_post_id
               FROM social_posts
               WHERE platform = 'tiktok'
               AND status = 'published'
               AND platform_post_id IS NOT NULL
               AND published_at >= ?
               AND (metrics_updated_at IS NULL OR metrics_updated_at < ?)
               ORDER BY published_at DESC
               LIMIT 50""",
            (cutoff, stale_cutoff),
        )
        posts = [dict(r) for r in await cur.fetchall()]

    if not posts:
        return {"synced": 0, "failed": 0, "skipped": 0}

    async with db_connection() as db:
        connection = await get_connection(db, provider="tiktok", account_type="creator")

    if not connection or connection["status"] != "connected":
        logger.debug("TikTok analytics sync skipped — no active connection")
        return {"synced": 0, "failed": 0, "skipped": len(posts)}

    access_token = decrypt_token(connection.get("encrypted_access_token"))
    if not access_token:
        return {"synced": 0, "failed": 0, "skipped": len(posts)}

    for post in posts:
        post_id = post.get("platform_post_id")
        db_id = post["id"]
        if not post_id:
            skipped += 1
            continue
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    "https://open.tiktokapis.com/v2/video/query/",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "filters": {"video_ids": [post_id]},
                        "fields": ["view_count", "like_count", "comment_count", "share_count", "reach"],
                    },
                )
                data = resp.json()

            videos = data.get("data", {}).get("videos", [])
            if not videos:
                skipped += 1
                continue

            v = videos[0]
            async with db_connection() as db:
                await db.execute(
                    """UPDATE social_posts
                       SET impressions = ?,
                           likes = ?,
                           comments_count = ?,
                           shares = ?,
                           reach = ?,
                           metrics_updated_at = CURRENT_TIMESTAMP
                       WHERE id = ?""",
                    (
                        v.get("view_count"),
                        v.get("like_count"),
                        v.get("comment_count"),
                        v.get("share_count"),
                        v.get("reach"),
                        db_id,
                    ),
                )
                await db.commit()
            synced += 1

        except Exception as exc:
            logger.warning("TikTok metrics sync failed for post %s: %s", db_id, exc)
            failed += 1

    logger.info("TikTok analytics sync: synced=%d failed=%d skipped=%d", synced, failed, skipped)
    return {"synced": synced, "failed": failed, "skipped": skipped}


async def sync_youtube_metrics() -> dict:
    """Pull engagement metrics for published YouTube posts."""
    from app.services.social.service import get_connection
    from app.services.social.token_crypto import decrypt_token
    from app.services.social.providers.youtube import YouTubeProvider
    import httpx

    synced = 0
    failed = 0
    skipped = 0

    cutoff = (datetime.now(timezone.utc) - timedelta(days=SYNC_WINDOW_DAYS)).isoformat()
    stale_cutoff = (datetime.now(timezone.utc) - timedelta(hours=REFRESH_AFTER_HOURS)).isoformat()

    async with db_connection() as db:
        cur = await db.execute(
            """SELECT id, platform_post_id
               FROM social_posts
               WHERE platform = 'youtube'
               AND status = 'published'
               AND platform_post_id IS NOT NULL
               AND published_at >= ?
               AND (metrics_updated_at IS NULL OR metrics_updated_at < ?)
               ORDER BY published_at DESC
               LIMIT 50""",
            (cutoff, stale_cutoff),
        )
        posts = [dict(r) for r in await cur.fetchall()]

    if not posts:
        return {"synced": 0, "failed": 0, "skipped": 0}

    async with db_connection() as db:
        connection = await get_connection(db, provider="youtube", account_type="youtube_channel")

    if not connection or connection["status"] != "connected":
        logger.debug("YouTube analytics sync skipped — no active connection")
        return {"synced": 0, "failed": 0, "skipped": len(posts)}

    access_token = decrypt_token(connection.get("encrypted_access_token"))
    if not access_token:
        return {"synced": 0, "failed": 0, "skipped": len(posts)}

    # Check token expiry and refresh if needed
    expires_at = connection.get("token_expires_at")
    if expires_at:
        try:
            expiry = expires_at if not isinstance(expires_at, str) else datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            if expiry <= datetime.now(timezone.utc):
                refresh_token = decrypt_token(connection.get("encrypted_refresh_token"))
                if refresh_token:
                    provider = YouTubeProvider()
                    token_data = await provider.refresh_access_token(refresh_token)
                    new_token = token_data.get("access_token")
                    if new_token:
                        access_token = new_token
        except Exception as exc:
            logger.warning("YouTube token refresh during analytics sync failed: %s", exc)

    # Batch video IDs — YouTube allows up to 50 per request
    video_ids = [p["platform_post_id"] for p in posts if p.get("platform_post_id")]
    id_to_db = {p["platform_post_id"]: p["id"] for p in posts if p.get("platform_post_id")}

    for i in range(0, len(video_ids), 50):
        batch = video_ids[i:i + 50]
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(
                    "https://www.googleapis.com/youtube/v3/videos",
                    headers={"Authorization": f"Bearer {access_token}"},
                    params={
                        "part": "statistics",
                        "id": ",".join(batch),
                    },
                )
                data = resp.json()

            items = data.get("items", [])
            async with db_connection() as db:
                for item in items:
                    vid_id = item.get("id")
                    stats = item.get("statistics", {})
                    db_id = id_to_db.get(vid_id)
                    if not db_id:
                        continue
                    await db.execute(
                        """UPDATE social_posts
                           SET impressions = ?,
                               likes = ?,
                               comments_count = ?,
                               metrics_updated_at = CURRENT_TIMESTAMP
                           WHERE id = ?""",
                        (
                            int(stats.get("viewCount", 0) or 0),
                            int(stats.get("likeCount", 0) or 0),
                            int(stats.get("commentCount", 0) or 0),
                            db_id,
                        ),
                    )
                    synced += 1
                await db.commit()

            skipped += len(batch) - len(items)

        except Exception as exc:
            logger.warning("YouTube metrics batch sync failed: %s", exc)
            failed += len(batch)

    logger.info("YouTube analytics sync: synced=%d failed=%d skipped=%d", synced, failed, skipped)
    return {"synced": synced, "failed": failed, "skipped": skipped}


async def sync_all_platform_metrics() -> dict:
    """Run TikTok + YouTube analytics sync. Called by background job."""
    tiktok = await sync_tiktok_metrics()
    youtube = await sync_youtube_metrics()
    return {
        "tiktok": tiktok,
        "youtube": youtube,
        "total_synced": tiktok["synced"] + youtube["synced"],
        "total_failed": tiktok["failed"] + youtube["failed"],
    }
