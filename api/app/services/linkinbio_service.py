"""Link in Bio service - Micro landing pages for social profiles.

Later-style linkin.bio tool that creates shoppable landing pages
accessible via /l/{slug} for Instagram/TikTok bios.
"""
from __future__ import annotations

import logging
import secrets
import string
from datetime import datetime, timezone
from typing import Any

from app.database import db_connection

logger = logging.getLogger(__name__)


def generate_slug(length: int = 8) -> str:
    """Generate a short, readable slug."""
    alphabet = string.ascii_lowercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


async def create_page(
    title: str,
    subtitle: str | None = None,
    profile_image_url: str | None = None,
    custom_slug: str | None = None,
    theme: dict | None = None,
) -> dict:
    """Create a new link in bio page."""
    slug = custom_slug or generate_slug()
    
    # Check for slug collision
    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT id FROM linkinbio_pages WHERE slug = ?",
            (slug,)
        )
        if await cursor.fetchone():
            if custom_slug:
                return {"error": "Slug already exists", "slug": slug}
            # Regenerate if auto-generated
            slug = generate_slug(10)
        
        # Extract theme settings
        bg_color = theme.get("background_color", "#ffffff") if theme else "#ffffff"
        text_color = theme.get("text_color", "#000000") if theme else "#000000"
        btn_color = theme.get("button_color", "#000000") if theme else "#000000"
        btn_text_color = theme.get("button_text_color", "#ffffff") if theme else "#ffffff"
        font = theme.get("font_family", "system-ui") if theme else "system-ui"
        
        cursor = await db.execute(
            """INSERT INTO linkinbio_pages 
               (slug, title, subtitle, profile_image_url,
                background_color, text_color, button_color, button_text_color, font_family)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               RETURNING id, slug""",
            (slug, title, subtitle, profile_image_url,
             bg_color, text_color, btn_color, btn_text_color, font)
        )
        row = await cursor.fetchone()
        await db.commit()
        
    logger.info(f"Created linkinbio page: id={row['id']} slug={row['slug']}")
    return {
        "id": row["id"],
        "slug": row["slug"],
        "url": f"/l/{row['slug']}",
        "created": True
    }


async def get_page_by_slug(slug: str, track_view: bool = True) -> dict | None:
    """Get page details by slug. Optionally track a view."""
    async with db_connection() as db:
        cursor = await db.execute(
            """SELECT * FROM linkinbio_pages 
               WHERE slug = ? AND is_active = TRUE""",
            (slug,)
        )
        page = await cursor.fetchone()
        
        if not page:
            return None
        
        # Get links
        cursor = await db.execute(
            """SELECT * FROM linkinbio_links 
               WHERE page_id = ? AND is_active = TRUE
               ORDER BY is_highlighted DESC, display_order ASC""",
            (page["id"],)
        )
        links = await cursor.fetchall()
        
        # Track view
        if track_view:
            await db.execute(
                "UPDATE linkinbio_pages SET view_count = view_count + 1 WHERE id = ?",
                (page["id"],)
            )
            await db.commit()
        
    page_dict = dict(page)
    page_dict["links"] = [dict(l) for l in links]
    return page_dict


async def add_link(
    page_id: int,
    title: str,
    url: str,
    description: str | None = None,
    image_url: str | None = None,
    button_text: str = "Shop Now",
    is_highlighted: bool = False,
    display_order: int | None = None,
    utm_campaign: str | None = None,
) -> dict:
    """Add a link to a bio page."""
    async with db_connection() as db:
        # Get next display order if not specified
        if display_order is None:
            cursor = await db.execute(
                "SELECT MAX(display_order) as max_order FROM linkinbio_links WHERE page_id = ?",
                (page_id,)
            )
            row = await cursor.fetchone()
            display_order = (row["max_order"] or 0) + 1
        
        cursor = await db.execute(
            """INSERT INTO linkinbio_links
               (page_id, title, url, description, image_url, button_text,
                is_highlighted, display_order, utm_campaign)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               RETURNING id""",
            (page_id, title, url, description, image_url, button_text,
             is_highlighted, display_order, utm_campaign)
        )
        row = await cursor.fetchone()
        await db.commit()
        
    logger.info(f"Added link to page {page_id}: id={row['id']}")
    return {"id": row["id"], "page_id": page_id, "added": True}


