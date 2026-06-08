"""Influencer management service.

Manages influencer relationships, collaborations, and ROI tracking.

Workflow:
  1. Discover and add influencers
  2. Create collaboration with deliverables
  3. Influencer submits content for approval
  4. Content goes live, track performance
  5. Calculate ROI based on attributed revenue
"""
from __future__ import annotations

import json
import logging
import secrets
from datetime import datetime, timezone, timedelta

from app.database import db_connection

logger = logging.getLogger(__name__)


def generate_tracking_code() -> str:
    """Generate unique UTM tracking code for influencer collaboration."""
    return f"INF{secrets.token_hex(6).upper()}"


async def add_influencer(
    name: str,
    platform: str,
    handle: str,
    follower_count: int | None = None,
    engagement_rate: float | None = None,
    niche: str = "",
    location: str = "",
    email: str = "",
    notes: str = "",
) -> dict:
    """Add a new influencer to the database."""
    async with db_connection() as db:
        cursor = await db.execute(
            """INSERT INTO influencers
               (name, platform, handle, follower_count, engagement_rate, niche, location, email, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (name, platform, handle, follower_count, engagement_rate, niche, location, email, notes),
        )
        await db.commit()
        influencer_id = cursor.lastrowid

    return {"influencer_id": influencer_id, "name": name, "handle": handle}


async def create_collaboration(
    influencer_id: int,
    campaign_name: str,
    deliverables: dict,  # {"posts": 2, "stories": 3, "reels": 1}
    compensation_cents: int,
    product_value_cents: int = 0,
    start_date: str | None = None,
    end_date: str | None = None,
    content_requirements: str = "",
    approval_required: bool = True,
    created_by: str = "admin",
) -> dict:
    """Create a new influencer collaboration."""
    tracking_code = generate_tracking_code()

    async with db_connection() as db:
        cursor = await db.execute(
            """INSERT INTO influencer_collaborations
               (influencer_id, campaign_name, deliverables, compensation_cents,
                product_value_cents, start_date, end_date, content_requirements,
                approval_required, tracking_code, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                influencer_id,
                campaign_name,
                json.dumps(deliverables),
                compensation_cents,
                product_value_cents,
                start_date,
                end_date,
                content_requirements,
                approval_required,
                tracking_code,
                created_by,
            ),
        )
        await db.commit()
        collab_id = cursor.lastrowid

    return {
        "collaboration_id": collab_id,
        "tracking_code": tracking_code,
        "campaign_name": campaign_name,
    }


async def submit_influencer_content(
    collaboration_id: int,
    content_type: str,  # 'post' | 'story' | 'reel'
    caption: str,
    media_urls: list[str],
) -> dict:
    """Influencer submits content for approval."""
    async with db_connection() as db:
        cursor = await db.execute(
            """INSERT INTO influencer_submissions
               (collaboration_id, content_type, caption, media_urls, status)
               VALUES (?, ?, ?, ?, 'pending')""",
            (collaboration_id, content_type, caption, json.dumps(media_urls)),
        )
        await db.commit()
        submission_id = cursor.lastrowid

    return {"submission_id": submission_id, "status": "pending"}


async def review_influencer_submission(
    submission_id: int,
    decision: str,  # 'approved' | 'rejected' | 'revision_requested'
    reviewed_by: str,
    feedback: str = "",
) -> dict:
    """Review influencer content submission."""
    from datetime import datetime, timezone

    async with db_connection() as db:
        await db.execute(
            """UPDATE influencer_submissions
               SET status = ?, reviewed_by = ?, reviewed_at = ?, feedback = ?
               WHERE id = ?""",
            (decision, reviewed_by, datetime.now(timezone.utc).isoformat(), feedback, submission_id),
        )
        await db.commit()

        # If approved, update collaboration deliverables count
        if decision == "approved":
            cursor = await db.execute(
                """SELECT collaboration_id, content_type FROM influencer_submissions WHERE id = ?""",
                (submission_id,),
            )
            row = await cursor.fetchone()
            if row:
                collab_id = row["collaboration_id"]
                content_type = row["content_type"]

                # Increment posts_delivered
                await db.execute(
                    """UPDATE influencer_collaborations
                       SET posts_delivered = posts_delivered + 1
                       WHERE id = ?""",
                    (collab_id,),
                )
                await db.commit()

    return {"submission_id": submission_id, "decision": decision}


