"""Publish retry service for failed social posts.

Sprint 3: Retry logic with exponential backoff for failed publishes.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

from app.database import db_connection
from app.services.social_publish_service import publish_post, PublishError

logger = logging.getLogger(__name__)


MAX_RETRIES = 3
RETRY_DELAYS = [300, 900, 3600]  # 5 min, 15 min, 1 hour


async def retry_failed_post(post_id: int) -> dict:
    """Retry a failed social post publish.
    
    Implements exponential backoff with max 3 retries.
    """
    async with db_connection() as db:
        cursor = await db.execute(
            """SELECT * FROM social_posts 
               WHERE id = ? AND status = 'failed'""",
            (post_id,)
        )
        post = await cursor.fetchone()
        
        if not post:
            return {"error": "Post not found or not in failed status"}
        
        # Check retry count
        cursor = await db.execute(
            """SELECT COUNT(*) as retry_count 
               FROM publish_retries 
               WHERE post_id = ?""",
            (post_id,)
        )
        retry_row = await cursor.fetchone()
        retry_count = retry_row["retry_count"] if retry_row else 0
        
        if retry_count >= MAX_RETRIES:
            await db.execute(
                """UPDATE social_posts 
                   SET error_message = ?, updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?""",
                (f"Max retries ({MAX_RETRIES}) exceeded", post_id)
            )
            await db.commit()
            return {"error": "Max retries exceeded", "retries": retry_count}
        
        # Get next retry delay
        delay_seconds = RETRY_DELAYS[min(retry_count, len(RETRY_DELAYS) - 1)]
        next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)
        
        # Log retry attempt
        insert_cursor = await db.execute(
            """INSERT INTO publish_retries 
               (post_id, attempt_number, scheduled_at, status)
               VALUES (?, ?, ?, 'pending')""",
            (post_id, retry_count + 1, next_retry_at)
        )
        retry_id = insert_cursor.lastrowid
        await db.commit()
    
    logger.info(f"Scheduled retry {retry_count + 1} for post {post_id} at {next_retry_at}")
    
    return {
        "retry_id": retry_id,
        "post_id": post_id,
        "attempt": retry_count + 1,
        "scheduled_at": next_retry_at.isoformat(),
        "delay_seconds": delay_seconds
    }


async def execute_retry(retry_id: int) -> dict:
    """Execute a scheduled retry attempt."""
    async with db_connection() as db:
        cursor = await db.execute(
            """SELECT r.*, sp.platform, sp.content, sp.image_url, sp.video_url
               FROM publish_retries r
               JOIN social_posts sp ON r.post_id = sp.id
               WHERE r.id = ? AND r.status = 'pending'""",
            (retry_id,)
        )
        retry = await cursor.fetchone()
        
        if not retry:
            return {"error": "Retry not found or not pending"}
        
        # Attempt publish
        try:
            platform_post_id = await publish_post(
                platform=retry["platform"],
                content=retry["content"],
                image_url=retry["image_url"],
                video_url=retry["video_url"],
            )
            
            # Success - update post and retry
            await db.execute(
                """UPDATE social_posts 
                   SET status = 'published', 
                       platform_post_id = ?,
                       published_at = CURRENT_TIMESTAMP,
                       error_message = NULL,
                       updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?""",
                (platform_post_id, retry["post_id"])
            )
            
            await db.execute(
                """UPDATE publish_retries
                   SET status = 'success', 
                       executed_at = CURRENT_TIMESTAMP,
                       result_message = ?
                   WHERE id = ?""",
                (f"Published: {platform_post_id}", retry_id)
            )
            await db.commit()
            
            logger.info(f"Retry {retry_id} succeeded for post {retry['post_id']}")
            return {
                "success": True,
                "post_id": retry["post_id"],
                "platform_post_id": platform_post_id
            }
            
        except PublishError as e:
            # Failed again
            await db.execute(
                """UPDATE publish_retries
                   SET status = 'failed', 
                       executed_at = CURRENT_TIMESTAMP,
                       error_message = ?
                   WHERE id = ?""",
                (str(e), retry_id)
            )
            await db.commit()
            
            logger.warning(f"Retry {retry_id} failed: {e}")
            return {
                "success": False,
                "post_id": retry["post_id"],
                "error": str(e),
                "can_retry_again": retry["attempt_number"] < MAX_RETRIES
            }


async def run_pending_retries() -> dict:
    """Background task: Execute all due retries."""
    now = datetime.now(timezone.utc)
    
    async with db_connection() as db:
        cursor = await db.execute(
            """SELECT id FROM publish_retries
               WHERE status = 'pending'
               AND scheduled_at <= ?
               ORDER BY scheduled_at ASC
               LIMIT 20""",
            (now,)
        )
        pending = await cursor.fetchall()
    
    results = []
    for row in pending:
        result = await execute_retry(row["id"])
        results.append(result)
    
    succeeded = sum(1 for r in results if r.get("success"))
    failed = len(results) - succeeded
    
    if pending:
        logger.info(f"Processed {len(pending)} retries: {succeeded} succeeded, {failed} failed")
    
    return {
        "processed": len(pending),
        "succeeded": succeeded,
        "failed": failed
    }


async def get_retry_history(post_id: int) -> list[dict]:
    """Get retry history for a post."""
    async with db_connection() as db:
        cursor = await db.execute(
            """SELECT * FROM publish_retries
               WHERE post_id = ?
               ORDER BY attempt_number ASC""",
            (post_id,)
        )
        rows = await cursor.fetchall()
        
    return [dict(r) for r in rows]
