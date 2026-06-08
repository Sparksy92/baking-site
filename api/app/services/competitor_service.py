"""Competitor tracking and analysis service.

Monitors competitor social accounts, analyzes their content performance,
extracts insights for competitive advantage.

Features:
  - Track competitor follower growth
  - Analyze their high-performing content
  - Detect content patterns (what works for them)
  - Flag competitive threats or opportunities
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Any

from app.database import db_connection
from app.services.ai_router import AITaskType, get_model_config, generate_with_config

logger = logging.getLogger(__name__)


async def add_competitor(
    name: str,
    platform: str,
    platform_handle: str,
    profile_url: str | None = None,
    notes: str = "",
) -> dict:
    """Add a competitor to track."""
    async with db_connection() as db:
        cursor = await db.execute(
            """INSERT INTO competitors
               (name, platform, platform_handle, profile_url, notes)
               VALUES (?, ?, ?, ?, ?)""",
            (name, platform, platform_handle, profile_url, notes),
        )
        await db.commit()
        competitor_id = cursor.lastrowid

    return {"competitor_id": competitor_id, "name": name, "platform": platform}


async def record_competitor_post(
    competitor_id: int,
    platform_post_id: str,
    content: str,
    posted_at: str,
    likes: int = 0,
    comments: int = 0,
    shares: int = 0,
    follower_count: int | None = None,
) -> dict:
    """Record a competitor post (from manual entry or scraping)."""
    # Calculate engagement rate if we have follower count
    engagement_rate = None
    if follower_count and follower_count > 0:
        engagement = likes + comments + shares
        engagement_rate = engagement / follower_count

    async with db_connection() as db:
        # Check if already exists
        cursor = await db.execute(
            "SELECT id FROM competitor_posts WHERE competitor_id = ? AND platform_post_id = ?",
            (competitor_id, platform_post_id),
        )
        if await cursor.fetchone():
            # Update metrics
            await db.execute(
                """UPDATE competitor_posts
                   SET likes = ?, comments = ?, shares = ?, engagement_rate = ?
                   WHERE competitor_id = ? AND platform_post_id = ?""",
                (likes, comments, shares, engagement_rate, competitor_id, platform_post_id),
            )
            await db.commit()
            return {"updated": True}

        # Insert new post
        cursor = await db.execute(
            """INSERT INTO competitor_posts
               (competitor_id, platform_post_id, content, posted_at,
                likes, comments, shares, engagement_rate)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (competitor_id, platform_post_id, content, posted_at,
             likes, comments, shares, engagement_rate),
        )
        post_id = cursor.lastrowid
        await db.commit()

    return {"post_id": post_id, "recorded": True}


async def analyze_competitor_post(post_id: int) -> dict:
    """Use AI to analyze a competitor post and extract insights."""
    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT * FROM competitor_posts WHERE id = ?", (post_id,)
        )
        post = await cursor.fetchone()
        if not post:
            raise ValueError(f"Post {post_id} not found")

    # Get competitor info
    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT * FROM competitors WHERE id = ?", (post["competitor_id"],)
        )
        competitor = await cursor.fetchone()

    content = post["content"]
    if not content or len(content.strip()) < 10:
        return {"error": "No content to analyze"}

    # AI analysis
    system_prompt = """You are a competitive intelligence analyst. Analyze this competitor's social media post.

Respond with a JSON object in this exact format:
{
  "content_category": "promotional" | "educational" | "entertaining" | "behind_the_scenes" | "ugc" | "news",
  "sentiment": "positive" | "neutral" | "negative",
  "tone": "professional" | "casual" | "humorous" | "urgent" | "inspirational",
  "key_themes": ["theme1", "theme2"],
  "visual_suggestion": "description of likely image/video style",
  "our_takeaway": "strategic insight we can apply",
  "should_respond": true | false,
  "response_opportunity": "if should_respond is true, explain the angle",
  "threat_level": "low" | "medium" | "high"
}

Be concise and actionable."""

    try:
        config = await get_model_config(AITaskType.SEO_SYNTHESIS)  # Use structured extraction model
        result_text = await generate_with_config(content, system_prompt, config)

        # Extract JSON
        result_text = result_text.strip()
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0]
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0]

        import json
        analysis = json.loads(result_text.strip())

        # Store results
        async with db_connection() as db:
            await db.execute(
                """UPDATE competitor_posts
                   SET content_category = ?,
                       sentiment_score = ?,
                       our_takeaway = ?,
                       should_respond = ?
                   WHERE id = ?""",
                (
                    analysis.get("content_category", ""),
                    1.0 if analysis.get("sentiment") == "positive" else (-1.0 if analysis.get("sentiment") == "negative" else 0),
                    analysis.get("our_takeaway", ""),
                    analysis.get("should_respond", False),
                    post_id,
                ),
            )
            await db.commit()

        return analysis

    except Exception as e:
        logger.error(f"Failed to analyze competitor post {post_id}: {e}")
        return {"error": str(e)}