async def track_link_click(link_id: int, source_ip: str | None = None) -> None:
    """Track a click on a link."""
    async with db_connection() as db:
        await db.execute(
            "UPDATE linkinbio_links SET click_count = click_count + 1 WHERE id = ?",
            (link_id,)
        )
        # Could also log to analytics table with IP, timestamp, etc.
        await db.commit()


async def get_page_analytics(page_id: int, days: int = 30) -> dict:
    """Get analytics for a linkinbio page."""
    async with db_connection() as db:
        cursor = await db.execute(
            """SELECT 
                view_count,
                click_count,
                conversion_count,
                created_at
               FROM linkinbio_pages WHERE id = ?""",
            (page_id,)
        )
        page = await cursor.fetchone()
        
        if not page:
            return {"error": "Page not found"}
        
        # Get per-link stats
        cursor = await db.execute(
            """SELECT id, title, click_count, conversion_count
               FROM linkinbio_links WHERE page_id = ? ORDER BY click_count DESC""",
            (page_id,)
        )
        links = await cursor.fetchall()
        
    # Calculate rates
    views = page["view_count"]
    clicks = page["click_count"]
    ctr = (clicks / views * 100) if views > 0 else 0
    
    return {
        "page_id": page_id,
        "total_views": views,
        "total_clicks": clicks,
        "ctr_percent": round(ctr, 2),
        "conversions": page["conversion_count"],
        "created_at": page["created_at"],
        "link_performance": [
            {
                "id": l["id"],
                "title": l["title"],
                "clicks": l["click_count"],
                "conversions": l["conversion_count"],
                "ctr": round((l["click_count"] / views * 100), 2) if views > 0 else 0
            }
            for l in links
        ]
    }


async def create_shoppable_page_from_collection(
    collection_id: int,
    title: str | None = None,
) -> dict:
    """Auto-create a linkinbio page from a product collection.
    
    Perfect for "Shop Our New Arrivals" or "Best Sellers" in bio.
    """
    async with db_connection() as db:
        # Get collection info
        cursor = await db.execute(
            "SELECT name, description FROM collections WHERE id = ?",
            (collection_id,)
        )
        collection = await cursor.fetchone()
        
        if not collection:
            return {"error": "Collection not found"}
        
        # Get products in collection
        cursor = await db.execute(
            """SELECT p.id, p.name, p.slug, p.price_cents, pi.image_url
               FROM products p
               JOIN collection_products cp ON p.id = cp.product_id
               LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = TRUE
               WHERE cp.collection_id = ? AND p.is_active = TRUE
               LIMIT 10""",
            (collection_id,)
        )
        products = await cursor.fetchall()
        
        if not products:
            return {"error": "No active products in collection"}
        
        # Create page
        page_title = title or f"Shop {collection['name']}"
        page = await create_page(
            title=page_title,
            subtitle=collection["description"],
        )
        
        if "error" in page:
            return page
        
        # Add product links
        for product in products:
            price = f"${product['price_cents'] / 100:.2f}"
            await add_link(
                page_id=page["id"],
                title=product["name"],
                url=f"/products/{product['slug']}",
                description=price,
                image_url=product["image_url"],
                button_text="Shop Now",
                utm_campaign=f"linkinbio_{page['slug']}"
            )
        
    return {
        "page_id": page["id"],
        "slug": page["slug"],
        "url": page["url"],
        "products_added": len(products),
        "created": True
    }


async def get_default_page_for_brand() -> dict | None:
    """Get or create the default brand linkinbio page."""
    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT * FROM linkinbio_pages WHERE is_active = TRUE ORDER BY id ASC LIMIT 1"
        )
        page = await cursor.fetchone()
        
        if page:
            return dict(page)
        
    # Create default page
    return await create_page(
        title="Shop Our Store",
        subtitle="New arrivals and best sellers",
    )
