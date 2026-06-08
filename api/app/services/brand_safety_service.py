"""Brand safety scanning service.

Uses AI to scan content before publication for:
  - Hate speech, harassment
  - Misinformation
  - Controversial topics
  - Brand-inappropriate content
  - Competitor mentions that might need review

Integrates with content workflow: scan → approve/reject → publish.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from app.database import db_connection
from app.services.ai_router import AITaskType, get_model_config, generate_with_config

logger = logging.getLogger(__name__)


RISK_CATEGORIES = [
    "hate_speech",
    "harassment",
    "misinformation",
    "controversial_political",
    "adult_content",
    "violence",
    "spam",
    "competitor_mention",
    "trademark_infringement",
]


async def scan_content(
    content_type: str,  # 'social_post' | 'blog_post' | 'influencer_submission'
    content_id: int,
    content_text: str,
) -> dict:
    """Scan content for brand safety issues.

    Returns risk assessment and stores results in brand_safety_scans.
    """
    system_prompt = f"""You are a brand safety expert. Analyze this content for potential risks.

Evaluate these categories: {', '.join(RISK_CATEGORIES)}

Respond with ONLY a JSON object:
{{
  "is_safe": true | false,
  "risk_level": "low" | "medium" | "high" | "critical",
  "risk_categories": ["category1", "category2"],
  "flagged_keywords": ["word1", "word2"],
  "explanation": "detailed explanation of concerns",
  "recommended_action": "approve" | "review" | "reject"
}}

Be conservative - flag borderline content for human review."""

    try:
        config = await get_model_config(AITaskType.SOCIAL_REPLY)  # Use best model for nuance
        result_text = await generate_with_config(content_text, system_prompt, config)

        # Extract JSON
        result_text = result_text.strip()
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0]
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0]

        result = json.loads(result_text.strip())

        # Ensure required fields
        result.setdefault("is_safe", True)
        result.setdefault("risk_level", "low")
        result.setdefault("risk_categories", [])
        result.setdefault("flagged_keywords", [])
        result.setdefault("explanation", "")
        result.setdefault("recommended_action", "approve")

    except Exception as e:
        logger.error(f"AI safety scan failed: {e}")
        # Fail safe - flag for review
        result = {
            "is_safe": None,
            "risk_level": "medium",
            "risk_categories": ["scan_failed"],
            "flagged_keywords": [],
            "explanation": f"AI scan failed: {e}. Content requires manual review.",
            "recommended_action": "review",
        }

    # Store scan results
    async with db_connection() as db:
        await db.execute(
            """INSERT INTO brand_safety_scans
               (content_type, content_id, content_text, is_safe, risk_level,
                risk_categories, flagged_keywords, ai_explanation)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                content_type,
                content_id,
                content_text[:2000],
                result["is_safe"],
                result["risk_level"],
                json.dumps(result["risk_categories"]),
                json.dumps(result["flagged_keywords"]),
                result["explanation"],
            ),
        )
        await db.commit()

    logger.info(f"Brand safety scan: {content_type}#{content_id} = {result['risk_level']}")

    return result


async def override_safety_scan(
    scan_id: int,
    reviewed_by: str,
    mark_as_safe: bool,
) -> dict:
    """Human override of AI safety scan."""
    async with db_connection() as db:
        await db.execute(
            """UPDATE brand_safety_scans
               SET reviewed_by = ?, override_safe = ?, is_safe = ?
               WHERE id = ?""",
            (reviewed_by, mark_as_safe, mark_as_safe, scan_id),
        )
        await db.commit()

    return {"scan_id": scan_id, "override": mark_as_safe, "reviewed_by": reviewed_by}


async def get_content_safety_status(
    content_type: str,
    content_id: int,
) -> dict | None:
    """Get latest safety scan for content."""
    async with db_connection() as db:
        cursor = await db.execute(
            """SELECT * FROM brand_safety_scans
               WHERE content_type = ? AND content_id = ?
               ORDER BY created_at DESC
               LIMIT 1""",
            (content_type, content_id),
        )
        row = await cursor.fetchone()

    if not row:
        return None

    return {
        "scan_id": row["id"],
        "is_safe": row["is_safe"],
        "risk_level": row["risk_level"],
        "risk_categories": json.loads(row["risk_categories"] or "[]"),
        "explanation": row["ai_explanation"],
        "override": row["override_safe"],
        "created_at": row["created_at"],
    }
