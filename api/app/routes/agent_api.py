"""Agent API — external AI agent integration boundary.

This module defines the clean API contract for AI agents to interact
with the commerce platform. All endpoints:
  - Require X-Agent-Key header authentication
  - Enforce scope-based permissions
  - Log all actions to agent_audit_log
  - Rate limited per agent
  - Return JSON with consistent envelope: {"data": ..., "meta": {...}}

Designed for autonomous agents managing multiple stores without
knowing internal data structures.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
import aiosqlite

from app.auth_agent import get_agent, require_agent_scope, AGENT_KEY_HEADER
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent/v1", tags=["agent-api"])


# ── Audit logging ───────────────────────────────────────────────────────────────

async def log_agent_action(
    db: aiosqlite.Connection,
    agent: dict,
    action: str,
    request: Request,
    response_status: int,
    resource_type: str = "",
    resource_id: str = "",
    payload: Any = None,
    duration_ms: int = 0,
) -> None:
    """Write an entry to agent_audit_log."""
    try:
        payload_str = json.dumps(payload, default=str)[:2000] if payload else None
        await db.execute(
            """INSERT INTO agent_audit_log
               (agent_key_id, action, resource_type, resource_id, request_payload,
                response_status, ip_address, user_agent, duration_ms)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                agent["id"],
                action,
                resource_type,
                str(resource_id) if resource_id else "",
                payload_str,
                response_status,
                request.client.host if request.client else None,
                request.headers.get("user-agent", "")[:200],
                duration_ms,
            ),
        )
        await db.commit()
    except Exception as e:
        logger.error(f"Failed to log agent action: {e}")


# ── Pydantic models ───────────────────────────────────────────────────────────

class ReplyDraftSubmission(BaseModel):
    engagement_event_id: int = Field(..., description="ID of the comment/event to reply to")
    draft_content: str = Field(..., min_length=1, max_length=2000, description="Proposed reply text")


class SocialDraftSubmission(BaseModel):
    platform: str = Field(..., description="facebook, instagram, linkedin, etc.")
    content: str = Field(..., min_length=10, max_length=2000)
    image_url: str | None = None
    video_url: str | None = None
    context: str = Field(default="", description="Why the agent thinks this post is relevant")


class MetricsQuery(BaseModel):
    platform: str | None = None
    since: str | None = Field(default=None, description="ISO-8601 date for filtering")
    limit: int = Field(default=50, ge=1, le=100)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/health")
async def agent_health():
    """Health check for agents — no auth required."""
    return {"status": "ok", "version": "1.0.0"}


