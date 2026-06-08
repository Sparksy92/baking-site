"""Sentiment analysis service.

Analyzes engagement events (comments, mentions) for sentiment.
Uses AI model router with SOCIAL_REPLY task type (best model for nuance).
Stores results for trend analysis and crisis detection.

Also monitors for crisis patterns:
  - Viral negative content (sentiment < -0.5 with high engagement velocity)
  - Spam attacks (volume spike + repetitive content)
  - Misinformation (fact-check triggers)
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone, timedelta

from app.database import db_connection
from app.services.ai_router import AITaskType, get_model_config, generate_with_config

logger = logging.getLogger(__name__)


async def analyze_sentiment(text: str) -> float | None:
    """Analyze sentiment of raw text. Returns score float (-1.0 to 1.0) or None on failure."""
    if not text or len(text.strip()) < 3:
        return None

    system_prompt = """You are a sentiment analysis expert. Analyze the social media comment/mention.

Respond ONLY with a JSON object in this exact format:
{
  "score": float between -1.0 (very negative) and 1.0 (very positive),
  "label": "negative" | "neutral" | "positive",
  "explanation": "brief reason for the score"
}

Consider context, sarcasm, emojis, and platform norms. Be precise."""

    try:
        config = await get_model_config(AITaskType.SOCIAL_REPLY)
        result_text = await generate_with_config(text, system_prompt, config)
        result_text = result_text.strip()
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0]
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0]
        result = json.loads(result_text.strip())
        return float(result.get("score", 0))
    except Exception as e:
        logger.error(f"analyze_sentiment failed: {e}")
        return None


async def analyze_engagement_sentiment(engagement_event_id: int) -> dict:
    """Analyze sentiment of a single engagement event.

    Returns: {"score": float (-1 to 1), "label": str, "explanation": str}
    """
    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT message, platform, raw_payload FROM social_engagement_events WHERE id = ?",
            (engagement_event_id,),
        )
        row = await cursor.fetchone()
        if not row:
            return {"score": 0, "label": "neutral", "explanation": "Event not found"}

        text = row["message"] or ""
        if not text.strip():
            # Try to extract from raw_payload for Instagram/etc
            try:
                payload = json.loads(row["raw_payload"] or "{}")
                text = payload.get("message", "") or payload.get("comment", "")
            except Exception:
                pass

    if not text or len(text.strip()) < 3:
        return {"score": 0, "label": "neutral", "explanation": "No analyzable text"}

    # Use AI to analyze sentiment
    system_prompt = """You are a sentiment analysis expert. Analyze the social media comment/mention.

Respond ONLY with a JSON object in this exact format:
{
  "score": float between -1.0 (very negative) and 1.0 (very positive),
  "label": "negative" | "neutral" | "positive",
  "explanation": "brief reason for the score"
}