async def get_competitor_report(competitor_id: int, days: int = 30) -> dict:
    """Generate a competitive intelligence report."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    async with db_connection() as db:
        # Get competitor info
        cursor = await db.execute(
            "SELECT * FROM competitors WHERE id = ?", (competitor_id,)
        )
        competitor = await cursor.fetchone()
        if not competitor:
            raise ValueError(f"Competitor {competitor_id} not found")

        # Get stats
        cursor = await db.execute(
            """SELECT
                COUNT(*) as post_count,
                AVG(likes) as avg_likes,
                AVG(comments) as avg_comments,
                AVG(shares) as avg_shares,
                AVG(engagement_rate) as avg_engagement_rate,
                MAX(likes) as best_post_likes
            FROM competitor_posts
            WHERE competitor_id = ?
            AND posted_at >= ?""",
            (competitor_id, since),
        )
        stats = dict(await cursor.fetchone())

        # Get top performing posts
        cursor = await db.execute(
            """SELECT * FROM competitor_posts
                WHERE competitor_id = ?
                AND posted_at >= ?
                ORDER BY (likes + comments + shares) DESC
                LIMIT 5""",
            (competitor_id, since),
        )
        top_posts = [dict(r) for r in await cursor.fetchall()]

        # Get content category breakdown
        cursor = await db.execute(
            """SELECT content_category, COUNT(*) as cnt
                FROM competitor_posts
                WHERE competitor_id = ?
                AND posted_at >= ?
                AND content_category IS NOT NULL
                GROUP BY content_category""",
            (competitor_id, since),
        )
        categories = {r["content_category"]: r["cnt"] for r in await cursor.fetchall()}

        # Posts that need response
        cursor = await db.execute(
            """SELECT * FROM competitor_posts
                WHERE competitor_id = ?
                AND should_respond = TRUE
                AND posted_at >= ?
                ORDER BY posted_at DESC""",
            (competitor_id, since),
        )
        respond_opportunities = [dict(r) for r in await cursor.fetchall()]

    return {
        "competitor": dict(competitor),
        "period_days": days,
        "stats": {
            "posts_analyzed": stats.get("post_count", 0),
            "avg_likes": round(stats.get("avg_likes", 0) or 0, 1),
            "avg_comments": round(stats.get("avg_comments", 0) or 0, 1),
            "avg_shares": round(stats.get("avg_shares", 0) or 0, 1),
            "avg_engagement_rate": round(stats.get("avg_engagement_rate", 0) or 0, 4),
            "best_post_likes": stats.get("best_post_likes", 0),
        },
        "content_mix": categories,
        "top_posts": top_posts,
        "response_opportunities": respond_opportunities,
    }


async def list_competitors(platform: str | None = None) -> list[dict]:
    """List all tracked competitors."""
    async with db_connection() as db:
        if platform:
            cursor = await db.execute(
                "SELECT * FROM competitors WHERE platform = ? AND is_active = TRUE ORDER BY name",
                (platform,),
            )
        else:
            cursor = await db.execute(
                "SELECT * FROM competitors WHERE is_active = TRUE ORDER BY name"
            )
        rows = await cursor.fetchall()

    return [dict(r) for r in rows]


async def get_competitive_landscape(platform: str) -> dict:
    """Get competitive landscape analysis for a platform."""
    competitors = await list_competitors(platform)

    if not competitors:
        return {"platform": platform, "competitors": 0, "error": "No competitors tracked"}

    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    async with db_connection() as db:
        cursor = await db.execute(
            """SELECT
                c.id, c.name,
                COUNT(cp.id) as posts,
                AVG(cp.engagement_rate) as avg_engagement
            FROM competitors c
            LEFT JOIN competitor_posts cp ON c.id = cp.competitor_id
            WHERE c.platform = ?
            AND c.is_active = TRUE
            AND (cp.posted_at >= ? OR cp.posted_at IS NULL)
            GROUP BY c.id
            ORDER BY avg_engagement DESC NULLS LAST""",
            (platform, since),
        )
        stats = [dict(r) for r in await cursor.fetchall()]

    return {
        "platform": platform,
        "competitors": len(competitors),
        "tracked_names": [c["name"] for c in competitors],
        "performance_ranking": stats,
    }