@router.get("/engagement/unreplied")
@require_agent_scope("read:engagement")
async def list_unreplied_engagement(
    request: Request,
    platform: str | None = None,
    limit: int = 20,
    agent: dict = Depends(get_agent),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Get unreplied engagement events (comments, mentions) for agent to process.

    Returns events newest first. Agent should pick one, generate reply, submit draft.
    """
    start_time = datetime.now(timezone.utc)

    conditions = ["replied_at IS NULL"]
    params: list = []

    if platform:
        conditions.append("platform = ?")
        params.append(platform)

    where = "WHERE " + " AND ".join(conditions)

    cursor = await db.execute(
        f"""SELECT id, platform, platform_post_id, event_type, actor_name,
                   message, raw_payload, created_at
            FROM social_engagement_events
            {where}
            ORDER BY created_at DESC
            LIMIT ?""",
        params + [limit],
    )
    rows = await cursor.fetchall()
    events = [dict(r) for r in rows]

    duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
    await log_agent_action(
        db, agent, "read_engagement", request, 200,
        resource_type="engagement_event", payload={"platform": platform, "count": len(events)},
        duration_ms=duration_ms,
    )

    return {
        "data": events,
        "meta": {"count": len(events), "platform": platform},
    }


@router.post("/engagement/reply-draft")
@require_agent_scope("write:replies")
async def submit_reply_draft(
    body: ReplyDraftSubmission,
    request: Request,
    agent: dict = Depends(get_agent),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Submit a reply draft for admin approval.

    The draft goes to agent_content_submissions with status='pending'.
    Admin reviews in the engagement UI and approves/rejects.
    """
    start_time = datetime.now(timezone.utc)

    # Verify engagement event exists
    cursor = await db.execute(
        "SELECT id FROM social_engagement_events WHERE id = ?",
        (body.engagement_event_id,),
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Engagement event not found")

    # Store submission
    context = {
        "engagement_event_id": body.engagement_event_id,
        "submitted_by_agent": agent["name"],
    }
    cursor = await db.execute(
        """INSERT INTO agent_content_submissions
           (agent_key_id, submission_type, content, context_json, status)
           VALUES (?, ?, ?, ?, 'pending')""",
        (agent["id"], "reply_draft", body.draft_content, json.dumps(context)),
    )
    await db.commit()
    submission_id = cursor.lastrowid

    duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
    await log_agent_action(
        db, agent, "submit_reply_draft", request, 201,
        resource_type="agent_content_submissions", resource_id=submission_id,
        payload=body.dict(), duration_ms=duration_ms,
    )

    return {
        "data": {"submission_id": submission_id, "status": "pending"},
        "meta": {"review_url": f"/admin/agent-submissions/{submission_id}"},
    }


@router.get("/metrics/posts")
@require_agent_scope("read:metrics")
async def get_post_metrics(
    request: Request,
    platform: str | None = None,
    since: str | None = None,
    limit: int = 50,
    agent: dict = Depends(get_agent),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Get performance metrics for published posts.

    Agents use this to learn what content performs well.
    """
    start_time = datetime.now(timezone.utc)

    conditions = ["status = 'published'", "platform_post_id IS NOT NULL"]
    params: list = []

    if platform:
        conditions.append("platform = ?")
        params.append(platform)
    if since:
        conditions.append("published_at >= ?")
        params.append(since)

    where = "WHERE " + " AND ".join(conditions)

    cursor = await db.execute(
        f"""SELECT id, platform, content, published_at,
                   reach, impressions, likes, comments_count, shares, clicks,
                   product_id, page_id
            FROM social_posts
            {where}
            ORDER BY published_at DESC
            LIMIT ?""",
        params + [limit],
    )
    rows = await cursor.fetchall()
    metrics = [dict(r) for r in rows]

    duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
    await log_agent_action(
        db, agent, "read_metrics", request, 200,
        resource_type="social_posts", payload={"count": len(metrics)},
        duration_ms=duration_ms,
    )

    return {"data": metrics, "meta": {"count": len(metrics)}}


@router.get("/products")
@require_agent_scope("read:products")
async def list_products(
    request: Request,
    page: int = 1,
    limit: int = 50,
    agent: dict = Depends(get_agent),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Get product catalog for agent context.

    Agents use this to understand what's available to promote.
    """
    start_time = datetime.now(timezone.utc)
    offset = (page - 1) * limit

    cursor = await db.execute(
        "SELECT COUNT(*) FROM products WHERE is_active = TRUE"
    )
    total = (await cursor.fetchone())[0]

    cursor = await db.execute(
        """SELECT id, slug, name, description, price_cents, images, tags
            FROM products
            WHERE is_active = TRUE
            ORDER BY id DESC
            LIMIT ? OFFSET ?""",
        (limit, offset),
    )
    rows = await cursor.fetchall()
    products = [dict(r) for r in rows]

    duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
    await log_agent_action(
        db, agent, "read_products", request, 200,
        resource_type="products", payload={"page": page, "count": len(products)},
        duration_ms=duration_ms,
    )

    return {"data": products, "meta": {"total": total, "page": page, "limit": limit}}


@router.get("/persona")
@require_agent_scope("read:persona")
async def get_persona(
    request: Request,
    agent: dict = Depends(get_agent),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Get the active brand persona.

    Agents use this to match voice/tone in generated content.
    """
    start_time = datetime.now(timezone.utc)

    cursor = await db.execute(
        "SELECT * FROM brand_persona WHERE is_active = TRUE ORDER BY id DESC LIMIT 1"
    )
    row = await cursor.fetchone()
    persona = dict(row) if row else {}

    duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
    await log_agent_action(
        db, agent, "read_persona", request, 200,
        resource_type="brand_persona", duration_ms=duration_ms,
    )

    return {"data": persona, "meta": {}}


@router.post("/drafts/social")
@require_agent_scope("write:drafts")
async def submit_social_draft(
    body: SocialDraftSubmission,
    request: Request,
    agent: dict = Depends(get_agent),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Submit a social post draft for admin approval.

    Agent suggests content, admin reviews and schedules/publishes.
    """
    start_time = datetime.now(timezone.utc)

    context = {
        "platform": body.platform,
        "agent_context": body.context,
        "has_media": bool(body.image_url or body.video_url),
    }

    cursor = await db.execute(
        """INSERT INTO agent_content_submissions
           (agent_key_id, submission_type, platform, content, context_json, status)
           VALUES (?, ?, ?, ?, ?, 'pending')""",
        (agent["id"], "social_post_draft", body.platform, body.content, json.dumps(context)),
    )
    await db.commit()
    submission_id = cursor.lastrowid

    duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
    await log_agent_action(
        db, agent, "submit_social_draft", request, 201,
        resource_type="agent_content_submissions", resource_id=submission_id,
        payload=body.dict(exclude_none=True), duration_ms=duration_ms,
    )

    return {
        "data": {"submission_id": submission_id, "status": "pending"},
        "meta": {"review_url": f"/admin/agent-submissions/{submission_id}"},
    }


@router.get("/outbox/status")
@require_agent_scope("read:outbox")
async def outbox_status(
    request: Request,
    agent: dict = Depends(get_agent),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Get current outbox status counts for agent awareness."""
    start_time = datetime.now(timezone.utc)

    cursor = await db.execute(
        """SELECT status, COUNT(*) as cnt
            FROM social_posts
            GROUP BY status"""
    )
    rows = await cursor.fetchall()
    status_counts = {r["status"]: r["cnt"] for r in rows}

    cursor = await db.execute(
        """SELECT COUNT(*) as cnt FROM agent_content_submissions
            WHERE status = 'pending'"""
    )
    pending_agent = (await cursor.fetchone())[0]

    duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
    await log_agent_action(
        db, agent, "read_outbox_status", request, 200,
        duration_ms=duration_ms,
    )

    return {
        "data": {
            "social_posts_by_status": status_counts,
            "pending_agent_submissions": pending_agent,
        },
        "meta": {},
    }
