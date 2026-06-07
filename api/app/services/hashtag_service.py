"""Hashtag analytics service.

Tracks performance of hashtags across posts.
Identifies trending and high-performing tags.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone, timedelta

from app.database import db_connection

logger = logging.getLogger(__name__)


def extract_hashtags(text: str) -> list[str]:
    """Extract hashtags from text."""
    # Match #word characters, handle multi-word hashtags
    hashtags = re.findall(r'#\w+', text)
    return [tag.lower() for tag in hashtags]


async def analyze_hashtags_for_post(
    post_id: int,
    platform: str,
    content: str,
) -> list[dict]:
    """Extract and record hashtags from a post."""
    hashtags = extract_hashtags(content)

    if not hashtags:
        return []

    # Store hashtag usage (we'd track this in a separate table if needed)
    # For now, just return the extracted hashtags
    return [{"hashtag": tag, "platform": platform} for tag in hashtags]


async def calculate_hashtag_performance(days: int = 30) -> dict:
    """Calculate performance metrics for all hashtags used recently."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    async with db_connection() as db:
        # Get all recent posts with hashtags
        cursor = await db.execute(
            """SELECT id, platform, content, reach, likes, comments_count, shares, clicks
                FROM social_posts
                WHERE published_at >= ?
                AND status = 'published'""",
            (since,),
        )
        posts = await cursor.fetchall()

    # Aggregate by hashtag
    hashtag_stats: dict[str, dict] = {}

    for post in posts:
        hashtags = extract_hashtags(post["content"])

        for tag in hashtags:
            if tag not in hashtag_stats:
                hashtag_stats[tag] = {
                    "posts_count": 0,
                    "total_reach": 0,
                    "total_engagement": 0,
                    "total_clicks": 0,
                    "best_post_id": None,
                    "best_engagement": 0,
                    "platforms": set(),
                }

            engagement = (post["likes"] or 0) + (post["comments_count"] or 0) + (post["shares"] or 0)

            hashtag_stats[tag]["posts_count"] += 1
            hashtag_stats[tag]["total_reach"] += post["reach"] or 0
            hashtag_stats[tag]["total_engagement"] += engagement
            hashtag_stats[tag]["total_clicks"] += post["clicks"] or 0
            hashtag_stats[tag]["platforms"].add(post["platform"])

            if engagement > hashtag_stats[tag]["best_engagement"]:
                hashtag_stats[tag]["best_engagement"] = engagement
                hashtag_stats[tag]["best_post_id"] = post["id"]

    # Store/update hashtag performance
    updated = 0
    for tag, stats in hashtag_stats.items():
        for platform in stats["platforms"]:
            avg_reach = stats["total_reach"] // max(stats["posts_count"], 1)
            avg_engagement = stats["total_engagement"] // max(stats["posts_count"], 1)
            avg_ctr = stats["total_clicks"] / max(stats["total_reach"], 1)

            async with db_connection() as db:
                await db.execute(
                    """INSERT INTO hashtag_performance
                       (hashtag, platform, posts_count, avg_reach, avg_engagement, avg_ctr,
                        best_performing_post_id, last_calculated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                       ON CONFLICT(hashtag, platform)
                       DO UPDATE SET
                           posts_count = excluded.posts_count,
                           avg_reach = excluded.avg_reach,
                           avg_engagement = excluded.avg_engagement,
                           avg_ctr = excluded.avg_ctr,
                           best_performing_post_id = excluded.best_performing_post_id,
                           last_calculated_at = CURRENT_TIMESTAMP""",
                    (
                        tag,
                        platform,
                        stats["posts_count"],
                        avg_reach,
                        avg_engagement,
                        avg_ctr,
                        stats["best_post_id"],
                    ),
                )
                await db.commit()
                updated += 1

    return {"hashtags_analyzed": len(hashtag_stats), "records_updated": updated}


async def get_top_hashtags(
    platform: str | None = None,
    limit: int = 20,
    min_posts: int = 3,
) -> list[dict]:
    """Get top performing hashtags."""
    async with db_connection() as db:
        if platform:
            cursor = await db.execute(
                """SELECT * FROM hashtag_performance
                    WHERE platform = ? AND posts_count >= ?
                    ORDER BY avg_engagement DESC
                    LIMIT ?""",
                (platform, min_posts, limit),
            )
        else:
            # Aggregate across platforms
            cursor = await db.execute(
                """SELECT
                    hashtag,
                    SUM(posts_count) as total_posts,
                    AVG(avg_reach) as avg_reach,
                    AVG(avg_engagement) as avg_engagement,
                    AVG(avg_ctr) as avg_ctr
                FROM hashtag_performance
                WHERE posts_count >= ?
                GROUP BY hashtag
                ORDER BY avg_engagement DESC
                LIMIT ?""",
                (min_posts, limit),
            )
        rows = await cursor.fetchall()

    return [dict(r) for r in rows]


async def suggest_hashtags(
    content: str,
    platform: str,
    limit: int = 5,
) -> list[dict]:
    """Suggest hashtags based on content and top performers."""
    # Get already-used hashtags
    existing = extract_hashtags(content)

    # Get top performers for platform
    top = await get_top_hashtags(platform, limit=20)

    # Filter out already used, suggest rest
    suggestions = []
    for tag in top:
        hashtag = tag.get("hashtag", "")
        if hashtag not in existing:
            suggestions.append({
                "hashtag": hashtag,
                "avg_engagement": tag.get("avg_engagement", 0),
                "posts_count": tag.get("posts_count") or tag.get("total_posts", 0),
            })

        if len(suggestions) >= limit:
            break

    return suggestions
