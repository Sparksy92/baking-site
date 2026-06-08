"""Best-Time-to-Post ML service.

Analyzes historical post performance by day-of-week and hour-of-day
to recommend optimal posting times per platform.

Updates optimal_posting_times table weekly based on last 90 days of data.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

from app.database import db_connection

logger = logging.getLogger(__name__)


async def calculate_optimal_times(platform: str | None = None) -> dict:
    """Calculate optimal posting times from historical data.

    Analyzes last 90 days of published posts, aggregates by day-of-week
    and hour-of-day, computes engagement rate, ranks slots.
    """
    since = datetime.now(timezone.utc) - timedelta(days=90)

    platform_filter = "AND platform = ?" if platform else ""
    params = [since]
    if platform:
        params.append(platform)

    async with db_connection() as db:
        # Get aggregated performance by dow/hour
        cursor = await db.execute(
            f"""SELECT
                platform,
                CAST(EXTRACT(DOW FROM CAST(published_at AS TIMESTAMPTZ)) AS INTEGER) as dow,
                CAST(EXTRACT(HOUR FROM CAST(published_at AS TIMESTAMPTZ)) AS INTEGER) as hour,
                AVG(COALESCE(reach_count, 0)) as avg_reach,
                AVG(COALESCE(engagement_score, 0)) as avg_engagement,
                AVG(CASE WHEN COALESCE(reach_count, 0) > 0 THEN engagement_score * 1.0 / reach_count ELSE 0 END) as avg_ctr,
                COUNT(*) as sample_size
            FROM social_posts
            WHERE status = 'published'
            AND published_at >= ?
            {platform_filter}
            AND platform_post_id IS NOT NULL
            GROUP BY platform, dow, hour
            HAVING COUNT(*) >= 3  -- need at least 3 posts for statistical relevance
            ORDER BY platform, avg_engagement DESC""",
            params,
        )
        rows = await cursor.fetchall()

    # Store/update results
    updated = 0
    for row in rows:
        sample_size = row["sample_size"]
        # Confidence based on sample size (0.5 at 3 samples → 0.95 at 50+)
        confidence = min(0.95, 0.5 + (sample_size / 100))

        async with db_connection() as db:
            await db.execute(
                """INSERT INTO optimal_posting_times
                   (platform, day_of_week, hour_of_day, avg_reach, avg_engagement,
                    avg_ctr, sample_size, confidence, last_updated)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                   ON CONFLICT(platform, day_of_week, hour_of_day)
                   DO UPDATE SET
                       avg_reach = excluded.avg_reach,
                       avg_engagement = excluded.avg_engagement,
                       avg_ctr = excluded.avg_ctr,
                       sample_size = excluded.sample_size,
                       confidence = excluded.confidence,
                       last_updated = CURRENT_TIMESTAMP""",
                (
                    row["platform"],
                    row["dow"],
                    row["hour"],
                    int(row["avg_reach"]),
                    int(row["avg_engagement"]),
                    row["avg_ctr"] or 0,
                    sample_size,
                    confidence,
                ),
            )
            updated += 1

        await db.commit()

    logger.info(f"Updated {updated} optimal time slots{' for ' + platform if platform else ''}")
    return {"updated_slots": updated}


async def get_recommended_times(
    platform: str,
    limit: int = 5,
    min_confidence: float = 0.6,
) -> list[dict]:
    """Get top recommended posting times for a platform.

    Returns ranked slots with confidence scores.
    """
    try:
        async with db_connection() as db:
            cursor = await db.execute(
                """SELECT
                    day_of_week, hour_of_day,
                    avg_reach, avg_engagement, avg_ctr,
                    sample_size, confidence
                FROM optimal_posting_times
                WHERE platform = ?
                AND confidence >= ?
                ORDER BY avg_engagement DESC
                LIMIT ?""",
                (platform, min_confidence, limit),
            )
            rows = await cursor.fetchall()
    except Exception:
        rows = []

    days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    results = []
    for r in rows:
        results.append({
            "day": days[r["day_of_week"]],
            "day_of_week": r["day_of_week"],
            "hour": r["hour_of_day"],
            "time_slot": f"{r['hour_of_day']:02d}:00",
            "avg_reach": r["avg_reach"],
            "avg_engagement": r["avg_engagement"],
            "avg_ctr": round(r["avg_ctr"], 4),
            "sample_size": r["sample_size"],
            "confidence": round(r["confidence"], 2),
        })

    return results


async def suggest_next_post_time(platform: str, min_hours_ahead: int = 2) -> dict:
    """Suggest the next optimal time to post on a platform.

    Considers:
      1. Historical performance (optimal_posting_times)
      2. Current time (don't suggest past slots)
      3. Buffer from now (min_hours_ahead)
    """
    now = datetime.now(timezone.utc)
    current_dow = now.weekday()  # Monday=0 in Python, but our table uses Sunday=0
    # Convert: Python weekday (0=Mon) → SQL strftime dow (0=Sun)
    dow_map = {0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 0}
    current_dow_sql = dow_map[current_dow]
    current_hour = now.hour

    # Get all recommended slots for this platform
    slots = await get_recommended_times(platform, limit=20, min_confidence=0.5)

    # Find next viable slot
    for slot in slots:
        slot_dow = slot["day_of_week"]
        slot_hour = slot["hour"]

        # Calculate days ahead
        days_ahead = (slot_dow - current_dow_sql) % 7
        if days_ahead == 0 and slot_hour <= current_hour:
            days_ahead = 7  # Already passed today, go to next week

        suggested_time = now.replace(hour=slot_hour, minute=0, second=0, microsecond=0)
        suggested_time += timedelta(days=days_ahead)

        # Ensure minimum hours ahead
        hours_until = (suggested_time - now).total_seconds() / 3600
        if hours_until >= min_hours_ahead:
            return {
                "suggested_time": suggested_time.isoformat(),
                "days_ahead": days_ahead,
                "hours_until": round(hours_until, 1),
                "day": slot["day"],
                "time_slot": slot["time_slot"],
                "expected_engagement": slot["avg_engagement"],
                "confidence": slot["confidence"],
                "reason": f"Historically {slot['avg_engagement']} avg engagement on {slot['day']} at {slot['time_slot']}",
            }

    # Fallback: return best slot even if soon
    if slots:
        slot = slots[0]
        return {
            "suggested_time": None,
            "day": slot["day"],
            "time_slot": slot["time_slot"],
            "expected_engagement": slot["avg_engagement"],
            "confidence": slot["confidence"],
            "reason": "Best historical slot, but very soon — consider scheduling for next week",
        }

    return {"error": "No data available for this platform"}
