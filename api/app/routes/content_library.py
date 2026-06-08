"""API routes for content library and evergreen recycling."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional

from app.auth import require_admin
from app.database import get_db, db_connection
import aiosqlite

from app.services.content_library_service import (
    add_to_library,
    get_recyclable_content,
    get_category_mix_status,
    auto_schedule_recycled_content,
    get_top_performing_content,
    promote_post_to_library,
    suggest_next_category,
    CONTENT_CATEGORIES,
)

router = APIRouter(prefix="/admin/content-library", tags=["content-library"])


class LibraryContentCreate(BaseModel):
    content: str
    category: str = Field(..., description=f"One of: {list(CONTENT_CATEGORIES.keys())}")
    platform: str
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    max_uses: int = 10
    min_days_between: int = 30


class LibraryContentUpdate(BaseModel):
    is_approved: Optional[bool] = None
    max_uses: Optional[int] = None
    category: Optional[str] = None


@router.post("/content")
async def create_library_content(
    data: LibraryContentCreate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Add content to the evergreen library."""
    result = await add_to_library(
        content=data.content,
        category=data.category,
        platform=data.platform,
        image_url=data.image_url,
        video_url=data.video_url,
        approved=True,  # Admin created = auto-approved
        max_uses=data.max_uses,
        min_days_between=data.min_days_between,
    )
    return result


@router.get("/content")
async def list_library_content(
    platform: Optional[str] = None,
    category: Optional[str] = None,
    approved_only: bool = True,
    limit: int = 50,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List content library entries."""
    async with db_connection() as conn:
        query = """SELECT * FROM content_library WHERE 1=1"""
        params = []
        
        if platform:
            query += " AND platform = ?"
            params.append(platform)
        if category:
            query += " AND category = ?"
            params.append(category)
        if approved_only:
            query += " AND is_approved = TRUE"
        
        query += " ORDER BY times_used ASC, created_at DESC LIMIT ?"
        params.append(limit)
        
        cursor = await conn.execute(query, params)
        rows = await cursor.fetchall()
        
    return {"content": [dict(r) for r in rows]}


@router.get("/recyclable")
async def get_recyclable(
    platform: str,
    category: Optional[str] = None,
    limit: int = 10,
    user: dict = Depends(require_admin),
):
    """Get content ready for recycling."""
    content = await get_recyclable_content(platform, category, limit)
    return {"content": content}


@router.post("/auto-schedule")
async def schedule_recycled(
    platform: str,
    count: int = 5,
    user: dict = Depends(require_admin),
):
    """Auto-schedule recycled content to fill gaps."""
    scheduled = await auto_schedule_recycled_content(platform, count)
    return {"scheduled": scheduled}


@router.get("/mix-status")
async def get_mix_status(
    platform: str,
    days: int = 7,
    user: dict = Depends(require_admin),
):
    """Get current posting mix by category."""
    status = await get_category_mix_status(platform, days)
    return status


@router.get("/suggest-category")
async def suggest_category(
    platform: str,
    user: dict = Depends(require_admin),
):
    """Suggest which category to post next to maintain balance."""
    category = await suggest_next_category(platform)
    return {"suggested_category": category}


@router.get("/top-performers")
async def get_top_performers(
    platform: Optional[str] = None,
    min_engagement: int = 100,
    limit: int = 20,
    user: dict = Depends(require_admin),
):
    """Identify top posts to add to evergreen library."""
    posts = await get_top_performing_content(platform, min_engagement, limit)
    return {"posts": posts}


@router.post("/promote/{post_id}")
async def promote_post(
    post_id: int,
    category: str,
    max_uses: int = 10,
    user: dict = Depends(require_admin),
):
    """Promote a published post to the evergreen library."""
    result = await promote_post_to_library(post_id, category, max_uses)
    return result
