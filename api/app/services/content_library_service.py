"""Evergreen content library and recycling service.

Implements SocialBee/MeetEdgar-style content recycling for sustainable
high-volume posting. Content categories enforce Gary Vee's 80/20 mix.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any

from app.database import db_connection

logger = logging.getLogger(__name__)


# Gary Vee content mix categories
CONTENT_CATEGORIES = {
    "educational": {"weight": 0.30, "description": "Teach something valuable"},
    "entertaining": {"weight": 0.25, "description": "Make them laugh or feel"},
    "behind_scenes": {"weight": 0.15, "description": "Show the process/people"},
    "community": {"weight": 0.10, "description": "UGC, shoutouts, engagement"},
    "promotional": {"weight": 0.15, "description": "Product/offer posts"},
    "evergreen": {"weight": 0.05, "description": "Timeless top performers"},
}


async def add_to_library(
    content: str,
    category: str,
    platform: str,
    image_url: str | None = None,
    video_url: str | None = None,
    approved: bool = False,
    max_uses: int = 10,
    min_days_between: int = 30,
) -> dict:
    """Add content to the evergreen library.
    
    Content can be recycled multiple times with minimum spacing.
    """
    if category not in CONTENT_CATEGORIES:
        raise ValueError(f"Invalid category. Must be one of: {list(CONTENT_CATEGORIES.keys())}")
    
    async with db_connection() as db:
        cursor = await db.execute(
            """INSERT INTO content_library 
               (content, category, platform, image_url, video_url, 
                is_approved, max_uses, min_days_between, times_used, last_used_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
               RETURNING id""",
            (content, category, platform, image_url, video_url, 
             approved, max_uses, min_days_between)
        )
        row = await cursor.fetchone()
        await db.commit()
        
    logger.info(f"Added content to library: id={row['id']} category={category} platform={platform}")
    return {"id": row["id"], "added": True}


async def get_recyclable_content(
    platform: str,
    category: str | None = None,
    limit: int = 10,
) -> list[dict]:
    """Get content ready for recycling.
    
    Filters:
    - Approved content only
    - Under max uses
    - Respects min_days_between
    - Not used in last 24h (to avoid repetition)
    """
    min_last_used = datetime.now(timezone.utc) - timedelta(days=1)
    
    async with db_connection() as db:
        if category:
            cursor = await db.execute(
                """SELECT * FROM content_library
                   WHERE platform = ?
                   AND category = ?
                   AND is_approved = TRUE
                   AND times_used < max_uses
                   AND (last_used_at IS NULL 
                        OR last_used_at <= datetime('now', '-' || min_days_between || ' days'))
                   AND (last_used_at IS NULL OR last_used_at <= ?)
                   ORDER BY 
                     CASE WHEN last_used_at IS NULL THEN 0 ELSE 1 END,
                     times_used ASC,
                     RANDOM()
                   LIMIT ?""",
                (platform, category, min_last_used.isoformat(), limit)
            )
        else:
            cursor = await db.execute(
                """SELECT * FROM content_library
                   WHERE platform = ?
                   AND is_approved = TRUE
                   AND times_used < max_uses
                   AND (last_used_at IS NULL 
                        OR last_used_at <= datetime('now', '-' || min_days_between || ' days'))
                   AND (last_used_at IS NULL OR last_used_at <= ?)
                   ORDER BY 
                     CASE WHEN last_used_at IS NULL THEN 0 ELSE 1 END,
                     times_used ASC,
                     RANDOM()
                   LIMIT ?""",
                (platform, min_last_used.isoformat(), limit)
            )
        rows = await cursor.fetchall()
        
    return [dict(r) for r in rows]


async def mark_content_used(content_id: int, post_id: int) -> None:
    """Mark library content as used for a specific post."""
    async with db_connection() as db:
        await db.execute(
            """UPDATE content_library
               SET times_used = times_used + 1,
                   last_used_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (content_id,)
        )
        # Track the usage link
        await db.execute(
            """INSERT INTO content_library_usage 
               (library_content_id, social_post_id, used_at)
               VALUES (?, ?, CURRENT_TIMESTAMP)""",
            (content_id, post_id)
        )
        await db.commit()


