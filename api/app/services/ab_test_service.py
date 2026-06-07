"""A/B Testing service for social posts.

Manages creation, execution, and analysis of A/B tests.

Test types:
  - headline: different text/caption
  - image: different visual
  - cta: different call-to-action
  - time: different posting times (requires multiple test posts)

Winner selection based on:
  - engagement (likes+comments+shares)
  - reach (impressions)
  - clicks (CTR)
  - revenue (attributed sales)
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone, timedelta

from app.database import db_connection
from app.services.best_time_service import suggest_next_post_time
from app.services.scheduler_service import schedule_post

logger = logging.getLogger(__name__)


async def create_ab_test(
    name: str,
    platform: str,
    test_type: str,
    variants: list[dict],  # [{"variant_name": "A", "content": "...", "image_url": "..."}, ...]
    metric_criteria: str = "engagement",
    duration_hours: int = 48,
    created_by: str = "admin",
) -> dict:
    """Create an A/B test with variants.

    Returns test_id and scheduled times for each variant.
    """
    if len(variants) < 2:
        raise ValueError("A/B test requires at least 2 variants")

    if metric_criteria not in ("engagement", "reach", "clicks", "revenue"):
        raise ValueError("metric_criteria must be: engagement, reach, clicks, or revenue")

    async with db_connection() as db:
        # Create test record
        cursor = await db.execute(
            """INSERT INTO ab_tests
               (name, platform, test_type, metric_criteria, duration_hours, created_by)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (name, platform, test_type, metric_criteria, duration_hours, created_by),
        )
        test_id = cursor.lastrowid

        # Schedule variants at optimal times, spaced apart
        variant_schedules = []
        for i, variant in enumerate(variants):
            # Get suggested time for this platform
            time_suggestion = await suggest_next_post_time(platform, min_hours_ahead=2 + (i * 2))

            if "suggested_time" not in time_suggestion:
                # Fallback to now + 2 hours + i hours
                fallback_time = datetime.now(timezone.utc) + timedelta(hours=2 + i)
                time_suggestion["suggested_time"] = fallback_time.isoformat()

            scheduled_at = time_suggestion["suggested_time"]

            # Create variant record
            cursor = await db.execute(
                """INSERT INTO ab_test_variants
                   (ab_test_id, variant_name, content, image_url, scheduled_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (
                    test_id,
                    variant["variant_name"],
                    variant["content"],
                    variant.get("image_url"),
                    scheduled_at,
                ),
            )
            variant_id = cursor.lastrowid

            # Create social_posts draft (will be published at scheduled_at)
            cursor = await db.execute(
                """INSERT INTO social_posts
                   (platform, content, image_url, status, scheduled_at, ab_test_variant_id)
                   VALUES (?, ?, ?, 'scheduled', ?, ?)""",
                (platform, variant["content"], variant.get("image_url"), scheduled_at, variant_id),
            )
            social_post_id = cursor.lastrowid

            # Link variant to social post
            await db.execute(
                "UPDATE ab_test_variants SET social_post_id = ? WHERE id = ?",
                (social_post_id, variant_id),
            )

            variant_schedules.append({
                "variant_id": variant_id,
                "variant_name": variant["variant_name"],
                "social_post_id": social_post_id,
                "scheduled_at": scheduled_at,
            })

        await db.commit()

    logger.info(f"Created A/B test {test_id} with {len(variants)} variants on {platform}")
    return {
        "test_id": test_id,
        "name": name,
        "platform": platform,
        "variants": variant_schedules,
    }


async def start_ab_test(test_id: int) -> dict:
    """Mark an A/B test as running and set start_time."""
    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT status FROM ab_tests WHERE id = ?", (test_id,)
        )
        row = await cursor.fetchone()
        if not row:
            raise ValueError(f"Test {test_id} not found")
        if row["status"] != "draft":
            raise ValueError(f"Test {test_id} already started or completed")

        await db.execute(
            """UPDATE ab_tests
               SET status = 'running', start_time = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (test_id,),
        )
        await db.commit()

    return {"test_id": test_id, "status": "running"}


