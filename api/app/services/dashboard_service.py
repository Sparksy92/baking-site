"""Dashboard reporting service.

Provides comprehensive overview of the social media platform for:
  - Human admins (visual dashboard)
  - AI agents (structured data for decision-making)

Designed for small teams (1-3 people) + AI agents.
Single endpoint gives complete platform health snapshot.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from typing import Any

from app.database import db_connection


async def get_dashboard_overview(days: int = 7) -> dict:
    """Get complete platform overview for dashboard display.

    This is the single source of truth for "how are we doing?"
    Designed for small teams to get everything in one view.
    """
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    start_str = start.isoformat()

    async with db_connection() as db:
        # ── Content Pipeline Status ─────────────────────────────────────────────
        cursor = await db.execute(
            """SELECT
                COUNT(CASE WHEN status = 'draft' THEN 1 END) as drafts,
                COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled,
                COUNT(CASE WHEN status = 'pending_approval' THEN 1 END) as pending_approval,
                COUNT(CASE WHEN status = 'published' AND published_at >= ? THEN 1 END) as published_recent,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
            FROM social_posts""",
            (start_str,),
        )
        content_pipeline = dict(await cursor.fetchone())

        # ── Platform Breakdown ─────────────────────────────────────────────────
        cursor = await db.execute(
            """SELECT
                platform,
                COUNT(*) as posts,
                SUM(likes) as likes,
                SUM(comments_count) as comments,
                SUM(shares) as shares,
                SUM(reach) as reach
            FROM social_posts
            WHERE status = 'published'
            AND published_at >= ?
            GROUP BY platform""",
            (start_str,),
        )
        platform_stats = [dict(r) for r in await cursor.fetchall()]

        # ── Engagement Health ──────────────────────────────────────────────────
        cursor = await db.execute(
            """SELECT
                COUNT(*) as total_events,
                SUM(CASE WHEN sentiment_label = 'positive' THEN 1 ELSE 0 END) as positive,
                SUM(CASE WHEN sentiment_label = 'negative' THEN 1 ELSE 0 END) as negative,
                SUM(CASE WHEN sentiment_label = 'neutral' THEN 1 ELSE 0 END) as neutral,
                SUM(CASE WHEN replied_at IS NOT NULL THEN 1 ELSE 0 END) as replied,
                AVG(sentiment_score) as avg_sentiment
            FROM social_engagement_events
            WHERE created_at >= ?""",
            (start_str,),
        )
        engagement_health = dict(await cursor.fetchone())

        # ── Unreplied Engagement (needs attention) ─────────────────────────────
        cursor = await db.execute(
            """SELECT COUNT(*) as unreplied
            FROM social_engagement_events
            WHERE event_type = 'comment'
            AND replied_at IS NULL
            AND created_at >= ?
            AND is_ignored = FALSE""",
            (start_str,),
        )
        unreplied = (await cursor.fetchone())["unreplied"]

        # ── Crisis Status ──────────────────────────────────────────────────────
        cursor = await db.execute(
            """SELECT COUNT(*) as active_crisis,
                   MAX(created_at) as latest_crisis
            FROM crisis_alerts
            WHERE resolved_at IS NULL
            AND severity IN ('high', 'critical')"""
        )
        crisis = dict(await cursor.fetchone())

        # ── Revenue Attribution ────────────────────────────────────────────────
        cursor = await db.execute(
            """SELECT
                COUNT(DISTINCT social_post_id) as monetized_posts,
                COUNT(*) as attributed_orders,
                SUM(revenue_cents) / 100.0 as revenue_usd
            FROM social_revenue_attribution
            WHERE created_at >= ?""",
            (start_str,),
        )
        revenue = dict(await cursor.fetchone())

        # ── AI/Agent Activity ──────────────────────────────────────────────────
        cursor = await db.execute(
            """SELECT
                COUNT(*) as total_actions,
                COUNT(CASE WHEN action_type LIKE '%draft%' THEN 1 END) as drafts_created,
                COUNT(CASE WHEN action_type LIKE '%submit%' THEN 1 END) as submissions,
                COUNT(CASE WHEN action_type LIKE '%publish%' THEN 1 END) as auto_published
            FROM agent_audit_log
            WHERE created_at >= ?""",
            (start_str,),
        )
        agent_activity = dict(await cursor.fetchone())

        # ── Pending Reviews (human attention needed) ───────────────────────────
        cursor = await db.execute(
            "SELECT COUNT(*) FROM agent_content_submissions WHERE status = 'pending'"
        )
        pending_agent = (await cursor.fetchone())[0]

        cursor = await db.execute(
            "SELECT COUNT(*) FROM influencer_submissions WHERE status = 'pending'"
        )
        pending_influencer = (await cursor.fetchone())[0]

        # ── Active A/B Tests ───────────────────────────────────────────────────
        cursor = await db.execute(
            """SELECT
                COUNT(CASE WHEN status = 'running' THEN 1 END) as running,
                COUNT(CASE WHEN status = 'completed' AND winner_variant_id IS NOT NULL THEN 1 END) as completed_with_winner
            FROM ab_tests
            WHERE created_at >= ? OR status = 'running'""",
            (start_str,),
        )
        ab_tests = dict(await cursor.fetchone())

        # ── Optimal Times Next Slots ──────────────────────────────────────────
        cursor = await db.execute(
            """SELECT day_of_week, hour_of_day, avg_engagement, confidence
            FROM optimal_posting_times
            WHERE platform = 'instagram'
            AND confidence >= 0.6
            ORDER BY avg_engagement DESC
            LIMIT 3"""
        )
        top_slots = [dict(r) for r in await cursor.fetchall()]

        # ── Competitor Alerts ────────────────────────────────────────────────
        cursor = await db.execute(
            """SELECT COUNT(*) as threats
            FROM competitor_posts
            WHERE should_respond = TRUE
            AND posted_at >= ?""",
            (start_str,),
        )
        competitor_threats = (await cursor.fetchone())["threats"]

        # ── System Health ──────────────────────────────────────────────────────
        cursor = await db.execute(
            """SELECT COUNT(*) as total_keys,
                   SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_keys
            FROM agent_api_keys"""
        )
        api_keys = dict(await cursor.fetchone())

        # ── Top Performing Post ──────────────────────────────────────────────
        cursor = await db.execute(
            """SELECT id, platform, content, likes, comments_count, shares, reach
            FROM social_posts
            WHERE status = 'published'
            AND published_at >= ?
            ORDER BY (likes + comments_count + shares) DESC
            LIMIT 1""",
            (start_str,),
        )
        top_post = await cursor.fetchone()

    # ── Compile Dashboard ────────────────────────────────────────────────────
    dashboard = {
        "period": {
            "days": days,
            "start": start_str[:10],
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
            "competitor_threats": competitor_threats,
        },
        "content_pipeline": content_pipeline,
        "platform_performance": platform_stats,
        "engagement": {
            "total_events": engagement_health.get("total_events", 0),
            "sentiment_breakdown": {
                "positive": engagement_health.get("positive", 0),
                "neutral": engagement_health.get("neutral", 0),
                "negative": engagement_health.get("negative", 0),
            },
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
            "optimal_posting_slots": top_slots,
            "next_best_action": _recommend_next_action(
                unreplied, pending_agent, pending_influencer, crisis.get("active_crisis", 0)
            ),
        },
        "system": {
            "active_api_keys": api_keys.get("active_keys", 0),
            "top_post_this_week": dict(top_post) if top_post else None,
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
            f"{k}: {v}" for k, v in dashboard["attention_needed"].items() if v > 0
        ],
        "platform_performance": {
            p["platform"]: {
                "posts": p["posts"],
                "engagement": p["likes"] + p["comments"] + p["shares"],
            }
            for p in dashboard["platform_performance"]
        },
        "content_backlog": {
            "drafts_ready": dashboard["content_pipeline"]["drafts"],
            "scheduled": dashboard["content_pipeline"]["scheduled"],
            "needs_approval": dashboard["content_pipeline"]["pending_approval"],
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