async def record_influencer_post_live(
    submission_id: int,
    platform_post_id: str,
) -> dict:
    """Mark influencer content as live and record platform post ID."""
    async with db_connection() as db:
        await db.execute(
            """UPDATE influencer_submissions
               SET platform_post_id = ?
               WHERE id = ?""",
            (platform_post_id, submission_id),
        )
        await db.commit()

    return {"submission_id": submission_id, "platform_post_id": platform_post_id}


async def update_collaboration_performance(
    collaboration_id: int,
) -> dict:
    """Calculate and update ROI for a collaboration."""
    async with db_connection() as db:
        # Get collaboration details
        cursor = await db.execute(
            "SELECT * FROM influencer_collaborations WHERE id = ?",
            (collaboration_id,),
        )
        collab = await cursor.fetchone()

        if not collab:
            raise ValueError(f"Collaboration {collaboration_id} not found")

        tracking_code = collab["tracking_code"]
        total_cost = (collab["compensation_cents"] or 0) + (collab["product_value_cents"] or 0)

        # Get attributed revenue from tracking code
        cursor = await db.execute(
            """SELECT SUM(revenue_cents) as total
               FROM social_revenue_attribution
               WHERE utm_campaign = ?""",
            (tracking_code,),
        )
        revenue_row = await cursor.fetchone()
        revenue_cents = revenue_row["total"] or 0 if revenue_row else 0

        # Calculate ROI
        roi_percent = 0
        if total_cost > 0:
            roi_percent = int(((revenue_cents - total_cost) / total_cost) * 100)

        # Update collaboration
        await db.execute(
            """UPDATE influencer_collaborations
               SET revenue_attributed_cents = ?, roi_percent = ?
               WHERE id = ?""",
            (revenue_cents, roi_percent, collaboration_id),
        )
        await db.commit()

    return {
        "collaboration_id": collaboration_id,
        "total_cost_cents": total_cost,
        "revenue_cents": revenue_cents,
        "roi_percent": roi_percent,
    }


async def get_influencer_report(influencer_id: int) -> dict:
    """Get full report on an influencer's performance."""
    async with db_connection() as db:
        # Get influencer info
        cursor = await db.execute(
            "SELECT * FROM influencers WHERE id = ?",
            (influencer_id,),
        )
        influencer = await cursor.fetchone()

        if not influencer:
            raise ValueError(f"Influencer {influencer_id} not found")

        # Get all collaborations
        cursor = await db.execute(
            """SELECT * FROM influencer_collaborations
               WHERE influencer_id = ?
               ORDER BY created_at DESC""",
            (influencer_id,),
        )
        collabs = [dict(r) for r in await cursor.fetchall()]

        # Calculate aggregate stats
        total_revenue = sum(c["revenue_attributed_cents"] or 0 for c in collabs)
        total_cost = sum((c["compensation_cents"] or 0) + (c["product_value_cents"] or 0) for c in collabs)
        avg_roi = sum(c["roi_percent"] or 0 for c in collabs) / len(collabs) if collabs else 0

    return {
        "influencer": dict(influencer),
        "collaborations_count": len(collabs),
        "total_revenue_cents": total_revenue,
        "total_cost_cents": total_cost,
        "avg_roi_percent": avg_roi,
        "collaborations": collabs,
    }


async def list_influencers(
    platform: str | None = None,
    niche: str | None = None,
    min_followers: int | None = None,
) -> list[dict]:
    """List influencers with optional filters."""
    conditions = []
    params = []

    if platform:
        conditions.append("platform = ?")
        params.append(platform)
    if niche:
        conditions.append("niche = ?")
        params.append(niche)
    if min_followers:
        conditions.append("follower_count >= ?")
        params.append(min_followers)

    conditions.append("is_active = TRUE")

    where = "WHERE " + " AND ".join(conditions)

    async with db_connection() as db:
        cursor = await db.execute(
            f"SELECT * FROM influencers {where} ORDER BY follower_count DESC NULLS LAST",
            params,
        )
        rows = await cursor.fetchall()

    return [dict(r) for r in rows]