async def get_category_mix_status(platform: str, days: int = 7) -> dict:
    """Get current posting mix by category vs target mix.
    
    Shows if you're hitting Gary Vee's 80/20 balance.
    """
    since = datetime.now(timezone.utc) - timedelta(days=days)
    
    async with db_connection() as db:
        # Get actual posts by category
        cursor = await db.execute(
            """SELECT category, COUNT(*) as count
               FROM social_posts sp
               JOIN content_library cl ON sp.content_library_id = cl.id
               WHERE sp.platform = ?
               AND sp.published_at >= ?
               AND sp.status = 'published'
               GROUP BY category""",
            (platform, since.isoformat())
        )
        actual_rows = await cursor.fetchall()
        
        # Get all posts (including non-library)
        cursor = await db.execute(
            """SELECT COUNT(*) as total
               FROM social_posts
               WHERE platform = ?
               AND published_at >= ?
               AND status = 'published'""",
            (platform, since.isoformat())
        )
        total_row = await cursor.fetchone()
        total_posts = total_row["total"] if total_row else 0
    
    # Calculate mix
    actual_counts = {r["category"]: r["count"] for r in actual_rows}
    library_posts = sum(actual_counts.values())
    other_posts = total_posts - library_posts
    
    mix_analysis = {}
    for cat, config in CONTENT_CATEGORIES.items():
        target = config["weight"]
        actual_count = actual_counts.get(cat, 0)
        actual_pct = actual_count / total_posts if total_posts > 0 else 0
        
        mix_analysis[cat] = {
            "target_pct": round(target * 100, 1),
            "actual_pct": round(actual_pct * 100, 1),
            "count": actual_count,
            "delta": round((actual_pct - target) * 100, 1),
            "on_target": abs(actual_pct - target) <= 0.05  # Within 5%
        }
    
    # Add non-library posts
    mix_analysis["other"] = {
        "target_pct": 0,
        "actual_pct": round((other_posts / total_posts) * 100, 1) if total_posts > 0 else 0,
        "count": other_posts,
        "delta": 0,
        "on_target": True
    }
    
    return {
        "total_posts": total_posts,
        "library_posts": library_posts,
        "platform": platform,
        "period_days": days,
        "categories": mix_analysis,
        "overall_balance_score": calculate_balance_score(mix_analysis)
    }


def calculate_balance_score(mix: dict) -> float:
    """Calculate how close to target mix (0-100 score)."""
    scores = []
    for cat_data in mix.values():
        if cat_data["target_pct"] > 0:
            # Penalty for deviation from target
            deviation = abs(cat_data["delta"]) / 100
            cat_score = max(0, 1 - (deviation / 0.1))  # 10% deviation = 0 score
            scores.append(cat_score)
    
    return round(sum(scores) / len(scores) * 100, 1) if scores else 0


async def suggest_next_category(platform: str) -> str:
    """Suggest which category to post next to maintain balance."""
    status = await get_category_mix_status(platform, days=14)
    
    # Find category most under target
    under_target = []
    for cat, data in status["categories"].items():
        if cat != "other" and data["target_pct"] > 0:
            deficit = data["target_pct"] - data["actual_pct"]
            if deficit > 5:  # More than 5% under
                under_target.append((cat, deficit))
    
    if under_target:
        under_target.sort(key=lambda x: x[1], reverse=True)
        return under_target[0][0]
    
    # All good, pick based on Gary Vee priority
    return "educational"  # Default to value


