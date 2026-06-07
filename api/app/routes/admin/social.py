"""Admin social media — persona and platform configuration."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import aiosqlite

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
    status: str | None = None    # 'draft' | 'approved' | 'rejected'
    scheduled_at: str | None = None


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
