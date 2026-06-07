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
            content = await generate_social_post(source_prompt, platform)
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
