"""Admin social media — persona and platform configuration."""
from __future__ import annotations

import logging
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
import aiosqlite
import aiofiles

from app.auth import require_admin
from app.database import get_db
from app.services.social_publish_service import publish_post, PublishError
from app.services.token_refresh_service import refresh_expiring_tokens
from app.services.engagement_service import sync_all_engagement_metrics
from app.services.reply_service import generate_reply_draft, store_reply_draft, mark_reply_sent
from app.services.admin_audit import (
    log_post_published,
    log_draft_approved,
    log_persona_updated,
    log_agent_key_created,
    log_submission_reviewed,
    get_audit_log,
)
from app.services.sentiment_service import analyze_engagement_sentiment, batch_analyze_unprocessed, get_sentiment_trends

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/social", tags=["admin-social"])


# ── Pydantic models ──────────────────────────────────────────────────────────

class PersonaUpdate(BaseModel):
    name: str | None = None
    voice: str | None = None
    audience: str | None = None
    values_text: str | None = None
    words_to_use: str | None = None
    words_to_avoid: str | None = None


class PlatformUpdate(BaseModel):
    enabled: bool | None = None
    prompt_template: str | None = None
    hashtag_bank: str | None = None
    auto_publish: bool | None = None
    setup_status: str | None = None
    setup_notes: str | None = None
    account_id: str | None = None
    access_token: str | None = None


class OutboxPostUpdate(BaseModel):
    content: str | None = None
    status: str | None = None         # 'draft' | 'approved' | 'rejected' | 'scheduled'
    scheduled_at: str | None = None   # ISO-8601 UTC — set alongside status='scheduled'
    image_url: str | None = None      # override image from media library
    video_url: str | None = None      # phone upload or AI-generated video


# ── Persona endpoints ────────────────────────────────────────────────────────

