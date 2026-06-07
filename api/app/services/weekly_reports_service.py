"""Automated weekly reports service.

Generates and sends weekly social media performance reports via email.

Report includes:
  - Posts published this week
  - Engagement metrics (likes, comments, shares)
  - Top performing posts
  - Sentiment trends
  - Crisis alerts
  - Revenue attribution
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone, timedelta

from app.database import db_connection

logger = logging.getLogger(__name__)


async def generate_weekly_report() -> dict:
    """Generate the weekly social media performance report."""
    # Get date range (last 7 days)
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=7)
    start_str = start.isoformat()
    end_str = end.isoformat()

    async with db_connection() as db:
        # Posts published this week
        cursor = await db.execute(
            """SELECT COUNT(*) as count,
                       SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
                       platform
                FROM social_posts
                WHERE created_at >= ? AND created_at <= ?
                GROUP BY platform""",
            (start_str, end_str),
        )
        posts_by_platform = {r["platform"]: {"total": r["count"], "published": r["published"]} for r in await cursor.fetchall()}

        # Engagement metrics
        cursor = await db.execute(
            """SELECT
                SUM(likes) as total_likes,
                SUM(comments_count) as total_comments,
                SUM(shares) as total_shares,
                SUM(reach) as total_reach,
                SUM(clicks) as total_clicks,
                AVG(CASE WHEN reach > 0 THEN (likes + comments_count + shares) * 1.0 / reach ELSE 0 END) as avg_engagement_rate
            FROM social_posts
            WHERE published_at >= ? AND published_at <= ?
            AND status = 'published'""",
            (start_str, end_str),
        )
        engagement = dict(await cursor.fetchone())

        # Top performing posts
        cursor = await db.execute(
            """SELECT id, platform, content, likes, comments_count, shares, reach
                FROM social_posts
                WHERE published_at >= ? AND published_at <= ?
                AND status = 'published'
                ORDER BY (likes + comments_count + shares) DESC
                LIMIT 5""",
            (start_str, end_str),
        )
        top_posts = [dict(r) for r in await cursor.fetchall()]

        # Sentiment trends
        cursor = await db.execute(
            """SELECT
                AVG(sentiment_score) as avg_sentiment,
                COUNT(*) as total_engagements,
                SUM(CASE WHEN sentiment_label = 'positive' THEN 1 ELSE 0 END) as positive,
                SUM(CASE WHEN sentiment_label = 'negative' THEN 1 ELSE 0 END) as negative
            FROM social_engagement_events
                WHERE created_at >= ? AND created_at <= ?
                AND sentiment_score IS NOT NULL""",
            (start_str, end_str),
        )
        sentiment = dict(await cursor.fetchone())

        # Crisis alerts this week
        cursor = await db.execute(
            """SELECT COUNT(*) as count,
                       SUM(CASE WHEN severity IN ('high', 'critical') THEN 1 ELSE 0 END) as serious
                FROM crisis_alerts
                WHERE created_at >= ? AND created_at <= ?""",
            (start_str, end_str),
        )
        crisis = dict(await cursor.fetchone())

        # Revenue attribution
        cursor = await db.execute(
            """SELECT
                COUNT(DISTINCT social_post_id) as posts_with_revenue,
                COUNT(*) as total_orders,
                SUM(revenue_cents) / 100.0 as total_revenue
            FROM social_revenue_attribution
            WHERE created_at >= ? AND created_at <= ?""",
            (start_str, end_str),
        )
        revenue = dict(await cursor.fetchone())

        # Pending items
        cursor = await db.execute(
            "SELECT COUNT(*) FROM social_posts WHERE status = 'draft'"
        )
        pending_posts = (await cursor.fetchone())[0]

        cursor = await db.execute(
            "SELECT COUNT(*) FROM agent_content_submissions WHERE status = 'pending'"
        )
        pending_agent = (await cursor.fetchone())[0]

        cursor = await db.execute(
            "SELECT COUNT(*) FROM influencer_submissions WHERE status = 'pending'"
        )
        pending_influencer = (await cursor.fetchone())[0]

    # Build report
    report = {
        "period": {
            "start": start_str[:10],
            "end": end_str[:10],
        },
        "summary": {
            "posts_by_platform": posts_by_platform,
            "total_engagement": {
                "likes": engagement.get("total_likes") or 0,
                "comments": engagement.get("total_comments") or 0,
                "shares": engagement.get("total_shares") or 0,
                "reach": engagement.get("total_reach") or 0,
                "clicks": engagement.get("total_clicks") or 0,
                "avg_engagement_rate": round(engagement.get("avg_engagement_rate") or 0, 4),
            },
            "sentiment": {
                "avg_score": round(sentiment.get("avg_sentiment") or 0, 2),
                "positive": sentiment.get("positive") or 0,
                "negative": sentiment.get("negative") or 0,
            },
            "crisis_alerts": {
                "total": crisis.get("count") or 0,
                "serious": crisis.get("serious") or 0,
            },
            "revenue": {
                "posts_with_sales": revenue.get("posts_with_revenue") or 0,
                "orders": revenue.get("total_orders") or 0,
                "total_revenue_usd": revenue.get("total_revenue") or 0,
            },
            "pending_review": {
                "draft_posts": pending_posts,
                "agent_submissions": pending_agent,
                "influencer_submissions": pending_influencer,
            },
        },
        "top_posts": top_posts,
    }

    return report


async def get_subscribers(report_type: str = "weekly_social") -> list[dict]:
    """Get active report subscribers."""
    async with db_connection() as db:
        cursor = await db.execute(
            """SELECT * FROM report_subscriptions
                WHERE report_type = ? AND is_active = TRUE""",
            (report_type,),
        )
        rows = await cursor.fetchall()

    return [dict(r) for r in rows]


async def mark_report_sent(subscription_id: int) -> None:
    """Mark a subscription as having been sent."""
    async with db_connection() as db:
        await db.execute(
            "UPDATE report_subscriptions SET last_sent_at = CURRENT_TIMESTAMP WHERE id = ?",
            (subscription_id,),
        )
        await db.commit()


async def subscribe_to_reports(
    email: str,
    report_type: str = "weekly_social",
    day_of_week: int = 0,  # Sunday default
) -> dict:
    """Subscribe to weekly reports."""
    async with db_connection() as db:
        cursor = await db.execute(
            """INSERT INTO report_subscriptions (email, report_type, day_of_week)
                VALUES (?, ?, ?)
                ON CONFLICT DO NOTHING
                RETURNING id""",
            (email, report_type, day_of_week),
        )
        row = await cursor.fetchone()
        await db.commit()

    if row:
        return {"subscribed": True, "subscription_id": row["id"]}
    return {"subscribed": False, "message": "Already subscribed or error"}


async def format_report_email(report: dict) -> tuple[str, str]:
    """Format report as (subject, html_body) for email."""
    subject = f"Weekly Social Media Report: {report['period']['start']} to {report['period']['end']}"

    summary = report["summary"]
    eng = summary["total_engagement"]
    rev = summary["revenue"]

    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px;">
        <h1>📊 Weekly Social Media Report</h1>
        <p><strong>Period:</strong> {report['period']['start']} to {report['period']['end']}</p>

        <h2>📈 Engagement Summary</h2>
        <ul>
            <li>👍 Likes: {eng['likes']:,}</li>
            <li>💬 Comments: {eng['comments']:,}</li>
            <li>🔄 Shares: {eng['shares']:,}</li>
            <li>👁️ Reach: {eng['reach']:,}</li>
            <li>🖱️ Clicks: {eng['clicks']:,}</li>
            <li>📊 Avg Engagement Rate: {eng['avg_engagement_rate']:.2%}</li>
        </ul>

        <h2>💰 Revenue</h2>
        <ul>
            <li>Posts with sales: {rev['posts_with_sales']}</li>
            <li>Orders: {rev['orders']:,}</li>
            <li>Revenue: ${rev['total_revenue_usd']:,.2f}</li>
        </ul>

        <h2>😊 Sentiment</h2>
        <ul>
            <li>Average Score: {summary['sentiment']['avg_score']:.2f}</li>
            <li>Positive: {summary['sentiment']['positive']}</li>
            <li>Negative: {summary['sentiment']['negative']}</li>
        </ul>

        <h2>⚠️ Crisis Alerts</h2>
        <p>{summary['crisis_alerts']['total']} total, {summary['crisis_alerts']['serious']} serious</p>

        <h2>⏳ Pending Review</h2>
        <ul>
            <li>Draft Posts: {summary['pending_review']['draft_posts']}</li>
            <li>Agent Submissions: {summary['pending_review']['agent_submissions']}</li>
            <li>Influencer Submissions: {summary['pending_review']['influencer_submissions']}</li>
        </ul>

        <p><em>This is an automated report from your Social Media Management Platform.</em></p>
    </body>
    </html>
    """

    return subject, html
