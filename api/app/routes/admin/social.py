"""Admin social media — persona and platform configuration."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import aiosqlite

from app.auth import require_admin
from app.database import get_db

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
