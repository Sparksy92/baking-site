"""API routes for Link in Bio pages."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional

from app.auth import require_admin
from app.database import get_db, PostgresConnection

from app.services.linkinbio_service import (
    create_page,
    get_page_by_slug,
    add_link,
    get_page_analytics,
    create_shoppable_page_from_collection,
    get_default_page_for_brand,
)

router = APIRouter(prefix="/admin/linkinbio", tags=["linkinbio"])
public_router = APIRouter(prefix="/l", tags=["linkinbio-public"])


class PageCreate(BaseModel):
    title: str
    subtitle: Optional[str] = None
    profile_image_url: Optional[str] = None
    custom_slug: Optional[str] = None
    theme: Optional[dict] = None


class LinkCreate(BaseModel):
    title: str
    url: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    button_text: str = "Shop Now"
    is_highlighted: bool = False
    utm_campaign: Optional[str] = None


@router.post("/pages")
async def create_linkinbio_page(
    data: PageCreate,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Create a new link in bio page."""
    result = await create_page(
        title=data.title,
        subtitle=data.subtitle,
        profile_image_url=data.profile_image_url,
        custom_slug=data.custom_slug,
        theme=data.theme,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/pages")
async def list_pages(
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List all link in bio pages."""
    cursor = await db.execute(
        """SELECT id, slug, title, subtitle, is_active, view_count, 
                  click_count, created_at
           FROM linkinbio_pages 
           ORDER BY created_at DESC"""
    )
    rows = await cursor.fetchall()
    return {"pages": [dict(r) for r in rows]}


@router.get("/pages/{page_id}")
async def get_page(
    page_id: int,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Get page details with links."""
    cursor = await db.execute(
        "SELECT * FROM linkinbio_pages WHERE id = ?",
        (page_id,)
    )
    page = await cursor.fetchone()
    
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    cursor = await db.execute(
        """SELECT * FROM linkinbio_links 
           WHERE page_id = ? ORDER BY is_highlighted DESC, display_order ASC""",
        (page_id,)
    )
    links = await cursor.fetchall()
    
    result = dict(page)
    result["links"] = [dict(l) for l in links]
    return result


@router.post("/pages/{page_id}/links")
async def add_page_link(
    page_id: int,
    data: LinkCreate,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Add a link to a page."""
    result = await add_link(
        page_id=page_id,
        title=data.title,
        url=data.url,
        description=data.description,
        image_url=data.image_url,
        button_text=data.button_text,
        is_highlighted=data.is_highlighted,
        utm_campaign=data.utm_campaign,
    )
    return result


@router.get("/pages/{page_id}/analytics")
async def get_analytics(
    page_id: int,
    days: int = 30,
    user: dict = Depends(require_admin),
):
    """Get page analytics."""
    analytics = await get_page_analytics(page_id, days)
    if "error" in analytics:
        raise HTTPException(status_code=404, detail=analytics["error"])
    return analytics


@router.post("/pages/from-collection/{collection_id}")
async def create_from_collection(
    collection_id: int,
    title: Optional[str] = None,
    user: dict = Depends(require_admin),
):
    """Auto-create a shoppable page from a product collection."""
    result = await create_shoppable_page_from_collection(collection_id, title)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# Public routes (no auth required)
@public_router.get("/{slug}")
async def view_page(
    slug: str,
    db: PostgresConnection = Depends(get_db),
):
    """Public view of a link in bio page."""
    page = await get_page_by_slug(slug, track_view=True)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page


@public_router.post("/{slug}/click/{link_id}")
async def track_link_click(
    slug: str,
    link_id: int,
    db: PostgresConnection = Depends(get_db),
):
    """Track a link click (called by frontend)."""
    from app.services.linkinbio_service import track_link_click
    await track_link_click(link_id)
    return {"tracked": True}
