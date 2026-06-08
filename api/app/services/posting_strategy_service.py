"""Gary Vee-style posting strategy service.

Implements high-volume content strategies with platform-specific cadence:
- Instagram: 3-5 posts/day (feed) + 5-10 stories
- Facebook: 2-3 posts/day  
- LinkedIn: 1-2 posts/day (B2B professional)
- Total: 15-25 pieces of content/day across platforms

Content Mix (Gary Vee's Jab-Jab-Jab-Right Hook):
- 80% value/entertainment (jabs)
- 20% promotional (right hooks)

Content Pyramid:
- Pillar content (blog) → Micro-content (social snippets)
- One blog post = 10-20 social posts
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any

from app.database import db_connection

logger = logging.getLogger(__name__)


# Gary Vee inspired defaults
DEFAULT_STRATEGY = {
    "instagram": {
        "posts_per_day": 3,
        "stories_per_day": 8,
        "reels_per_week": 3,
        "best_times": ["08:00", "12:00", "18:00"],  # Morning, lunch, evening
        "content_mix": {
            "educational": 0.30,
            "entertaining": 0.30,
            "behind_scenes": 0.20,
            "promotional": 0.15,
            "ugc": 0.05,
        }
    },
    "facebook": {
        "posts_per_day": 2,
        "best_times": ["09:00", "15:00"],
        "content_mix": {
            "educational": 0.25,
            "community": 0.35,
            "promotional": 0.20,
            "entertaining": 0.20,
        }
    },
    "linkedin": {
        "posts_per_day": 1,
        "best_times": ["08:00", "17:00"],  # Start/end of business day
        "content_mix": {
            "professional": 0.40,
            "educational": 0.30,
            "company_news": 0.15,
            "promotional": 0.15,
        }
    }
}


async def get_posting_strategy() -> dict:
    """Get current posting strategy configuration."""
    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT value FROM settings WHERE key = 'posting_strategy'"
        )
        row = await cursor.fetchone()
        
        if row and row["value"]:
            return json.loads(row["value"])
        
        # Return defaults if not set
        return DEFAULT_STRATEGY


async def update_posting_strategy(strategy: dict) -> dict:
    """Update posting strategy."""
    async with db_connection() as db:
        await db.execute(
            """INSERT INTO settings (key, value, updated_at)
                VALUES ('posting_strategy', ?, CURRENT_TIMESTAMP)
                ON CONFLICT (key) 
                DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP""",
            (json.dumps(strategy),)
        )
        await db.commit()
    
    return strategy


async def get_daily_posting_plan(date: str | None = None) -> dict:
    """Get AI-generated daily posting plan based on strategy."""
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    strategy = await get_posting_strategy()
    
    # Check what's already scheduled for this date
    from datetime import date as date_type
    day = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    day_end = day + timedelta(hours=23, minutes=59, seconds=59)
    
    async with db_connection() as db:
        cursor = await db.execute(
            """SELECT platform, COUNT(*) as count
                FROM social_posts
                WHERE scheduled_at >= ? 
                AND scheduled_at <= ?
                AND status = 'scheduled'
                GROUP BY platform""",
            (day, day_end)
        )
        scheduled = {r["platform"]: r["count"] for r in await cursor.fetchall()}
    
    # Calculate gaps (what AI needs to create)
    plan = {}
    for platform, config in strategy.items():
        target = config["posts_per_day"]
        already_scheduled = scheduled.get(platform, 0)
        needed = max(0, target - already_scheduled)
        
        # Get best times for remaining slots
        best_times = config["best_times"]
        slots = []
        for i, time in enumerate(best_times):
            if i >= already_scheduled and i < already_scheduled + needed:
                slots.append(f"{date}T{time}:00Z")
        
        plan[platform] = {
            "target_posts": target,
            "already_scheduled": already_scheduled,
            "needed": needed,
            "optimal_slots": slots,
            "content_mix": config["content_mix"]
        }
    
    return {
        "date": date,
        "total_target": sum(p["target_posts"] for p in plan.values()),
        "total_needed": sum(p["needed"] for p in plan.values()),
        "by_platform": plan
    }


async def get_recommended_content_types(platform: str) -> list[dict]:
    """Get content type recommendations for platform based on strategy."""
    strategy = await get_posting_strategy()
    platform_config = strategy.get(platform, {})
    content_mix = platform_config.get("content_mix", {})
    
    # Sort by percentage
    sorted_mix = sorted(
        content_mix.items(),
        key=lambda x: x[1],
        reverse=True
    )
    
    return [
        {
            "type": content_type,
            "percentage": int(percentage * 100),
            "description": _get_content_type_description(content_type)
        }
        for content_type, percentage in sorted_mix
    ]


def _get_content_type_description(content_type: str) -> str:
    """Get description for content type."""
    descriptions = {
        "educational": "Teach something valuable (how-to, tips, insights)",
        "entertaining": "Make them laugh or feel good (memes, humor, stories)",
        "behind_scenes": "Show the process (making of, team, office)",
        "promotional": "Sell (products, sales, launches)",
        "ugc": "User-generated content (reposts, testimonials)",
        "community": "Engage community (questions, polls, discussions)",
        "professional": "Business insights, industry commentary",
        "company_news": "Updates, milestones, hiring",
    }
    return descriptions.get(content_type, "Mixed content")


async def get_gary_vee_metrics(days: int = 30) -> dict:
    """Get metrics aligned with Gary Vee's key indicators."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    
    async with db_connection() as db:
        # Total content pieces (Gary Vee emphasizes volume)
        try:
            cursor = await db.execute(
                """SELECT COUNT(*) as total,
                           SUM(CASE WHEN platform = 'instagram' THEN 1 ELSE 0 END) as instagram,
                           SUM(CASE WHEN platform = 'facebook' THEN 1 ELSE 0 END) as facebook,
                           SUM(CASE WHEN platform = 'linkedin' THEN 1 ELSE 0 END) as linkedin
                    FROM social_posts
                    WHERE status = 'published'
                    AND published_at >= ?""",
                (since,)
            )
            volume = dict(await cursor.fetchone())
        except Exception:
            volume = {"total": 0, "instagram": 0, "facebook": 0, "linkedin": 0}
        
        # Engagement / performance - simplified to avoid missing columns
        performance = {"avg_engagement": 0, "avg_ctr": 0}
        
        # Reply rate (are you engaging back? Gary Vee: "Reply to EVERYONE")
        try:
            cursor = await db.execute(
                """SELECT 
                    COUNT(*) as total_engagement,
                    SUM(CASE WHEN replied_at IS NOT NULL THEN 1 ELSE 0 END) as replied
                FROM social_engagement_events
                WHERE event_type = 'comment'
                AND created_at >= ?""",
                (since,)
            )
            engagement = dict(await cursor.fetchone())
        except Exception:
            engagement = {"total_engagement": 0, "replied": 0}
    
    total_eng = engagement.get("total_engagement", 1)
    reply_rate = engagement.get("replied", 0) / total_eng if total_eng else 0
    
    # Gary Vee targets
    daily_target = sum(p["posts_per_day"] for p in DEFAULT_STRATEGY.values())
    monthly_target = daily_target * 30
    
    return {
        "gary_vee_score": {
            "volume": min(100, ((volume.get("total") or 0) / monthly_target) * 100),
            "engagement": min(100, (performance.get("avg_engagement") or 0) * 100 * 5),  # 2% = 100pts
            "reply_rate": min(100, reply_rate * 100),
            "sentiment": 50,  # Requires sentiment analysis — available in brand fork
        },
        "volume": {
            "total_pieces": volume.get("total") or 0,
            "target_monthly": monthly_target,
            "instagram": volume.get("instagram") or 0,
            "facebook": volume.get("facebook") or 0,
            "linkedin": volume.get("linkedin") or 0,
        },
        "performance": {
            "avg_engagement_rate": round(performance.get("avg_engagement") or 0, 4),
            "avg_ctr": round(performance.get("avg_ctr") or 0, 4),
            "reply_rate": round(reply_rate, 2),
            "positive_sentiment_rate": 0,
        },
        "gary_vee_grade": _calculate_grade(volume.get("total") or 0, monthly_target, reply_rate),
        "recommendations": _gary_vee_recommendations(volume.get("total") or 0, monthly_target, reply_rate),
        "total_posts_last_7_days": volume.get("total") or 0,
        "daily_average": round((volume.get("total") or 0) / max(days, 1), 1),
        "platform_breakdown": {
            "instagram": volume.get("instagram") or 0,
            "facebook": volume.get("facebook") or 0,
            "linkedin": volume.get("linkedin") or 0,
        },
    }


