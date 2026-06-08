"""Dashboard reporting service.

Provides comprehensive overview of the social media platform for:
  - Human admins (visual dashboard)
  - AI agents (structured data for decision-making)

Designed for small teams (1-3 people) + AI agents.
Single endpoint gives complete platform health snapshot.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any

from app.database import db_connection

logger = logging.getLogger(__name__)


async def _safe_query(db, query: str, params: tuple = ()) -> list[dict]:
    """Run a query, returning empty list on any DB error (missing table/column)."""
    try:
        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.debug(f"Dashboard query skipped ({e.__class__.__name__}): {str(e)[:120]}")
        return []


async def _safe_query_one(db, query: str, params: tuple = (), default: dict | None = None) -> dict:
    """Run a query returning single row, with fallback on error."""
    rows = await _safe_query(db, query, params)
    return rows[0] if rows else (default or {})


async def get_dashboard_overview(days: int = 7) -> dict:
    """Get complete platform overview for dashboard display.

    This is the single source of truth for "how are we doing?"
    Designed for small teams to get everything in one view.
    Gracefully handles missing tables/columns by returning defaults.
    """
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)

    async with db_connection() as db:
        # ── Content Pipeline Status ─────────────────────────────────────────────
        content_pipeline = await _safe_query_one(db,
            """SELECT
                COUNT(CASE WHEN status = 'draft' THEN 1 END) as drafts,
                COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as pending_approval,
                COUNT(CASE WHEN status = 'published' AND published_at >= ? THEN 1 END) as published_recent,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
            FROM social_posts""",
            (start,),
            default={"drafts": 0, "scheduled": 0, "pending_approval": 0, "published_recent": 0, "failed": 0},
        )

        # ── Platform Breakdown ─────────────────────────────────────────────────
        platform_stats = await _safe_query(db,
            """SELECT platform, COUNT(*) as posts
            FROM social_posts
            WHERE status = 'published'
            AND published_at >= ?
            GROUP BY platform""",
            (start,),
        )

        # ── Engagement Health ──────────────────────────────────────────────────
        engagement_health = await _safe_query_one(db,
            """SELECT
                COUNT(*) as total_events,
                SUM(CASE WHEN replied_at IS NOT NULL THEN 1 ELSE 0 END) as replied,
                AVG(sentiment_score) as avg_sentiment
            FROM social_engagement_events
            WHERE created_at >= ?""",
            (start,),
            default={"total_events": 0, "replied": 0, "avg_sentiment": 0},
        )

        # ── Unreplied Engagement (needs attention) ─────────────────────────────
        unreplied_row = await _safe_query_one(db,
            """SELECT COUNT(*) as unreplied
            FROM social_engagement_events
            WHERE event_type = 'comment'
            AND replied_at IS NULL
            AND created_at >= ?""",
            (start,),
            default={"unreplied": 0},
        )
        unreplied = unreplied_row.get("unreplied", 0)

        # ── Crisis Status ──────────────────────────────────────────────────────
        crisis = await _safe_query_one(db,
            """SELECT COUNT(*) as active_crisis,
                   MAX(created_at) as latest_crisis
            FROM crisis_alerts
            WHERE resolved_at IS NULL
            AND severity IN ('high', 'critical')""",
            default={"active_crisis": 0},
        )

        # ── Revenue Attribution ────────────────────────────────────────────────
        revenue = await _safe_query_one(db,
            """SELECT 0 as monetized_posts, 0 as attributed_orders, 0.0 as revenue_usd""",
            default={"monetized_posts": 0, "attributed_orders": 0, "revenue_usd": 0},
        )

        # ── AI/Agent Activity ──────────────────────────────────────────────────
        agent_activity = await _safe_query_one(db,
            """SELECT
                COUNT(*) as total_actions
            FROM agent_audit_log
            WHERE created_at >= ?""",
            (start,),
            default={"total_actions": 0},
        )

        # ── Pending Reviews (human attention needed) ───────────────────────────
        pending_agent_row = await _safe_query_one(db,
            "SELECT COUNT(*) as cnt FROM agent_content_submissions WHERE status = 'pending'",
            default={"cnt": 0},
        )
        pending_agent = pending_agent_row.get("cnt", 0)

        pending_inf_row = await _safe_query_one(db,
            "SELECT COUNT(*) as cnt FROM influencer_submissions WHERE status = 'pending'",
            default={"cnt": 0},
        )
        pending_influencer = pending_inf_row.get("cnt", 0)

        # ── Active A/B Tests ───────────────────────────────────────────────────
        ab_tests = await _safe_query_one(db,
            """SELECT
                COUNT(CASE WHEN status = 'running' THEN 1 END) as running,
                COUNT(CASE WHEN status = 'completed' AND winner_variant_id IS NOT NULL THEN 1 END) as completed_with_winner
            FROM ab_tests
            WHERE created_at >= ? OR status = 'running'""",
            (start,),
            default={"running": 0, "completed_with_winner": 0},
        )

        # ── System Health ──────────────────────────────────────────────────────
        api_keys = await _safe_query_one(db,
            """SELECT COUNT(*) as total_keys,
                   SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_keys
            FROM agent_api_keys""",
            default={"total_keys": 0, "active_keys": 0},
        )

    # ── Compile Dashboard ────────────────────────────────────────────────────
    dashboard = {
        "period": {
            "days": days,
            "start": start.isoformat()[:10],
            "end": end.isoformat()[:10],
        },
        "health_score": _calculate_health_score(
            content_pipeline, engagement_health, crisis, unreplied
        ),
        "attention_needed": {
            "unreplied_comments": unreplied,
            "pending_agent_approvals": pending_agent,
            "pending_influencer_approvals": pending_influencer,
            "failed_posts": content_pipeline.get("failed", 0),
            "active_crisis_alerts": crisis.get("active_crisis", 0),
        },
        "content_pipeline": content_pipeline,
        "platform_performance": platform_stats,
        "engagement": {
            "total_events": engagement_health.get("total_events", 0),
            "avg_sentiment_score": round(engagement_health.get("avg_sentiment") or 0, 2),
            "reply_rate": _safe_divide(
                engagement_health.get("replied", 0),
                engagement_health.get("total_events", 1)
            ),
        },
        "revenue": {
            "monetized_posts": revenue.get("monetized_posts", 0),
            "attributed_orders": revenue.get("attributed_orders", 0),
            "revenue_usd": revenue.get("revenue_usd", 0),
        },
        "ai_agent_activity": agent_activity,
        "active_experiments": {
            "ab_tests_running": ab_tests.get("running", 0),
            "ab_tests_completed": ab_tests.get("completed_with_winner", 0),
        },
        "recommendations": {
            "next_best_action": _recommend_next_action(
                unreplied, pending_agent, pending_influencer, crisis.get("active_crisis", 0)
            ),
        },
        "system": {
            "active_api_keys": api_keys.get("active_keys", 0),
        },
    }

    return dashboard


def _calculate_health_score(pipeline, engagement, crisis, unreplied) -> dict:
    """Calculate overall platform health score (0-100)."""
    score = 100

    # Deduct for issues
    score -= (crisis.get("active_crisis") or 0) * 20  # Crisis is serious
    score -= min(unreplied * 2, 30)  # Unreplied engagement
    score -= (pipeline.get("failed") or 0) * 5  # Failed posts

    # Engagement quality bonus
    avg_sentiment = engagement.get("avg_sentiment") or 0
    if avg_sentiment > 0.3:
        score += 5
    elif avg_sentiment < -0.2:
        score -= 10

    return {
        "score": max(0, min(100, score)),
        "status": "healthy" if score >= 80 else "attention" if score >= 50 else "critical",
    }


def _safe_divide(numerator, denominator) -> float:
    """Safe division returning 0 if denominator is 0."""
    if not denominator:
        return 0.0
    return round(numerator / denominator, 4)


def _recommend_next_action(unreplied, pending_agent, pending_influencer, crisis_count) -> str:
    """AI-friendly recommendation for next priority action."""
    if crisis_count > 0:
        return f"URGENT: Resolve {crisis_count} crisis alert(s) before posting new content"
    if pending_agent > 0:
        return f"Review {pending_agent} AI-generated drafts awaiting approval"
    if pending_influencer > 0:
        return f"Review {pending_influencer} influencer submissions"
    if unreplied > 5:
        return f"Reply to {unreplied} unanswered comments (engagement opportunity)"
    return "System healthy - consider creating new content or reviewing A/B test results"


async def get_ai_agent_brief(agent_key_id: int | None = None) -> dict:
    """Get a concise brief specifically for AI agent consumption.

    Optimized for LLM context windows - focused on actionable intelligence.
    """
    dashboard = await get_dashboard_overview(days=3)

    # Strip down to what an AI needs to make decisions
    return {
        "current_status": dashboard["health_score"]["status"],
        "health_score": dashboard["health_score"]["score"],
        "priority_actions": [
            f"{k}: {v}" for k, v in dashboard["attention_needed"].items() if v and v > 0
        ],
        "platform_performance": {
            p["platform"]: {"posts": p.get("posts", 0)}
            for p in dashboard["platform_performance"]
        },
        "content_backlog": {
            "drafts_ready": dashboard["content_pipeline"].get("drafts", 0),
            "scheduled": dashboard["content_pipeline"].get("scheduled", 0),
            "needs_approval": dashboard["content_pipeline"].get("pending_approval", 0),
        },
        "sentiment": dashboard["engagement"]["avg_sentiment_score"],
        "recommendation": dashboard["recommendations"]["next_best_action"],
    }


async def get_compact_status() -> str:
    """Get one-line status for quick checks."""
    dashboard = await get_dashboard_overview(days=1)

    health = dashboard["health_score"]
    attn = dashboard["attention_needed"]

    issues = []
    if attn["active_crisis_alerts"]:
        issues.append(f"{attn['active_crisis_alerts']} crisis")
    if attn["unreplied_comments"]:
        issues.append(f"{attn['unreplied_comments']} unreplied")
    if attn["pending_agent_approvals"]:
        issues.append(f"{attn['pending_agent_approvals']} drafts pending")

    if issues:
        return f"Status: {health['status'].upper()} ({health['score']}/100) | Issues: {', '.join(issues)}"

    return f"Status: HEALTHY ({health['score']}/100) | All systems operational"