@router.get("/persona")
async def get_persona(
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Return the active brand persona. Creates a default if none exists."""
    cursor = await db.execute(
        "SELECT * FROM brand_persona WHERE is_active = TRUE ORDER BY id DESC LIMIT 1"
    )
    row = await cursor.fetchone()
    if row:
        return dict(row)

    # First call — seed a default persona
    cursor = await db.execute(
        """INSERT INTO brand_persona (name, voice, audience, values_text, words_to_use, words_to_avoid, is_active)
           VALUES (?, ?, ?, ?, ?, ?, TRUE)""",
        ("Default", "", "", "", "", ""),
    )
    await db.commit()
    cursor = await db.execute("SELECT * FROM brand_persona WHERE id = ?", (cursor.lastrowid,))
    return dict(await cursor.fetchone())


@router.patch("/persona")
async def update_persona(
    body: PersonaUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Update the active brand persona. Creates one if none exists."""
    cursor = await db.execute(
        "SELECT id FROM brand_persona WHERE is_active = TRUE ORDER BY id DESC LIMIT 1"
    )
    row = await cursor.fetchone()

    if not row:
        await db.execute(
            """INSERT INTO brand_persona (name, voice, audience, values_text, words_to_use, words_to_avoid, is_active)
               VALUES (?, ?, ?, ?, ?, ?, TRUE)""",
            ("Default", "", "", "", "", ""),
        )
        await db.commit()
        cursor = await db.execute(
            "SELECT id FROM brand_persona WHERE is_active = TRUE ORDER BY id DESC LIMIT 1"
        )
        row = await cursor.fetchone()

    persona_id = row["id"]
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    set_parts = [f"{k} = ?" for k in updates]
    values = list(updates.values()) + [persona_id]
    await db.execute(
        f"UPDATE brand_persona SET {', '.join(set_parts)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        values,
    )
    await db.commit()
    return {"updated": True}


# ── Platform config endpoints ────────────────────────────────────────────────

@router.get("/platforms")
async def list_platforms(
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List all social platform configurations."""
    cursor = await db.execute(
        "SELECT id, platform, display_name, enabled, prompt_template, hashtag_bank, "
        "auto_publish, account_id, setup_status, setup_notes, created_at, updated_at "
        "FROM social_platform_configs ORDER BY id"
    )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.get("/platforms/{platform}")
async def get_platform(
    platform: str,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Get configuration for a single platform."""
    cursor = await db.execute(
        "SELECT id, platform, display_name, enabled, prompt_template, hashtag_bank, "
        "auto_publish, account_id, setup_status, setup_notes, created_at, updated_at "
        "FROM social_platform_configs WHERE platform = ?",
        (platform,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Platform '{platform}' not found")
    return dict(row)


@router.patch("/platforms/{platform}")
async def update_platform(
    platform: str,
    body: PlatformUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Update configuration for a platform. Tokens stored server-side only."""
    cursor = await db.execute(
        "SELECT id FROM social_platform_configs WHERE platform = ?", (platform,)
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Platform '{platform}' not found")

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    set_parts = [f"{k} = ?" for k in updates]
    values = list(updates.values()) + [platform]
    await db.execute(
        f"UPDATE social_platform_configs SET {', '.join(set_parts)}, updated_at = CURRENT_TIMESTAMP "
        f"WHERE platform = ?",
        values,
    )
    await db.commit()
    return {"updated": True}


# ── Outbox endpoints ─────────────────────────────────────────────────────────

@router.get("/outbox")
async def list_outbox(
    platform: str | None = None,
    post_status: str | None = None,
    page: int = 1,
    limit: int = 50,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List social post drafts in the outbox."""
    conditions = []
    params: list = []

    if platform:
        conditions.append("sp.platform = ?")
        params.append(platform)
    if post_status:
        conditions.append("sp.status = ?")
        params.append(post_status)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    offset = (page - 1) * limit

    cursor = await db.execute(f"SELECT COUNT(*) FROM social_posts sp {where}", params)
    total = (await cursor.fetchone())[0]

    cursor = await db.execute(
        f"""SELECT sp.*, p.title AS page_title, p.slug AS page_slug
            FROM social_posts sp
            LEFT JOIN pages p ON sp.page_id = p.id
            {where}
            ORDER BY sp.created_at DESC LIMIT ? OFFSET ?""",
        params + [limit, offset],
    )
    rows = await cursor.fetchall()
    return {"posts": [dict(r) for r in rows], "total": total, "page": page}


@router.get("/outbox/{post_id}")
async def get_outbox_post(
    post_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute(
        """SELECT sp.*, p.title AS page_title, p.slug AS page_slug
           FROM social_posts sp LEFT JOIN pages p ON sp.page_id = p.id
           WHERE sp.id = ?""",
        (post_id,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Post not found")
    return dict(row)


@router.patch("/outbox/{post_id}")
async def update_outbox_post(
    post_id: int,
    body: OutboxPostUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Edit content, approve, or reject a social draft."""
    cursor = await db.execute("SELECT id FROM social_posts WHERE id = ?", (post_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Post not found")

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    valid_statuses = {"draft", "approved", "rejected", "scheduled"}
    if "status" in updates and updates["status"] not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    set_parts = [f"{k} = ?" for k in updates]
    values = list(updates.values()) + [post_id]
    await db.execute(
        f"UPDATE social_posts SET {', '.join(set_parts)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        values,
    )
    await db.commit()
    return {"updated": True}


@router.delete("/outbox/{post_id}")
async def delete_outbox_post(
    post_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT id FROM social_posts WHERE id = ?", (post_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Post not found")
    await db.execute("DELETE FROM social_posts WHERE id = ?", (post_id,))
    await db.commit()
    return {"deleted": True}


@router.post("/outbox/{post_id}/publish")
async def publish_outbox_post(
    post_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Publish a social post to its platform via the platform's API.

    Facebook and Instagram are live. LinkedIn/TikTok/X return a clear
    'not yet implemented' error with no status change.
    """
    cursor = await db.execute("SELECT * FROM social_posts WHERE id = ?", (post_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Post not found")

    post = dict(row)
    if post["status"] not in ("draft", "approved", "failed"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot publish a post with status '{post['status']}'"
        )

    cursor = await db.execute(
        "SELECT enabled FROM social_platform_configs WHERE platform = ?",
        (post["platform"],),
    )
    platform_cfg = await cursor.fetchone()
    if not platform_cfg or not platform_cfg["enabled"]:
        raise HTTPException(status_code=400, detail=f"Platform '{post['platform']}' is not enabled")

    try:
        platform_post_id = await publish_post(
            platform=post["platform"],
            content=post["content"],
            image_url=post["image_url"],
            video_url=post.get("video_url"),
        )
    except PublishError as e:
        await db.execute(
            "UPDATE social_posts SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (str(e), post_id),
        )
        await db.commit()
        raise HTTPException(status_code=502, detail=str(e))

    await db.execute(
        """UPDATE social_posts
           SET status = 'published', platform_post_id = ?,
               published_at = CURRENT_TIMESTAMP, error_message = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?""",
        (platform_post_id, post_id),
    )
    await db.commit()

    logger.info(f"Published social post {post_id} to {post['platform']}: platform_post_id={platform_post_id}")

    # Audit log the publish action
    await log_post_published(
        admin_email=user.get("email", "unknown"),
        post_id=post_id,
        platform=post["platform"],
        content_preview=post["content"],
    )

    return {"published": True, "platform_post_id": platform_post_id}


# ── Token management ─────────────────────────────────────────────────────────

@router.post("/refresh-tokens")
async def manual_token_refresh(
    user: dict = Depends(require_admin),
):
    """Manually trigger Meta access token refresh check.

    Normally runs automatically on startup. Use this if a platform shows
    'error' status after a token expiry.
    """
    summary = await refresh_expiring_tokens()
    return summary


# ── Product → Social direct path ─────────────────────────────────────────────

class ProductSocialRequest(BaseModel):
    product_id: int
    platforms: list[str] | None = None   # None = all enabled platforms
    extra_context: str = ""              # optional extra prompt e.g. "it's on sale 20% off"


@router.post("/product-to-social")
async def generate_social_from_product(
    body: ProductSocialRequest,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Generate social post drafts directly from a product — no blog post needed.

    Fetches product name, description, price, and images then generates
    platform-native drafts for all enabled platforms (or the specified list).
    """
    from app.services.ai_service import generate_social_post

    cursor = await db.execute(
        "SELECT id, name, description, price_cents, images FROM products WHERE id = ?",
        (body.product_id,),
    )
    product = await cursor.fetchone()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    price = f"${product['price_cents'] / 100:.2f} CAD"
    source_prompt = (
        f"Product: {product['name']}\n"
        f"Price: {price}\n"
        f"Description: {product['description'] or ''}\n"
    )
    if body.extra_context:
        source_prompt += f"\nExtra context: {body.extra_context}"

    if body.platforms:
        platform_list = body.platforms
    else:
        cursor = await db.execute(
            "SELECT platform FROM social_platform_configs WHERE enabled = TRUE"
        )
        rows = await cursor.fetchall()
        platform_list = [r["platform"] for r in rows]

    if not platform_list:
        raise HTTPException(status_code=400, detail="No enabled platforms found")

    image_url = None
    if product["images"]:
        import json as _json
        try:
            imgs = _json.loads(product["images"])
            image_url = imgs[0] if imgs else None
        except Exception:
            pass

    created = []
    errors = []

    for platform in platform_list:
        try:
            from app.services.ai_router import AITaskType
            content = await generate_social_post(source_prompt, platform, task_type=AITaskType.PRODUCT_SOCIAL)
            cursor = await db.execute(
                """INSERT INTO social_posts
                   (product_id, platform, content, image_url, status)
                   VALUES (?, ?, ?, ?, 'draft')""",
                (body.product_id, platform, content, image_url),
            )
            await db.commit()
            created.append({"platform": platform, "id": cursor.lastrowid})
        except Exception as e:
            logger.error(f"Product→Social failed for {platform}: {e}")
            errors.append({"platform": platform, "error": str(e)})

    return {"created": created, "errors": errors}


# ── Video / media upload ──────────────────────────────────────────────────────

ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"}
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_VIDEO_MB = 200
MAX_IMAGE_MB = 20


@router.post("/media/upload")
async def upload_media(
    file: UploadFile = File(...),
    user: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Upload an image or video to the media library.

    Videos: MP4, MOV, WebM — max 200MB (phone uploads from clients)
    Images: JPEG, PNG, GIF, WebP — max 20MB

    Returns the media library record including the served URL.
    """
    content_type = file.content_type or ""
    is_video = content_type in ALLOWED_VIDEO_TYPES
    is_image = content_type in ALLOWED_IMAGE_TYPES

    if not is_video and not is_image:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{content_type}'. Allowed: MP4, MOV, WebM, JPEG, PNG, GIF, WebP",
        )

    max_mb = MAX_VIDEO_MB if is_video else MAX_IMAGE_MB
    data = await file.read()
    size_mb = len(data) / (1024 * 1024)
    if size_mb > max_mb:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f}MB). Max allowed: {max_mb}MB",
        )

    ext = (file.filename or "upload").rsplit(".", 1)[-1].lower()
    unique_name = f"{uuid.uuid4().hex}.{ext}"

    media_dir = "./data/uploads/media"
    os.makedirs(media_dir, exist_ok=True)
    file_path = os.path.join(media_dir, unique_name)

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(data)

    served_url = f"/media/library/{unique_name}"

    cursor = await db.execute(
        """INSERT INTO media_library
           (filename, original_name, mime_type, size_bytes, url)
           VALUES (?, ?, ?, ?, ?)""",
        (unique_name, file.filename or unique_name, content_type, len(data), served_url),
    )
    await db.commit()
    media_id = cursor.lastrowid

    logger.info(f"Media uploaded: id={media_id} type={content_type} size={size_mb:.1f}MB url={served_url}")
    return {
        "id": media_id,
        "url": served_url,
        "filename": unique_name,
        "original_name": file.filename,
        "mime_type": content_type,
        "size_bytes": len(data),
        "is_video": is_video,
    }


@router.get("/media")
async def list_media(
    page: int = 1,
    limit: int = 50,
    media_type: str | None = None,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List media library items. Filter by type: 'image' or 'video'."""
    conditions = []
    params: list = []

    if media_type == "image":
        conditions.append("mime_type LIKE 'image/%'")
    elif media_type == "video":
        conditions.append("mime_type LIKE 'video/%'")

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    offset = (page - 1) * limit

    cursor = await db.execute(f"SELECT COUNT(*) FROM media_library {where}", params)
    total = (await cursor.fetchone())[0]

    cursor = await db.execute(
        f"SELECT * FROM media_library {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        params + [limit, offset],
    )
    rows = await cursor.fetchall()
    return {"items": [dict(r) for r in rows], "total": total, "page": page}


# ── AI model config admin endpoints ──────────────────────────────────────────

class AIModelConfigUpdate(BaseModel):
    provider: str | None = None      # 'openai' | 'gemini' | 'auto'
    model: str | None = None         # e.g. 'gpt-4o-mini' — empty string = use default
    temperature: float | None = None
    max_tokens: int | None = None
    enabled: bool | None = None
    notes: str | None = None


@router.get("/ai-models")
async def list_ai_model_configs(
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List all AI task type model configurations with their current resolved model."""
    from app.services.ai_router import AITaskType, get_model_config

    cursor = await db.execute(
        "SELECT * FROM ai_model_configs ORDER BY task_type ASC"
    )
    rows = await cursor.fetchall()
    configs = [dict(r) for r in rows]

    resolved = []
    for cfg in configs:
        try:
            task = AITaskType(cfg["task_type"])
            live = await get_model_config(task)
            cfg["resolved_provider"] = live.provider
            cfg["resolved_model"] = live.model
            cfg["resolved_temperature"] = live.temperature
            cfg["resolved_max_tokens"] = live.max_tokens
        except Exception:
            cfg["resolved_provider"] = "unknown"
            cfg["resolved_model"] = "unknown"
        resolved.append(cfg)

    return {"configs": resolved}


@router.patch("/ai-models/{task_type}")
async def update_ai_model_config(
    task_type: str,
    body: AIModelConfigUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Override the model config for a specific task type.

    Set model='' to revert to the baked-in default for that task.
    Set provider='auto' to let the system pick based on available API keys.
    """
    cursor = await db.execute(
        "SELECT id FROM ai_model_configs WHERE task_type = ?", (task_type,)
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Task type '{task_type}' not found")

    updates: dict = {}
    if body.provider is not None:
        updates["provider"] = body.provider
    if body.model is not None:
        updates["model"] = body.model
    if body.temperature is not None:
        if not 0.0 <= body.temperature <= 2.0:
            raise HTTPException(status_code=400, detail="temperature must be between 0.0 and 2.0")
        updates["temperature"] = body.temperature
    if body.max_tokens is not None:
        if body.max_tokens < 1:
            raise HTTPException(status_code=400, detail="max_tokens must be >= 1")
        updates["max_tokens"] = body.max_tokens
    if body.enabled is not None:
        updates["enabled"] = body.enabled
    if body.notes is not None:
        updates["notes"] = body.notes

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updates["updated_at"] = "CURRENT_TIMESTAMP"
    set_clause = ", ".join(
        f"{k} = CURRENT_TIMESTAMP" if v == "CURRENT_TIMESTAMP" else f"{k} = ?"
        for k, v in updates.items()
    )
    values = [v for v in updates.values() if v != "CURRENT_TIMESTAMP"]
    values.append(task_type)

    await db.execute(
        f"UPDATE ai_model_configs SET {set_clause} WHERE task_type = ?",
        values,
    )
    await db.commit()

    cursor = await db.execute(
        "SELECT * FROM ai_model_configs WHERE task_type = ?", (task_type,)
    )
    updated = await cursor.fetchone()
    return dict(updated)


# ── Engagement metrics ───────────────────────────────────────────────────────

@router.post("/sync-engagement")
async def manual_sync_engagement(
    user: dict = Depends(require_admin),
):
    """Manually trigger engagement metrics sync from Meta.

    Runs automatically every 4 hours. Use this for on-demand refresh.
    """
    summary = await sync_all_engagement_metrics()
    return summary


@router.get("/engagement")
async def list_engagement_events(
    platform: str | None = None,
    replied: bool | None = None,
    page: int = 1,
    limit: int = 50,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List engagement events (comments, reactions, mentions) from webhooks.

    Filter by platform or replied status. Used for the AI reply workflow.
    """
    conditions = []
    params: list = []

    if platform:
        conditions.append("platform = ?")
        params.append(platform)
    if replied is True:
        conditions.append("replied_at IS NOT NULL")
    elif replied is False:
        conditions.append("replied_at IS NULL")

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    offset = (page - 1) * limit

    cursor = await db.execute(
        f"SELECT COUNT(*) FROM social_engagement_events {where}",
        params,
    )
    total = (await cursor.fetchone())[0]

    cursor = await db.execute(
        f"""SELECT e.*, sp.content as post_content
            FROM social_engagement_events e
            LEFT JOIN social_posts sp ON e.platform_post_id = sp.platform_post_id
            {where}
            ORDER BY e.created_at DESC
            LIMIT ? OFFSET ?""",
        params + [limit, offset],
    )
    rows = await cursor.fetchall()
    return {"events": [dict(r) for r in rows], "total": total, "page": page}


class GenerateReplyRequest(BaseModel):
    engagement_event_id: int


@router.post("/engagement/generate-reply")
async def generate_reply(
    body: GenerateReplyRequest,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Generate an AI reply draft for an engagement event.

    Uses brand persona + SOCIAL_REPLY task type (best model for tone).
    Stores the draft; admin must approve before sending.
    """
    cursor = await db.execute(
        "SELECT * FROM social_engagement_events WHERE id = ?",
        (body.engagement_event_id,),
    )
    event = await cursor.fetchone()
    if not event:
        raise HTTPException(status_code=404, detail="Engagement event not found")

    event = dict(event)

    cursor = await db.execute(
        "SELECT content FROM social_posts WHERE platform_post_id = ?",
        (event["platform_post_id"],),
    )
    post_row = await cursor.fetchone()
    post_context = post_row["content"] if post_row else None

    draft = await generate_reply_draft(
        original_comment=event.get("message") or event.get("raw_payload", "")[:500],
        commenter_name=event.get("actor_name", "there"),
        platform=event["platform"],
        post_context=post_context,
    )

    await store_reply_draft(body.engagement_event_id, draft)

    return {"reply_draft": draft, "engagement_event_id": body.engagement_event_id}


class SendReplyRequest(BaseModel):
    engagement_event_id: int
    reply_content: str | None = None  # if null, use the stored draft


@router.post("/engagement/send-reply")
async def send_reply(
    body: SendReplyRequest,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Send a reply to a social media comment.

    If reply_content is provided, uses that; otherwise uses the stored AI draft.
    Marks the engagement event as replied.

    Note: Actual Meta API reply publishing is Sprint 5.5 (requires comment_id + reply endpoint).
    For now, marks as replied in DB and logs for manual follow-up if API not ready.
    """
    cursor = await db.execute(
        "SELECT * FROM social_engagement_events WHERE id = ?",
        (body.engagement_event_id,),
    )
    event = await cursor.fetchone()
    if not event:
        raise HTTPException(status_code=404, detail="Engagement event not found")

    event = dict(event)

    content = body.reply_content or event.get("reply_content", "")
    if not content:
        raise HTTPException(status_code=400, detail="No reply content provided or stored")

    # TODO: Sprint 5.5 — call Meta API to publish reply
    # For now, mark as replied and log
    await mark_reply_sent(body.engagement_event_id, content)

    logger.info(f"Reply marked sent for engagement {body.engagement_event_id}")
    return {"sent": True, "reply_content": content}


# ── Content templates ────────────────────────────────────────────────────────

class ContentTemplateCreate(BaseModel):
    name: str
    template_type: str  # 'blog' | 'social_facebook' | 'social_instagram' | etc.
    prompt_template: str
    variables: str = ""  # comma-separated list


@router.get("/templates")
async def list_templates(
    template_type: str | None = None,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List content templates. Filter by type: 'blog', 'social_facebook', etc."""
    if template_type:
        cursor = await db.execute(
            "SELECT * FROM content_templates WHERE template_type = ? AND is_active = TRUE ORDER BY name",
            (template_type,),
        )
    else:
        cursor = await db.execute(
            "SELECT * FROM content_templates WHERE is_active = TRUE ORDER BY template_type, name"
        )
    rows = await cursor.fetchall()
    return {"templates": [dict(r) for r in rows]}


@router.post("/templates")
async def create_template(
    body: ContentTemplateCreate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Create a new content template."""
    cursor = await db.execute(
        """INSERT INTO content_templates
           (name, template_type, prompt_template, variables, created_by)
           VALUES (?, ?, ?, ?, ?)""",
        (body.name, body.template_type, body.prompt_template, body.variables, user.get("email", "admin")),
    )
    await db.commit()
    template_id = cursor.lastrowid
    return {"id": template_id, **body.dict()}


@router.post("/templates/{template_id}/generate")
async def generate_from_template(
    template_id: int,
    variables: dict,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Generate content using a template + provided variables.

    Variables dict keys must match the template's variables list.
    Returns generated content ready for review.
    """
    from app.services.ai_service import generate_blog_post, generate_social_post
    from app.services.ai_router import AITaskType

    cursor = await db.execute(
        "SELECT * FROM content_templates WHERE id = ? AND is_active = TRUE",
        (template_id,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")

    template = dict(row)

    # Substitute variables into prompt template
    prompt = template["prompt_template"]
    for key, value in variables.items():
        prompt = prompt.replace(f"{{{key}}}", str(value))

    # Track usage
    await db.execute(
        "UPDATE content_templates SET usage_count = usage_count + 1 WHERE id = ?",
        (template_id,),
    )
    await db.commit()

    # Generate based on type
    template_type = template["template_type"]
    if template_type == "blog":
        content = await generate_blog_post(prompt)
    elif template_type.startswith("social_"):
        platform = template_type.replace("social_", "")
        task_type = AITaskType.PRODUCT_SOCIAL if "product" in prompt.lower() else AITaskType.SOCIAL_CAPTION
        content = await generate_social_post(prompt, platform, task_type=task_type)
    else:
        content = await generate_blog_post(prompt)

    return {
        "content": content,
        "template_id": template_id,
        "template_name": template["name"],
        "prompt_used": prompt,
    }


# ── AI Agent Management ───────────────────────────────────────────────────────

class AgentKeyCreate(BaseModel):
    name: str
    scopes: list[str]  # e.g. ["read:engagement", "write:replies"]
    stores: list[str] | None = None  # empty = all stores
    rate_limit_rpm: int = 60


@router.post("/agents/keys")
async def create_agent_key_endpoint(
    body: AgentKeyCreate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Create a new agent API key. Returns the plain key — store it securely."""
    from app.auth_agent import create_agent_key

    valid_scopes = {
        "read:engagement", "write:replies", "read:metrics",
        "read:products", "read:persona", "write:drafts", "read:outbox",
    }
    invalid = set(body.scopes) - valid_scopes
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid scopes: {invalid}")

    plain_key, key_id = await create_agent_key(
        name=body.name,
        scopes=body.scopes,
        stores=body.stores or [],
        rate_limit_rpm=body.rate_limit_rpm,
        created_by=user.get("email", "admin"),
    )

    return {
        "key_id": key_id,
        "api_key": plain_key,  # ONLY returned once
        "name": body.name,
        "scopes": body.scopes,
        "warning": "Store this key securely — it will not be shown again",
    }


@router.get("/agents/keys")
async def list_agent_keys(
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List all agent API keys (hashes hidden, scopes visible)."""
    cursor = await db.execute(
        """SELECT id, name, scopes, stores, is_active, rate_limit_rpm,
                  last_used_at, created_by, created_at
           FROM agent_api_keys
           ORDER BY created_at DESC"""
    )
    rows = await cursor.fetchall()
    return {"keys": [dict(r) for r in rows]}


@router.post("/agents/keys/{key_id}/revoke")
async def revoke_agent_key_endpoint(
    key_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Revoke an agent API key."""
    from app.auth_agent import revoke_agent_key

    success = await revoke_agent_key(key_id)
    if not success:
        raise HTTPException(status_code=404, detail="Key not found")
    return {"revoked": True, "key_id": key_id}


@router.get("/agents/submissions")
async def list_agent_submissions(
    status: str | None = "pending",
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List agent content submissions for review."""
    if status:
        cursor = await db.execute(
            """SELECT s.*, a.name as agent_name
               FROM agent_content_submissions s
               JOIN agent_api_keys a ON s.agent_key_id = a.id
               WHERE s.status = ?
               ORDER BY s.created_at DESC""",
            (status,),
        )
    else:
        cursor = await db.execute(
            """SELECT s.*, a.name as agent_name
               FROM agent_content_submissions s
               JOIN agent_api_keys a ON s.agent_key_id = a.id
               ORDER BY s.created_at DESC"""
        )
    rows = await cursor.fetchall()
    return {"submissions": [dict(r) for r in rows]}


class SubmissionReview(BaseModel):
    decision: str  # 'approved' | 'rejected'
    notes: str = ""


@router.post("/agents/submissions/{submission_id}/review")
async def review_agent_submission(
    submission_id: int,
    body: SubmissionReview,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Approve or reject an agent content submission.

    If approved and it's a reply_draft: also need to send via Meta API (Sprint 5.5)
    If approved and it's a social_post_draft: create social_posts row
    """
    from datetime import datetime, timezone

    cursor = await db.execute(
        "SELECT * FROM agent_content_submissions WHERE id = ?",
        (submission_id,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Submission not found")

    submission = dict(row)

    await db.execute(
        """UPDATE agent_content_submissions
           SET status = ?, reviewed_by = ?, reviewed_at = ?, notes = ?
           WHERE id = ?""",
        (body.decision, user.get("email"), datetime.now(timezone.utc).isoformat(), body.notes, submission_id),
    )
    await db.commit()

    # If approved social draft, create actual social post
    created_post_id = None
    if body.decision == "approved" and submission["submission_type"] == "social_post_draft":
        cursor = await db.execute(
            """INSERT INTO social_posts (platform, content, status)
                VALUES (?, ?, 'draft')""",
            (submission.get("platform", "facebook"), submission["content"]),
        )
        await db.commit()
        created_post_id = cursor.lastrowid

    return {
        "reviewed": True,
        "decision": body.decision,
        "submission_id": submission_id,
        "created_post_id": created_post_id,
    }


@router.get("/agents/audit-log")
async def agent_audit_log(
    agent_id: int | None = None,
    limit: int = 100,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """View audit log of all agent actions."""
    if agent_id:
        cursor = await db.execute(
            """SELECT l.*, a.name as agent_name
               FROM agent_audit_log l
               JOIN agent_api_keys a ON l.agent_key_id = a.id
               WHERE l.agent_key_id = ?
               ORDER BY l.created_at DESC
               LIMIT ?""",
            (agent_id, limit),
        )
    else:
        cursor = await db.execute(
            """SELECT l.*, a.name as agent_name
               FROM agent_audit_log l
               JOIN agent_api_keys a ON l.agent_key_id = a.id
               ORDER BY l.created_at DESC
               LIMIT ?""",
            (limit,),
        )
    rows = await cursor.fetchall()
    return {"actions": [dict(r) for r in rows]}


# ── Admin Audit Log ──────────────────────────────────────────────────────────

@router.get("/audit-log")
async def admin_audit_log(
    admin_email: str | None = None,
    resource_type: str | None = None,
    action: str | None = None,
    since: str | None = None,
    limit: int = 100,
    user: dict = Depends(require_admin),
):
    """View admin audit log (who did what, when)."""
    logs = await get_audit_log(
        admin_email=admin_email,
        resource_type=resource_type,
        action=action,
        since=since,
        limit=limit,
    )
    return {"actions": logs}


# ── Crisis Management ──────────────────────────────────────────────────────────

@router.get("/crisis-alerts")
async def list_crisis_alerts(
    resolved: bool = False,
    severity: str | None = None,
    limit: int = 50,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List crisis alerts (viral negative content, spam attacks, etc.)."""
    conditions = ["is_resolved = ?"]
    params: list = [resolved]

    if severity:
        conditions.append("severity = ?")
        params.append(severity)

    where = "WHERE " + " AND ".join(conditions)

    cursor = await db.execute(
        f"""SELECT * FROM crisis_alerts
            {where}
            ORDER BY created_at DESC
            LIMIT ?""",
        params + [limit],
    )
    rows = await cursor.fetchall()
    return {"alerts": [dict(r) for r in rows], "count": len(rows)}


@router.post("/crisis-alerts/{alert_id}/resolve")
async def resolve_crisis_alert(
    alert_id: int,
    notes: str = "",
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Mark a crisis alert as resolved."""
    from datetime import datetime, timezone

    cursor = await db.execute(
        "SELECT id FROM crisis_alerts WHERE id = ?", (alert_id,)
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Alert not found")

    await db.execute(
        """UPDATE crisis_alerts
           SET is_resolved = TRUE, resolved_by = ?, resolved_at = ?, description = description || '\n\nResolution: ' || ?
           WHERE id = ?""",
        (user.get("email"), datetime.now(timezone.utc).isoformat(), notes, alert_id),
    )
    await db.commit()
    return {"resolved": True, "alert_id": alert_id}


# ── Sentiment Analysis ─────────────────────────────────────────────────────────

@router.post("/engagement/{event_id}/analyze-sentiment")
async def analyze_sentiment_endpoint(
    event_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Run AI sentiment analysis on an engagement event."""
    result = await analyze_engagement_sentiment(event_id)
    return result


@router.post("/engagement/batch-analyze-sentiment")
async def batch_analyze_sentiment(
    limit: int = 100,
    user: dict = Depends(require_admin),
):
    """Batch analyze sentiment for all unprocessed engagement events."""
    processed = await batch_analyze_unprocessed(limit=limit)
    return {"processed": processed}


@router.get("/sentiment-trends")
async def sentiment_trends(
    days: int = 7,
    user: dict = Depends(require_admin),
):
    """Get sentiment trends over time."""
    return await get_sentiment_trends(days=days)


# ── Revenue Attribution ───────────────────────────────────────────────────────

@router.get("/revenue-attribution")
async def get_revenue_attribution(
    post_id: int | None = None,
    since: str | None = None,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Get revenue attribution for social posts (UTM-based tracking)."""
    conditions = []
    params: list = []

    if post_id:
        conditions.append("social_post_id = ?")
        params.append(post_id)
    if since:
        conditions.append("sra.created_at >= ?")
        params.append(since)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    # Summary stats
    cursor = await db.execute(
        f"""SELECT
            COUNT(DISTINCT sra.social_post_id) as posts_with_revenue,
            COUNT(sra.id) as total_orders,
            SUM(sra.revenue_cents) / 100.0 as total_revenue,
            AVG(sra.revenue_cents) / 100.0 as avg_order_value
        FROM social_revenue_attribution sra
        {where}""",
        params,
    )
    summary = dict(await cursor.fetchone())

    # Top performing posts
    cursor = await db.execute(
        f"""SELECT
            sp.id, sp.platform, sp.content,
            SUM(sra.revenue_cents) / 100.0 as revenue,
            COUNT(sra.id) as orders
        FROM social_revenue_attribution sra
        JOIN social_posts sp ON sra.social_post_id = sp.id
        {where}
        GROUP BY sp.id
        ORDER BY revenue DESC
        LIMIT 20""",
        params,
    )
    top_posts = [dict(r) for r in await cursor.fetchall()]

    return {"summary": summary, "top_posts": top_posts}


# ── Sprint 7: Best-Time-to-Post ───────────────────────────────────────────────

@router.post("/optimal-times/calculate")
async def calculate_optimal_times_endpoint(
    platform: str | None = None,
    user: dict = Depends(require_admin),
):
    """Calculate optimal posting times from last 90 days of historical data."""
    from app.services.best_time_service import calculate_optimal_times
    result = await calculate_optimal_times(platform)
    return result


@router.get("/optimal-times/{platform}")
async def get_optimal_times(
    platform: str,
    limit: int = 5,
    min_confidence: float = 0.6,
    user: dict = Depends(require_admin),
):
    """Get recommended posting times for a platform."""
    from app.services.best_time_service import get_recommended_times
    slots = await get_recommended_times(platform, limit, min_confidence)
    return {"platform": platform, "recommended_slots": slots}


@router.get("/optimal-times/{platform}/suggest")
async def suggest_next_post_time_endpoint(
    platform: str,
    min_hours_ahead: int = 2,
    user: dict = Depends(require_admin),
):
    """Suggest the next optimal time to post on this platform."""
    from app.services.best_time_service import suggest_next_post_time
    suggestion = await suggest_next_post_time(platform, min_hours_ahead)
    return suggestion


# ── Sprint 7: A/B Testing ─────────────────────────────────────────────────────

class ABVariantCreate(BaseModel):
    variant_name: str
    content: str
    image_url: str | None = None


class ABTestCreate(BaseModel):
    name: str
    platform: str
    test_type: str = "headline"  # 'headline' | 'image' | 'cta' | 'time'
    variants: list[ABVariantCreate]
    metric_criteria: str = "engagement"  # 'engagement' | 'reach' | 'clicks' | 'revenue'
    duration_hours: int = 48


@router.post("/ab-tests")
async def create_ab_test_endpoint(
    body: ABTestCreate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Create an A/B test with variants. Variants get auto-scheduled at optimal times."""
    from app.services.ab_test_service import create_ab_test

    variants_data = [v.dict() for v in body.variants]
    result = await create_ab_test(
        name=body.name,
        platform=body.platform,
        test_type=body.test_type,
        variants=variants_data,
        metric_criteria=body.metric_criteria,
        duration_hours=body.duration_hours,
        created_by=user.get("email", "admin"),
    )
    return result


@router.post("/ab-tests/{test_id}/start")
async def start_ab_test_endpoint(
    test_id: int,
    user: dict = Depends(require_admin),
):
    """Start an A/B test (mark as running)."""
    from app.services.ab_test_service import start_ab_test
    result = await start_ab_test(test_id)
    return result


@router.get("/ab-tests/{test_id}")
async def get_ab_test_results(
    test_id: int,
    user: dict = Depends(require_admin),
):
    """Get A/B test results."""
    from app.services.ab_test_service import get_ab_test_results
    result = await get_ab_test_results(test_id)
    return result


@router.post("/ab-tests/{test_id}/refresh-metrics")
async def refresh_ab_test_metrics(
    test_id: int,
    user: dict = Depends(require_admin),
):
    """Pull latest metrics and recalculate scores."""
    from app.services.ab_test_service import update_variant_metrics
    result = await update_variant_metrics(test_id)
    return result


@router.post("/ab-tests/{test_id}/complete")
async def complete_ab_test_endpoint(
    test_id: int,
    user: dict = Depends(require_admin),
):
    """Complete an A/B test and declare winner."""
    from app.services.ab_test_service import complete_ab_test
    result = await complete_ab_test(test_id)
    return result


@router.get("/ab-tests")
async def list_ab_tests(
    status: str | None = None,
    limit: int = 50,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List A/B tests."""
    if status:
        cursor = await db.execute(
            "SELECT * FROM ab_tests WHERE status = ? ORDER BY created_at DESC LIMIT ?",
            (status, limit),
        )
    else:
        cursor = await db.execute(
            "SELECT * FROM ab_tests ORDER BY created_at DESC LIMIT ?",
            (limit,),
        )
    rows = await cursor.fetchall()
    return {"tests": [dict(r) for r in rows]}


# ── Sprint 7: Competitor Tracking ─────────────────────────────────────────────

class CompetitorCreate(BaseModel):
    name: str
    platform: str
    platform_handle: str
    profile_url: str | None = None
    notes: str = ""


class CompetitorPostCreate(BaseModel):
    platform_post_id: str
    content: str
    posted_at: str
    likes: int = 0
    comments: int = 0
    shares: int = 0
    follower_count: int | None = None


@router.post("/competitors")
async def add_competitor_endpoint(
    body: CompetitorCreate,
    user: dict = Depends(require_admin),
):
    """Add a competitor to track."""
    from app.services.competitor_service import add_competitor
    result = await add_competitor(
        name=body.name,
        platform=body.platform,
        platform_handle=body.platform_handle,
        profile_url=body.profile_url,
        notes=body.notes,
    )
    return result


@router.get("/competitors")
async def list_competitors_endpoint(
    platform: str | None = None,
    user: dict = Depends(require_admin),
):
    """List tracked competitors."""
    from app.services.competitor_service import list_competitors
    competitors = await list_competitors(platform)
    return {"competitors": competitors}


@router.get("/competitors/{competitor_id}/report")
async def get_competitor_report(
    competitor_id: int,
    days: int = 30,
    user: dict = Depends(require_admin),
):
    """Get competitive intelligence report for a competitor."""
    from app.services.competitor_service import get_competitor_report
    report = await get_competitor_report(competitor_id, days)
    return report


@router.post("/competitors/{competitor_id}/posts")
async def record_competitor_post_endpoint(
    competitor_id: int,
    body: CompetitorPostCreate,
    user: dict = Depends(require_admin),
):
    """Record a competitor's post for analysis."""
    from app.services.competitor_service import record_competitor_post
    result = await record_competitor_post(
        competitor_id=competitor_id,
        platform_post_id=body.platform_post_id,
        content=body.content,
        posted_at=body.posted_at,
        likes=body.likes,
        comments=body.comments,
        shares=body.shares,
        follower_count=body.follower_count,
    )
    return result


@router.post("/competitors/posts/{post_id}/analyze")
async def analyze_competitor_post_endpoint(
    post_id: int,
    user: dict = Depends(require_admin),
):
    """Use AI to analyze a competitor post and extract insights."""
    from app.services.competitor_service import analyze_competitor_post
    analysis = await analyze_competitor_post(post_id)
    return analysis


@router.get("/competitors/landscape/{platform}")
async def get_competitive_landscape(
    platform: str,
    user: dict = Depends(require_admin),
):
    """Get competitive landscape analysis for a platform."""
    from app.services.competitor_service import get_competitive_landscape
    landscape = await get_competitive_landscape(platform)
    return landscape
