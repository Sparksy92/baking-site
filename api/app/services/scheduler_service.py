"""Social post scheduler service.

Runs as a background task every 60 seconds. Checks for social_posts with
status='scheduled' and scheduled_at <= now, then publishes them via the
social_publish_service dispatcher.

Wired into main.py lifespan alongside the existing social sync and token
refresh background tasks.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.database import db_connection
from app.services.social_publish_service import publish_post, PublishError

logger = logging.getLogger(__name__)


async def run_scheduled_publisher() -> int:
    """Publish all social posts that are due.

    Returns the number of posts attempted.
    """
    now = datetime.now(timezone.utc).isoformat()
    attempted = 0

    try:
        async with db_connection() as db:
            cursor = await db.execute(
                """SELECT id, platform, content, image_url, video_url
                   FROM social_posts
                   WHERE status = 'scheduled'
                   AND scheduled_at IS NOT NULL
                   AND scheduled_at <= ?
                   ORDER BY scheduled_at ASC
                   LIMIT 20""",
                (now,),
            )
            due_posts = await cursor.fetchall()
    except Exception as e:
        logger.error(f"Scheduler failed to query due posts: {e}")
        return 0

    for row in due_posts:
        post_id = row["id"]
        attempted += 1
        try:
            platform_post_id = await publish_post(
                platform=row["platform"],
                content=row["content"],
                image_url=row["image_url"],
                video_url=row["video_url"],
            )
            async with db_connection() as db:
                await db.execute(
                    """UPDATE social_posts
                       SET status = 'published', platform_post_id = ?,
                           published_at = CURRENT_TIMESTAMP, error_message = NULL,
                           updated_at = CURRENT_TIMESTAMP
                       WHERE id = ?""",
                    (platform_post_id, post_id),
                )
                await db.commit()
            logger.info(f"Scheduler published post {post_id} → {row['platform']} id={platform_post_id}")

        except PublishError as e:
            logger.error(f"Scheduler failed to publish post {post_id}: {e}")
            async with db_connection() as db:
                await db.execute(
                    """UPDATE social_posts
                       SET status = 'failed', error_message = ?,
                           updated_at = CURRENT_TIMESTAMP
                       WHERE id = ?""",
                    (str(e), post_id),
                )
                await db.commit()

        except Exception as e:
            logger.error(f"Scheduler unexpected error for post {post_id}: {e}", exc_info=True)

    return attempted
