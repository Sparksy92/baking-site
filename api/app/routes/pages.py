"""Public blog / CMS pages endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
import aiosqlite

from app.database import get_db

router = APIRouter(prefix="/pages", tags=["pages"])


@router.get("")
async def list_pages(
    page_type: str = Query("page"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List published pages or blog posts."""
    offset = (page - 1) * limit
    cursor = await db.execute(
        "SELECT COUNT(*) FROM pages WHERE page_type = ? AND status = 'published'",
        (page_type,),
    )
    total = (await cursor.fetchone())[0]

    cursor = await db.execute(
        """SELECT * FROM pages WHERE page_type = ? AND status = 'published'
           ORDER BY published_at DESC LIMIT ? OFFSET ?""",
        (page_type, limit, offset),
    )
    rows = await cursor.fetchall()
    return {"pages": [dict(r) for r in rows], "total": total, "page": page}


@router.get("/{slug}")
async def get_page(slug: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a single published page by slug."""
    cursor = await db.execute(
        "SELECT * FROM pages WHERE slug = ? AND status = 'published'", (slug,)
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    return dict(row)