async def update_variant_metrics(test_id: int) -> dict:
    """Pull latest metrics from social_posts and update variant scores."""
    async with db_connection() as db:
        # Get test criteria
        cursor = await db.execute(
            "SELECT metric_criteria FROM ab_tests WHERE id = ?", (test_id,)
        )
        row = await cursor.fetchone()
        if not row:
            raise ValueError(f"Test {test_id} not found")
        metric = row["metric_criteria"]

        # Get variants with their social post metrics
        cursor = await db.execute(
            """SELECT v.id, v.social_post_id, v.variant_name,
                       sp.reach, sp.impressions, sp.likes, sp.comments_count,
                       sp.shares, sp.clicks
                FROM ab_test_variants v
                JOIN social_posts sp ON v.social_post_id = sp.id
                WHERE v.ab_test_id = ?""",
            (test_id,),
        )
        variants = await cursor.fetchall()

        # Calculate performance scores
        for v in variants:
            if metric == "engagement":
                score = (v["likes"] or 0) + (v["comments_count"] or 0) + (v["shares"] or 0)
            elif metric == "reach":
                score = v["reach"] or 0
            elif metric == "clicks":
                score = v["clicks"] or 0
            else:  # revenue - need to check social_revenue_attribution
                cursor = await db.execute(
                    "SELECT SUM(revenue_cents) as total FROM social_revenue_attribution WHERE social_post_id = ?",
                    (v["social_post_id"],),
                )
                revenue_row = await cursor.fetchone()
                score = revenue_row["total"] or 0 if revenue_row else 0

            await db.execute(
                """UPDATE ab_test_variants
                   SET reach = ?, impressions = ?, likes = ?, comments = ?,
                       shares = ?, clicks = ?, revenue_cents = ?, performance_score = ?
                   WHERE id = ?""",
                (
                    v["reach"] or 0,
                    v["impressions"] or 0,
                    v["likes"] or 0,
                    v["comments_count"] or 0,
                    v["shares"] or 0,
                    v["clicks"] or 0,
                    score if metric == "revenue" else 0,
                    score,
                    v["id"],
                ),
            )

        # Find winner
        cursor = await db.execute(
            """SELECT id, variant_name, performance_score
                FROM ab_test_variants
                WHERE ab_test_id = ?
                ORDER BY performance_score DESC
                LIMIT 1""",
            (test_id,),
        )
        winner = await cursor.fetchone()

        if winner:
            await db.execute(
                "UPDATE ab_test_variants SET is_winner = TRUE WHERE id = ?",
                (winner["id"],),
            )

        await db.commit()

    return {
        "test_id": test_id,
        "metric": metric,
        "winner": {"variant_id": winner["id"], "variant_name": winner["variant_name"], "score": winner["performance_score"]} if winner else None,
        "variants_updated": len(variants),
    }


async def complete_ab_test(test_id: int) -> dict:
    """Mark an A/B test as completed and finalize winner."""
    # Update metrics one final time
    await update_variant_metrics(test_id)

    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT variant_name, performance_score, is_winner FROM ab_test_variants WHERE ab_test_id = ? ORDER BY performance_score DESC",
            (test_id,),
        )
        results = [dict(r) for r in await cursor.fetchall()]

        # Get winner
        winner = next((r for r in results if r["is_winner"]), None)

        await db.execute(
            """UPDATE ab_tests
               SET status = 'completed',
                   end_time = CURRENT_TIMESTAMP,
                   winning_variant_id = ?
               WHERE id = ?""",
            (winner["id"] if winner else None, test_id),
        )
        await db.commit()

    return {
        "test_id": test_id,
        "status": "completed",
        "winner": winner,
        "results": results,
    }


async def get_ab_test_results(test_id: int) -> dict:
    """Get full results of an A/B test."""
    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT * FROM ab_tests WHERE id = ?", (test_id,)
        )
        test = await cursor.fetchone()
        if not test:
            raise ValueError(f"Test {test_id} not found")

        cursor = await db.execute(
            """SELECT v.*, sp.content, sp.status as post_status
                FROM ab_test_variants v
                JOIN social_posts sp ON v.social_post_id = sp.id
                WHERE v.ab_test_id = ?""",
            (test_id,),
        )
        variants = [dict(r) for r in await cursor.fetchall()]

    return {
        "test": dict(test),
        "variants": variants,
    }
