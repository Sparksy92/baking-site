"""Admin CMS / blog pages management."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
import aiosqlite

from app.auth import require_admin
from app.database import get_db

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


class PageUpdate(BaseModel):
    title: str | None = None
    slug: str | None = None
    content_html: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    featured_image_url: str | None = None
    status: str | None = None
    author: str | None = None


@router.get("")
async def list_pages(
    page_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: aiosqlite.Connection = Depends(get_db),
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
    db: aiosqlite.Connection = Depends(get_db),
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
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    published_at = "CURRENT_TIMESTAMP" if body.status == "published" else None

    try:
        cursor = await db.execute(
            """INSERT INTO pages (title, slug, content_html, meta_title, meta_description,
                                 featured_image_url, page_type, status, author, published_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,
                       CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END)""",
            (body.title, body.slug, body.content_html, body.meta_title, body.meta_description,
             body.featured_image_url, body.page_type, body.status, body.author, body.status),
        )
        await db.commit()
    except aiosqlite.IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already exists")

    return {"id": cursor.lastrowid, "slug": body.slug}


@router.patch("/{page_id}")
async def update_page(
    page_id: int,
    body: PageUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT * FROM pages WHERE id = ?", (page_id,))
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    # Set published_at if transitioning to published
    if updates.get("status") == "published" and existing["status"] != "published":
        updates["published_at"] = None  # handled below

    set_parts = []
    values = []
    for k, v in updates.items():
        if k == "published_at":
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
    return {"updated": True}


@router.delete("/{page_id}")
async def delete_page(
    page_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT id FROM pages WHERE id = ?", (page_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")

    await db.execute("DELETE FROM pages WHERE id = ?", (page_id,))
    await db.commit()
    return {"deleted": True}
