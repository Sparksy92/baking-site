"""API routes for RSS Auto-publishing."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from app.auth import require_admin
from app.database import get_db, PostgresConnection

from app.services.rss_service import (
    create_feed,
    check_feed,
    check_all_feeds,
    get_feed_stats,
)

router = APIRouter(prefix="/admin/rss", tags=["rss"])


class FeedCreate(BaseModel):
    name: str
    url: str
    platform: str = Field(..., description="Platform to post to")
    content_template: str = "📰 {title}\n\n{url}"
    auto_publish: bool = False
    max_posts_per_day: int = 3
    category: str = "educational"


class FeedUpdate(BaseModel):
    is_active: Optional[bool] = None
    auto_publish: Optional[bool] = None
    max_posts_per_day: Optional[int] = None


@router.post("/feeds")
async def create_rss_feed(
    data: FeedCreate,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Create a new RSS feed subscription."""
    result = await create_feed(
        name=data.name,
        url=data.url,
        platform=data.platform,
        content_template=data.content_template,
        auto_publish=data.auto_publish,
        max_posts_per_day=data.max_posts_per_day,
        category=data.category,
    )
    return result


@router.get("/feeds")
async def list_feeds(
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List all RSS feeds."""
    cursor = await db.execute(
        """SELECT id, name, url, platform, is_active, auto_publish,
                  max_posts_per_day, posts_today, last_checked_at, created_at
           FROM rss_feeds 
           ORDER BY created_at DESC"""
    )
    rows = await cursor.fetchall()
    return {"feeds": [dict(r) for r in rows]}


@router.get("/feeds/{feed_id}")
async def get_feed(
    feed_id: int,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Get RSS feed details."""
    cursor = await db.execute(
        "SELECT * FROM rss_feeds WHERE id = ?",
        (feed_id,)
    )
    feed = await cursor.fetchone()
    
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    
    return dict(feed)


@router.post("/feeds/{feed_id}/check")
async def check_single_feed(
    feed_id: int,
    user: dict = Depends(require_admin),
):
    """Manually check an RSS feed for new items."""
    result = await check_feed(feed_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/check-all")
async def check_all(
    user: dict = Depends(require_admin),
):
    """Check all active RSS feeds."""
    result = await check_all_feeds()
    return result


@router.get("/feeds/{feed_id}/stats")
async def get_stats(
    feed_id: int,
    user: dict = Depends(require_admin),
):
    """Get RSS feed statistics."""
    stats = await get_feed_stats(feed_id)
    if "error" in stats:
        raise HTTPException(status_code=404, detail=stats["error"])
    return stats


@router.patch("/feeds/{feed_id}")
async def update_feed(
    feed_id: int,
    data: FeedUpdate,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Update RSS feed settings."""
    # Build update
    updates = []
    params = []
    
    if data.is_active is not None:
        updates.append("is_active = ?")
        params.append(data.is_active)
    if data.auto_publish is not None:
        updates.append("auto_publish = ?")
        params.append(data.auto_publish)
    if data.max_posts_per_day is not None:
        updates.append("max_posts_per_day = ?")
        params.append(data.max_posts_per_day)
    
    if not updates:
        return {"updated": False, "reason": "No fields to update"}
    
    params.append(feed_id)
    
    await db.execute(
        f"UPDATE rss_feeds SET {', '.join(updates)} WHERE id = ?",
        params
    )
    await db.commit()
    
    return {"updated": True, "feed_id": feed_id}