async def auto_schedule_recycled_content(
    platform: str,
    count: int = 5,
    days_ahead: int = 7,
) -> list[dict]:
    """Auto-schedule recycled content to fill gaps in calendar.
    
    Maintains category balance while hitting volume targets.
    """
    scheduled = []
    
    for _ in range(count):
        # Determine what category we need
        category = await suggest_next_category(platform)
        
        # Get recyclable content for that category
        candidates = await get_recyclable_content(platform, category, limit=3)
        
        if not candidates:
            # Try any category
            candidates = await get_recyclable_content(platform, limit=5)
        
        if not candidates:
            logger.warning(f"No recyclable content available for {platform}")
            break
        
        # Pick best candidate (least used)
        content = candidates[0]
        
        # Schedule it
        from app.services.best_time_service import suggest_next_post_time
        time_slot = await suggest_next_post_time(platform, min_hours_ahead=24)
        
        if "suggested_time" in time_slot and time_slot["suggested_time"]:
            scheduled_at = time_slot["suggested_time"]
        else:
            # Fallback: tomorrow at optimal hour
            tomorrow = datetime.now(timezone.utc) + timedelta(days=1)
            scheduled_at = tomorrow.replace(hour=12, minute=0).isoformat()
        
        # Create social post from library content
        async with db_connection() as db:
            cursor = await db.execute(
                """INSERT INTO social_posts
                   (platform, content, image_url, video_url, status, 
                    scheduled_at, content_library_id, created_by)
                   VALUES (?, ?, ?, ?, 'scheduled', ?, ?, 'recycler')
                   RETURNING id""",
                (platform, content["content"], content["image_url"], 
                 content["video_url"], scheduled_at, content["id"])
            )
            row = await cursor.fetchone()
            await db.commit()
            post_id = row["id"]
        
        # Mark library content as used for this post
        await mark_content_used(content["id"], post_id)
        
        scheduled.append({
            "post_id": post_id,
            "library_id": content["id"],
            "category": content["category"],
            "platform": platform,
            "scheduled_at": scheduled_at,
        })
        
        logger.info(f"Auto-scheduled recycled post: id={post_id} category={content['category']}")
    
    return scheduled


async def get_top_performing_content(
    platform: str | None = None,
    min_engagement: int = 100,
    limit: int = 20,
) -> list[dict]:
    """Identify top posts to add to evergreen library.
    
    Finds high-performing content that should be recycled.
    """
    async with db_connection() as db:
        if platform:
            cursor = await db.execute(
                """SELECT * FROM social_posts
                   WHERE platform = ?
                   AND status = 'published'
                   AND engagement_score >= ?
                   AND content_library_id IS NULL  -- Not already in library
                   ORDER BY engagement_score DESC
                   LIMIT ?""",
                (platform, min_engagement, limit)
            )
        else:
            cursor = await db.execute(
                """SELECT * FROM social_posts
                   WHERE status = 'published'
                   AND engagement_score >= ?
                   AND content_library_id IS NULL
                   ORDER BY engagement_score DESC
                   LIMIT ?""",
                (min_engagement, limit)
            )
        rows = await cursor.fetchall()
    
    return [dict(r) for r in rows]


async def promote_post_to_library(post_id: int, category: str, max_uses: int = 10) -> dict:
    """Promote a published post to evergreen library."""
    async with db_connection() as db:
        # Get post details
        cursor = await db.execute(
            "SELECT * FROM social_posts WHERE id = ?",
            (post_id,)
        )
        post = await cursor.fetchone()
        
        if not post:
            return {"error": "Post not found"}
        
        # Add to library
        result = await add_to_library(
            content=post["content"],
            category=category,
            platform=post["platform"],
            image_url=post["image_url"],
            video_url=post["video_url"],
            approved=True,
            max_uses=max_uses
        )
        
        # Link post to library
        await db.execute(
            "UPDATE social_posts SET content_library_id = ? WHERE id = ?",
            (result["id"], post_id)
        )
        await db.commit()
        
    return {"promoted": True, "library_id": result["id"], "post_id": post_id}