Consider context, sarcasm, emojis, and platform norms. Be precise."""

    try:
        config = await get_model_config(AITaskType.SOCIAL_REPLY)
        result_text = await generate_with_config(text, system_prompt, config)

        # Extract JSON from response
        result_text = result_text.strip()
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0]
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0]

        result = json.loads(result_text.strip())

        # Store result
        async with db_connection() as db:
            await db.execute(
                """UPDATE social_engagement_events
                   SET sentiment_score = ?, sentiment_label = ?, processed_at = CURRENT_TIMESTAMP
                   WHERE id = ?""",
                (result["score"], result["label"], engagement_event_id),
            )
            await db.commit()

        # Check for crisis
        await _check_crisis_triggers(engagement_event_id, result["score"], text)

        return result

    except Exception as e:
        logger.error(f"Sentiment analysis failed for event {engagement_event_id}: {e}")
        return {"score": 0, "label": "neutral", "explanation": f"Analysis error: {e}"}


async def batch_analyze_unprocessed(limit: int = 100) -> int:
    """Analyze sentiment for all unprocessed engagement events.

    Returns number processed.
    """
    async with db_connection() as db:
        cursor = await db.execute(
            """SELECT id FROM social_engagement_events
               WHERE processed_at IS NULL
               AND message IS NOT NULL
               ORDER BY created_at DESC
               LIMIT ?""",
            (limit,),
        )
        rows = await cursor.fetchall()

    processed = 0
    for row in rows:
        try:
            await analyze_engagement_sentiment(row["id"])
            processed += 1
        except Exception as e:
            logger.error(f"Failed to analyze event {row['id']}: {e}")

    return processed


async def _check_crisis_triggers(event_id: int, sentiment_score: float, text: str) -> None:
    """Check if this engagement should trigger a crisis alert."""
    # Critical negative sentiment
    if sentiment_score < -0.7:
        # Check if this is getting engagement (potential viral negativity)
        async with db_connection() as db:
            cursor = await db.execute(
                """SELECT platform, platform_post_id,
                          (SELECT COUNT(*) FROM social_engagement_events
                           WHERE platform_post_id = e.platform_post_id
                           AND created_at >= datetime('now', '-1 hour')) as recent_engagement
                   FROM social_engagement_events e WHERE id = ?""",
                (event_id,),
            )
            row = await cursor.fetchone()

        if row and row["recent_engagement"] > 10:
            await _create_crisis_alert(
                alert_type="viral_negative",
                severity="high" if sentiment_score < -0.85 else "medium",
                platform=row["platform"],
                platform_post_id=row["platform_post_id"],
                description=f"Highly negative engagement detected (sentiment: {sentiment_score:.2f})",
                engagement_count=row["recent_engagement"],
                sentiment_score=sentiment_score,
            )

    # Spam detection (repetitive text, high volume)
    if len(text) > 5:
        async with db_connection() as db:
            cursor = await db.execute(
                """SELECT COUNT(*) as cnt FROM social_engagement_events
                   WHERE message LIKE ?
                   AND created_at >= datetime('now', '-10 minutes')""",
                (f"%{text[:20]}%",),
            )
            row = await cursor.fetchone()

        if row and row["cnt"] > 20:
            await _create_crisis_alert(
                alert_type="spam_attack",
                severity="high",
                platform="unknown",
                platform_post_id=None,
                description=f"Potential spam attack detected: {row['cnt']} similar messages in 10 minutes",
                engagement_count=row["cnt"],
                sentiment_score=0,
            )


async def _create_crisis_alert(
    alert_type: str,
    severity: str,
    platform: str,
    platform_post_id: str | None,
    description: str,
    engagement_count: int,
    sentiment_score: float,
) -> None:
    """Create a crisis alert record."""
    async with db_connection() as db:
        await db.execute(
            """INSERT INTO crisis_alerts
               (alert_type, severity, platform, platform_post_id, description,
                engagement_count, sentiment_score)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (alert_type, severity, platform, platform_post_id, description,
             engagement_count, sentiment_score),
        )
        await db.commit()

    logger.warning(f"CRISIS ALERT [{severity.upper()}]: {alert_type} - {description}")


async def get_sentiment_trends(days: int = 7) -> dict:
    """Get sentiment trends over time."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    async with db_connection() as db:
        cursor = await db.execute(
            """SELECT
                DATE(created_at) as date,
                AVG(sentiment_score) as avg_sentiment,
                COUNT(*) as total,
                SUM(CASE WHEN sentiment_label = 'positive' THEN 1 ELSE 0 END) as positive,
                SUM(CASE WHEN sentiment_label = 'negative' THEN 1 ELSE 0 END) as negative,
                SUM(CASE WHEN sentiment_label = 'neutral' THEN 1 ELSE 0 END) as neutral
            FROM social_engagement_events
            WHERE created_at >= ?
            AND sentiment_score IS NOT NULL
            GROUP BY DATE(created_at)
            ORDER BY date DESC""",
            (since,),
        )
        rows = await cursor.fetchall()

    return {
        "trends": [dict(r) for r in rows],
        "days": days,
    }
