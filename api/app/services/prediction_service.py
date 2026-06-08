"""Content performance prediction service.

Uses AI and historical data to predict post performance before publishing.
Helps optimize content before it goes live.

Predicts:
  - Estimated reach
  - Estimated engagement (likes + comments + shares)
  - Estimated CTR (click-through rate)
  - Confidence score based on available data
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from app.database import db_connection
from app.services.ai_router import AITaskType, get_model_config, generate_with_config

logger = logging.getLogger(__name__)

PREDICTION_MODEL_VERSION = "v1.0"


async def predict_content_performance(
    content_type: str,  # 'social_post' | 'influencer_submission'
    content_id: int,
    content_text: str,
    platform: str,
    image_url: str | None = None,
    scheduled_at: str | None = None,
) -> dict:
    """Predict performance of content before publishing.

    Uses AI to analyze content quality + historical platform performance.
    """
    # Get historical averages for this platform
    async with db_connection() as db:
        cursor = await db.execute(
            """SELECT
                AVG(reach) as avg_reach,
                AVG(likes + comments_count + shares) as avg_engagement,
                AVG(CASE WHEN reach > 0 THEN clicks * 1.0 / reach ELSE 0 END) as avg_ctr,
                COUNT(*) as sample_size
            FROM social_posts
            WHERE platform = ?
            AND status = 'published'
            AND published_at >= datetime('now', '-90 days')""",
            (platform,),
        )
        hist = await cursor.fetchone()

    avg_reach = int(hist["avg_reach"] or 1000)
    avg_engagement = int(hist["avg_engagement"] or 50)
    avg_ctr = hist["avg_ctr"] or 0.02
    sample_size = hist["sample_size"] or 1

    # AI prediction of content quality multiplier
    system_prompt = f"""You are a social media performance predictor. Analyze this {platform} post.

Historical averages for this platform:
- Average reach: {avg_reach}
- Average engagement: {avg_engagement}
- Average CTR: {avg_ctr:.2%}

Rate this content 1-10 on:
1. Hook strength (first sentence grabs attention)
2. Call-to-action clarity
3. Emotional resonance
4. Shareability

Respond ONLY with JSON:
{{
  "quality_score": 1-10,
  "reach_multiplier": 0.5-2.0,
  "engagement_multiplier": 0.5-2.0,
  "ctr_multiplier": 0.5-2.0,
  "strengths": ["hook", "cta", etc],
  "weaknesses": ["too_long", "weak_cta", etc],
  "suggestions": ["make hook punchier", "add emoji", etc]
}}"""

    try:
        config = await get_model_config(AITaskType.SEO_SYNTHESIS)
        result_text = await generate_with_config(content_text, system_prompt, config)

        # Extract JSON
        result_text = result_text.strip()
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0]
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0]

        ai_result = json.loads(result_text.strip())

        # Calculate predictions
        reach_multiplier = max(0.5, min(2.0, ai_result.get("reach_multiplier", 1.0)))
        engagement_multiplier = max(0.5, min(2.0, ai_result.get("engagement_multiplier", 1.0)))
        ctr_multiplier = max(0.5, min(2.0, ai_result.get("ctr_multiplier", 1.0)))

        predicted_reach = int(avg_reach * reach_multiplier)
        predicted_engagement = int(avg_engagement * engagement_multiplier)
        predicted_ctr = min(avg_ctr * ctr_multiplier, 0.5)  # Cap at 50%

        # Confidence based on sample size
        confidence = min(0.95, 0.3 + (sample_size / 200))

        prediction = {
            "predicted_reach": predicted_reach,
            "predicted_engagement": predicted_engagement,
            "predicted_ctr": round(predicted_ctr, 4),
            "confidence": round(confidence, 2),
            "quality_score": ai_result.get("quality_score", 5),
            "strengths": ai_result.get("strengths", []),
            "weaknesses": ai_result.get("weaknesses", []),
            "suggestions": ai_result.get("suggestions", []),
        }

    except Exception as e:
        logger.error(f"AI prediction failed: {e}")
        # Fallback to baseline
        prediction = {
            "predicted_reach": avg_reach,
            "predicted_engagement": avg_engagement,
            "predicted_ctr": round(avg_ctr, 4),
            "confidence": 0.3,
            "quality_score": 5,
            "strengths": [],
            "weaknesses": ["prediction_failed"],
            "suggestions": ["manual review recommended"],
        }

    # Store prediction
    async with db_connection() as db:
        await db.execute(
            """INSERT INTO content_predictions
               (content_type, content_id, predicted_reach, predicted_engagement,
                predicted_ctr, confidence_score, prediction_model)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                content_type,
                content_id,
                prediction["predicted_reach"],
                prediction["predicted_engagement"],
                prediction["predicted_ctr"],
                prediction["confidence"],
                PREDICTION_MODEL_VERSION,
            ),
        )
        await db.commit()

    return prediction


async def resolve_prediction(
    content_type: str,
    content_id: int,
    actual_reach: int,
    actual_engagement: int,
    actual_ctr: float,
) -> dict:
    """Fill in actual performance and calculate prediction accuracy."""
    async with db_connection() as db:
        # Get the prediction
        cursor = await db.execute(
            """SELECT * FROM content_predictions
               WHERE content_type = ? AND content_id = ?
               AND resolved_at IS NULL
               ORDER BY created_at DESC
               LIMIT 1""",
            (content_type, content_id),
        )
        pred = await cursor.fetchone()

        if not pred:
            return {"error": "No unresolved prediction found"}

        # Calculate accuracy delta
        reach_delta = abs(pred["predicted_reach"] - actual_reach) / max(actual_reach, 1)
        engagement_delta = abs(pred["predicted_engagement"] - actual_engagement) / max(actual_engagement, 1)
        ctr_delta = abs(pred["predicted_ctr"] - actual_ctr) / max(actual_ctr, 0.001)

        avg_delta = (reach_delta + engagement_delta + ctr_delta) / 3
        accuracy_delta = round(avg_delta, 4)

        # Update with actuals
        await db.execute(
            """UPDATE content_predictions
               SET actual_reach = ?, actual_engagement = ?, actual_ctr = ?,
                   accuracy_delta = ?, resolved_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (actual_reach, actual_engagement, actual_ctr, accuracy_delta, pred["id"]),
        )
        await db.commit()

    return {
        "prediction_id": pred["id"],
        "predicted": {
            "reach": pred["predicted_reach"],
            "engagement": pred["predicted_engagement"],
            "ctr": pred["predicted_ctr"],
        },
        "actual": {
            "reach": actual_reach,
            "engagement": actual_engagement,
            "ctr": actual_ctr,
        },
        "accuracy_delta": accuracy_delta,  # Lower is better
    }


async def get_prediction_accuracy(days: int = 30) -> dict:
    """Get overall prediction accuracy statistics."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    async with db_connection() as db:
        cursor = await db.execute(
            """SELECT
                AVG(accuracy_delta) as avg_delta,
                COUNT(*) as total_predictions,
                AVG(CASE WHEN accuracy_delta < 0.3 THEN 1 ELSE 0 END) as good_predictions
            FROM content_predictions
            WHERE resolved_at >= ?""",
            (since,),
        )
        row = await cursor.fetchone()

    if not row or row["total_predictions"] == 0:
        return {"message": "No resolved predictions in this period"}

    return {
        "avg_accuracy_delta": round(row["avg_delta"], 4),
        "total_predictions": row["total_predictions"],
        "good_predictions": int(row["good_predictions"] or 0),
        "good_prediction_rate": round((row["good_predictions"] or 0) / row["total_predictions"], 2),
    }