def _calculate_grade(actual: int, target: int, reply_rate: float) -> str:
    """Calculate Gary Vee style grade."""
    ratio = actual / target if target else 0
    
    if ratio >= 1.0 and reply_rate >= 0.9:
        return "A+ (Crushing It!)"
    elif ratio >= 0.8 and reply_rate >= 0.7:
        return "A (Great Volume)"
    elif ratio >= 0.5 and reply_rate >= 0.5:
        return "B (Good Effort)"
    elif ratio >= 0.3:
        return "C (Need More Content)"
    else:
        return "D (Gary Would Be Disappointed)"


def _gary_vee_recommendations(actual: int, target: int, reply_rate: float) -> list[str]:
    """Generate Gary Vee style recommendations."""
    recs = []
    
    ratio = actual / target if target else 0
    
    if ratio < 0.5:
        recs.append("🚨 You're posting less than half your target. Document, don't create!")
        recs.append("💡 Turn one blog post into 10 micro-content pieces")
        recs.append("📱 Instagram Stories are low-effort, high-engagement - use them")
    elif ratio < 0.8:
        recs.append("📈 Good volume, but you can push harder. More behind-the-scenes content!")
    
    if reply_rate < 0.5:
        recs.append("💬 Reply to EVERY comment. Gary's #1 rule: engage back!")
    elif reply_rate < 0.8:
        recs.append("👍 Decent reply rate, but aim for 90%+. Community > Everything")
    
    if not recs:
        recs.append("🔥 You're crushing it! Keep documenting, keep engaging!")
    
    return recs


async def get_content_pyramid_breakdown(content_id: int, content_type: str = "blog") -> dict:
    """Show how one piece of pillar content breaks into micro-content.
    
    Gary Vee's Content Pyramid:
    - 1 Pillar (blog/podcast/video)
    - → 10-20 Micro-content pieces (quotes, clips, images)
    - → 50+ Social posts (from those micro pieces)
    """
    # This would track how content was repurposed
    # For now, return template
    
    return {
        "pillar_content": {
            "id": content_id,
            "type": content_type,
            "title": "Pillar content title",
        },
        "micro_content_created": 0,  # Would track snippets, quotes, clips
        "social_posts_generated": 0,  # Would track posts from micro-content
        "gary_vee_target": "1 → 10 → 50",
        "efficiency": "0% (track this manually or implement content repurposing)",
    }
