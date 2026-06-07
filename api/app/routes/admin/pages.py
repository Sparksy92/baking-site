"""Admin CMS / blog pages management."""
from __future__ import annotations

import asyncio
import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from app.database import PostgresConnection

from app.auth import require_admin
from app.database import get_db
from app.services.ai_service import generate_blog_post, generate_social_drafts_for_page
from app.services.meta_service import run_social_sync

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/pages", tags=["admin-pages"])


class PageCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    slug: str = Field(min_length=1, max_length=300)
    content_html: str = ""
    meta_title: str | None = None
    meta_description: str | None = None
    featured_image_url: str | None = None
    page_type: str = "page"  # 'page' | 'blog_post'
    status: str = "draft"
    author: str | None = None
    noindex: bool = False
    canonical_url: str | None = None

class GenerateAIPrompt(BaseModel):
    prompt: str = Field(min_length=5, max_length=1000)

class PageUpdate(BaseModel):
    title: str | None = None
    slug: str | None = None
    content_html: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    noindex: bool = False
    canonical_url: str | None = None
    featured_image_url: str | None = None
    page_type: str | None = None
    status: str | None = None
    author: str | None = None
    published_at: str | None = None


@router.get("")
async def list_pages(
    page_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List all pages (including drafts) for admin."""
    offset = (page - 1) * limit
    conditions = []
    params: list = []

    if page_type:
        conditions.append("page_type = ?")
        params.append(page_type)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    cursor = await db.execute(f"SELECT COUNT(*) FROM pages {where}", params)
    total = (await cursor.fetchone())[0]

    cursor = await db.execute(
        f"SELECT * FROM pages {where} ORDER BY updated_at DESC LIMIT ? OFFSET ?",
        params + [limit, offset],
    )
    rows = await cursor.fetchall()
    return {"pages": [dict(r) for r in rows], "total": total, "page": page}


@router.get("/{page_id}")
async def get_page(
    page_id: int,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT * FROM pages WHERE id = ?", (page_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    return dict(row)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_page(
    body: PageCreate,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    published_at = "CURRENT_TIMESTAMP" if body.status == "published" else None

    try:
        cursor = await db.execute(
            """INSERT INTO pages (title, slug, content_html, meta_title, meta_description,
                                 featured_image_url, page_type, status, author, noindex, canonical_url,
                                 published_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                       CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END)""",
            (body.title, body.slug, body.content_html, body.meta_title, body.meta_description,
             body.featured_image_url, body.page_type, body.status, body.author,
             body.noindex, body.canonical_url, body.status),
        )
        new_id = cursor.lastrowid
        await db.commit()
    except Exception:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already exists")

    if body.status == "published" and body.page_type == "blog_post":
        plain_text = body.content_html.replace("</p>", " ").replace("<br>", " ")
        plain_text = re.sub(r"<[^>]+>", "", plain_text).strip()
        asyncio.ensure_future(
            generate_social_drafts_for_page(new_id, body.title, plain_text, body.featured_image_url)
        )

    return {"id": new_id, "slug": body.slug}


@router.post("/generate-ai")
async def generate_ai_post(
    body: GenerateAIPrompt,
    user: dict = Depends(require_admin),
):
    try:
        content = await generate_blog_post(body.prompt)
        return {"content": content}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"AI Generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate AI content.")


@router.post("/sync-social")
async def sync_social(
    user: dict = Depends(require_admin),
):
    try:
        await run_social_sync()
        return {"success": True}
    except Exception as e:
        logger.error(f"Social sync failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync social media posts.")


@router.get("/{page_id}")
async def get_page(
    page_id: int,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT * FROM pages WHERE id = ?", (page_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    return dict(row)


@router.patch("/{page_id}")
async def update_page(
    page_id: int,
    body: PageUpdate,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT * FROM pages WHERE id = ?", (page_id,))
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    # Postgres handles booleans natively

    # Auto-set published_at when transitioning to published and no explicit date given
    if updates.get("status") == "published" and existing["status"] != "published" and "published_at" not in updates:
        updates["published_at"] = "__now__"

    set_parts = []
    values = []
    for k, v in updates.items():
        if k == "published_at" and v == "__now__":
            set_parts.append("published_at = CURRENT_TIMESTAMP")
        else:
            set_parts.append(f"{k} = ?")
            values.append(v)

    set_clause = ", ".join(set_parts)
    values.append(page_id)

    await db.execute(
        f"UPDATE pages SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?", values
    )
    await db.commit()

    if updates.get("status") == "published" and existing["status"] != "published" and existing["page_type"] == "blog_post":
        cursor = await db.execute("SELECT title, content_html, featured_image_url FROM pages WHERE id = ?", (page_id,))
        row = await cursor.fetchone()
        if row:
            plain_text = (row["content_html"] or "").replace("</p>", " ").replace("<br>", " ")
            plain_text = re.sub(r"<[^>]+>", "", plain_text).strip()
            asyncio.ensure_future(
                generate_social_drafts_for_page(page_id, row["title"], plain_text, row["featured_image_url"])
            )

    return {"updated": True}


@router.delete("/{page_id}")
async def delete_page(
    page_id: int,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT id FROM pages WHERE id = ?", (page_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")

    await db.execute("DELETE FROM pages WHERE id = ?", (page_id,))
    await db.commit()
    return {"deleted": True}
