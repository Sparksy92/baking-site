"""Engagement sync service.

Runs as a background task every hour. For each published Facebook post
that has a platform_post_id, fetches likes/comments/shares/reach from
the Graph API and writes them back to social_posts.

Wired into main.py lifespan alongside scheduler_service.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

from app.database import db_connection

logger = logging.getLogger(__name__)

# Only sync posts published within the last 30 days (older posts have stable metrics)
SYNC_WINDOW_DAYS = 30


async def sync_engagement_metrics() -> int:
    """Fetch and store engagement metrics for recent published Facebook posts.

    Returns the number of posts updated.
    """
    from app.services.social.service import get_decrypted_page_token
    from app.services.social.providers.facebook import FacebookProvider
    from app.services.social.token_crypto import TokenCryptoError

    cutoff = datetime.now(timezone.utc) - timedelta(days=SYNC_WINDOW_DAYS)
    updated = 0

    try:
        async with db_connection() as db:
            cursor = await db.execute(
                """SELECT id, platform_post_id
                   FROM social_posts
                   WHERE platform = 'facebook'
                   AND status = 'published'
                   AND platform_post_id IS NOT NULL
                   AND published_at >= ?
                   ORDER BY published_at DESC
                   LIMIT 50""",
                (cutoff,),
            )
            rows = await cursor.fetchall()
    except Exception as e:
        logger.error(f"Engagement sync failed to query posts: {e}")
        return 0

    if not rows:
        return 0

    try:
        async with db_connection() as db:
            connection, token = await get_decrypted_page_token(db, provider="facebook")
    except (ValueError, TokenCryptoError, Exception) as e:
        logger.warning(f"Engagement sync: Facebook not connected — {e}")
        return 0

    provider = FacebookProvider()

    for row in rows:
        post_id = row["id"]
        platform_post_id = row["platform_post_id"]
        try:
            metrics = await provider.get_post_insights(token, platform_post_id)
            async with db_connection() as db:
                await db.execute(
                    """UPDATE social_posts
                       SET engagement_score = ?,
                           reach_count = ?,
                           updated_at = CURRENT_TIMESTAMP
                       WHERE id = ?""",
                    (
                        float(metrics["likes"] + metrics["comments"] + metrics["shares"]),
                        metrics["reach"],
                        post_id,
                    ),
                )
                await db.commit()
            updated += 1
            logger.debug(
                f"Engagement sync post {post_id}: likes={metrics['likes']} "
                f"comments={metrics['comments']} shares={metrics['shares']} reach={metrics['reach']}"
            )
        except Exception as e:
            logger.warning(f"Engagement sync failed for post {post_id}: {e}")

    logger.info(f"Engagement sync complete: {updated}/{len(rows)} posts updated")
    return updated


async def poll_tiktok_pending_posts() -> int:
    """Poll TikTok publish_id status for posts that are still pending.

    TikTok's direct_post and upload_to_inbox endpoints are async — they return
    a publish_id immediately but the video is not live until status = PUBLISH_COMPLETE.
    We poll every run (called every 4h alongside engagement sync) and mark as
    published or failed accordingly.

    Returns number of posts resolved.
    """
    from app.services.social.providers.tiktok import TikTokProvider
    from app.services.social.service import get_connection
    from app.services.social.token_crypto import decrypt_token
    import json as _json

    resolved = 0

    # Find TikTok posts that have a platform_post_id (publish_id) but aren't published yet
    try:
        async with db_connection() as db:
            cursor = await db.execute(
                """SELECT id, platform_post_id FROM social_posts
                   WHERE platform = 'tiktok'
                   AND status IN ('scheduled', 'publishing')
                   AND platform_post_id IS NOT NULL
                   ORDER BY created_at DESC
                   LIMIT 30""",
            )
            rows = await cursor.fetchall()
    except Exception as e:
        logger.error(f"TikTok poll: query failed: {e}")
        return 0

    if not rows:
        return 0

    # Get TikTok access token
    try:
        async with db_connection() as db:
            connection = await get_connection(db, provider="tiktok", account_type="tiktok_user")
        access_token = decrypt_token(connection.get("encrypted_access_token")) if connection else None
    except Exception as e:
        logger.warning(f"TikTok poll: no connection — {e}")
        return 0

    if not access_token:
        return 0

    provider = TikTokProvider()

    for row in rows:
        post_id = row["id"]
        publish_id = row["platform_post_id"]
        try:
            result = await provider.check_publish_status(access_token, publish_id)
            status_info = result.get("data", {})
            publish_status = status_info.get("status", "")

            if publish_status == "PUBLISH_COMPLETE":
                async with db_connection() as db:
                    await db.execute(
                        """UPDATE social_posts
                           SET status = 'published',
                               published_at = CURRENT_TIMESTAMP,
                               updated_at = CURRENT_TIMESTAMP
                           WHERE id = ?""",
                        (post_id,),
                    )
                    await db.commit()
                resolved += 1
                logger.info(f"TikTok post {post_id} confirmed published (publish_id={publish_id})")

            elif publish_status in ("FAILED", "CANCELLED"):
                fail_reason = status_info.get("fail_reason", "TikTok processing failed")
                async with db_connection() as db:
                    await db.execute(
                        """UPDATE social_posts
                           SET status = 'failed',
                               error_message = ?,
                               updated_at = CURRENT_TIMESTAMP
                           WHERE id = ?""",
                        (fail_reason, post_id),
                    )
                    await db.commit()
                resolved += 1
                logger.warning(f"TikTok post {post_id} failed: {fail_reason}")

        except Exception as e:
            logger.warning(f"TikTok poll failed for post {post_id}: {e}")

    logger.info(f"TikTok poll complete: {resolved}/{len(rows)} posts resolved")
    return resolved
