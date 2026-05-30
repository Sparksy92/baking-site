"""SEO sitemap.xml — auto-generated from products, categories, collections, blog posts."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import Response
import aiosqlite

from app.config import get_settings
from app.database import get_db

router = APIRouter(tags=["sitemap"])


@router.get("/sitemap.xml", response_class=Response)
async def sitemap(db: aiosqlite.Connection = Depends(get_db)):
    """Generate sitemap.xml with all public URLs."""
    settings = get_settings()
    domain = settings.store_domain.rstrip("/")

    urls: list[dict] = []

    # Static pages
    for path in ["/", "/shop", "/contact"]:
        urls.append({"loc": f"{domain}{path}", "priority": "1.0" if path == "/" else "0.8"})

    # Products
    cursor = await db.execute(
        "SELECT slug, updated_at FROM products WHERE is_active = 1 ORDER BY updated_at DESC"
    )
    for row in await cursor.fetchall():
        urls.append({
            "loc": f"{domain}/products/{row['slug']}",
            "lastmod": row["updated_at"][:10] if row["updated_at"] else None,
            "priority": "0.8",
        })

    # Categories
    cursor = await db.execute(
        "SELECT slug FROM categories WHERE is_active = 1"
    )
    for row in await cursor.fetchall():
        urls.append({"loc": f"{domain}/shop/{row['slug']}", "priority": "0.7"})

    # Collections
    cursor = await db.execute(
        "SELECT slug FROM collections WHERE is_active = 1"
    )
    for row in await cursor.fetchall():
        urls.append({"loc": f"{domain}/collections/{row['slug']}", "priority": "0.7"})

    # Blog posts
    cursor = await db.execute(
        "SELECT slug, updated_at FROM pages WHERE status = 'published' ORDER BY published_at DESC"
    )
    for row in await cursor.fetchall():
        urls.append({
            "loc": f"{domain}/blog/{row['slug']}",
            "lastmod": row["updated_at"][:10] if row["updated_at"] else None,
            "priority": "0.6",
        })

    # Build XML
    xml_parts = ['<?xml version="1.0" encoding="UTF-8"?>']
    xml_parts.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    for url in urls:
        xml_parts.append("  <url>")
        xml_parts.append(f"    <loc>{_escape(url['loc'])}</loc>")
        if url.get("lastmod"):
            xml_parts.append(f"    <lastmod>{url['lastmod']}</lastmod>")
        if url.get("priority"):
            xml_parts.append(f"    <priority>{url['priority']}</priority>")
        xml_parts.append("  </url>")
    xml_parts.append("</urlset>")

    return Response(
        content="\n".join(xml_parts),
        media_type="application/xml",
    )


def _escape(text: str) -> str:
    """Escape XML special characters."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("'", "&apos;").replace('"', "&quot;")
