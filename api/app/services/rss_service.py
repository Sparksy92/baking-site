"""RSS Auto-publishing service.

Automatically monitors RSS feeds (blog, news) and creates social posts
when new content is published. Buffer/Hootsuite-style automation.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from xml.etree import ElementTree as ET
from typing import Any

import httpx

from app.database import db_connection

logger = logging.getLogger(__name__)


async def fetch_feed(url: str) -> list[dict]:
    """Fetch and parse an RSS feed."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=30.0)
            resp.raise_for_status()
            
        # Parse XML
        root = ET.fromstring(resp.content)
        
        # Handle RSS 2.0 and Atom
        items = []
        
        # RSS 2.0
        if root.tag == "rss" or root.tag.endswith("rss"):
            channel = root.find("channel")
            if channel is not None:
                for item in channel.findall("item"):
                    entry = parse_rss_item(item)
                    if entry:
                        items.append(entry)
        
        # Atom
        elif root.tag.endswith("feed"):
            for entry in root.findall("{http://www.w3.org/2005/Atom}entry"):
                parsed = parse_atom_entry(entry)
                if parsed:
                    items.append(parsed)
        
        return items
        
    except Exception as e:
        logger.error(f"Failed to fetch RSS feed {url}: {e}")
        return []


def parse_rss_item(item: ET.Element) -> dict | None:
    """Parse an RSS item element."""
    title = item.find("title")
    link = item.find("link")
    guid = item.find("guid") or item.find("link")
    pub_date = item.find("pubDate")
    description = item.find("description")
    
    if title is None or link is None:
        return None
    
    return {
        "title": title.text or "",
        "url": (link.text or "").strip(),
        "guid": (guid.text if guid is not None else link.text or "").strip(),
        "published_at": pub_date.text if pub_date is not None else None,
        "description": (description.text or "")[:300] if description is not None else "",
    }


def parse_atom_entry(entry: ET.Element) -> dict | None:
    """Parse an Atom entry element."""
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    
    title = entry.find("atom:title", ns)
    link = entry.find("atom:link", ns)
    id_elem = entry.find("atom:id", ns)
    published = entry.find("atom:published", ns) or entry.find("atom:updated", ns)
    summary = entry.find("atom:summary", ns) or entry.find("atom:content", ns)
    
    if title is None:
        return None
    
    link_url = ""
    if link is not None:
        link_url = link.get("href", "")
    
    return {
        "title": title.text or "",
        "url": link_url,
        "guid": (id_elem.text if id_elem is not None else link_url or "").strip(),
        "published_at": published.text if published is not None else None,
        "description": (summary.text or "")[:300] if summary is not None else "",
    }


async def create_feed(
    name: str,
    url: str,
    platform: str,
    content_template: str = "📰 {title}\n\n{url}",
    auto_publish: bool = False,
    max_posts_per_day: int = 3,
    category: str = "educational",
) -> dict:
    """Create a new RSS feed subscription."""
    async with db_connection() as db:
        cursor = await db.execute(
            """INSERT INTO rss_feeds
               (name, url, platform, content_template, auto_publish, 
                max_posts_per_day, category)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               RETURNING id""",
            (name, url, platform, content_template, auto_publish,
             max_posts_per_day, category)
        )
        row = await cursor.fetchone()
        await db.commit()
        
    logger.info(f"Created RSS feed: id={row['id']} name={name} platform={platform}")
    return {"id": row["id"], "name": name, "created": True}


async def check_feed(feed_id: int) -> dict:
    """Check a single RSS feed for new items."""
    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT * FROM rss_feeds WHERE id = ? AND is_active = TRUE",
            (feed_id,)
        )
        feed = await cursor.fetchone()
        
    if not feed:
        return {"error": "Feed not found or inactive"}
    
    # Check rate limit
    now = datetime.now(timezone.utc)
    if feed["day_reset_at"] and feed["day_reset_at"] < now - timedelta(days=1):
        # Reset daily counter
        async with db_connection() as db:
            await db.execute(
                """UPDATE rss_feeds
                   SET posts_today = 0, day_reset_at = CURRENT_TIMESTAMP
                   WHERE id = ?""",
                (feed_id,)
            )
            await db.commit()
        feed["posts_today"] = 0
    
    if feed["posts_today"] >= feed["max_posts_per_day"]:
        return {"skipped": True, "reason": "Daily post limit reached"}
    
    # Fetch feed
    items = await fetch_feed(feed["url"])
    if not items:
        return {"error": "Could not fetch feed or no items"}
    
    # Get already posted GUIDs
    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT guid FROM rss_items_posted WHERE feed_id = ?",
            (feed_id,)
        )
        posted_guids = {r["guid"] for r in await cursor.fetchall()}
    
    # Find new items
    new_items = [item for item in items if item["guid"] not in posted_guids]
    
    posted_count = 0
    posts_created = []
    
    for item in new_items:
        if feed["posts_today"] + posted_count >= feed["max_posts_per_day"]:
            break
        
        # Format content
        content = feed["content_template"].format(
            title=item["title"],
            url=item["url"],
            description=item["description"]
        )
        
        # Create social post
        status = "scheduled" if not feed["auto_publish"] else "approved"
        
        async with db_connection() as db:
            cursor = await db.execute(
                """INSERT INTO social_posts
                   (platform, content, status, scheduled_at, created_by, link_url)
                   VALUES (?, ?, ?, datetime('now', '+1 hour'), 'rss', ?)
                   RETURNING id""",
                (feed["platform"], content, status, item["url"])
            )
            post_row = await cursor.fetchone()
            
            # Mark as posted
            await db.execute(
                """INSERT INTO rss_items_posted
                   (feed_id, guid, title, url, social_post_id)
                   VALUES (?, ?, ?, ?, ?)""",
                (feed_id, item["guid"], item["title"], item["url"], post_row["id"])
            )
            await db.commit()
        
        posted_count += 1
        posts_created.append({
            "post_id": post_row["id"],
            "title": item["title"],
            "guid": item["guid"]
        })
        
        logger.info(f"RSS created post: feed={feed_id} post={post_row['id']} title={item['title'][:50]}")
    
    # Update feed stats
    async with db_connection() as db:
        await db.execute(
            """UPDATE rss_feeds
               SET last_checked_at = CURRENT_TIMESTAMP,
                   posts_today = posts_today + ?,
                   last_post_at = CASE WHEN ? > 0 THEN CURRENT_TIMESTAMP ELSE last_post_at END
               WHERE id = ?""",
            (posted_count, posted_count, feed_id)
        )
        await db.commit()
    
    return {
        "feed_id": feed_id,
        "items_checked": len(items),
        "new_items": len(new_items),
        "posts_created": posted_count,
        "posts": posts_created
    }


async def check_all_feeds() -> dict:
    """Check all active RSS feeds."""
    async with db_connection() as db:
        cursor = await db.execute(
            """SELECT id FROM rss_feeds 
               WHERE is_active = TRUE
               AND (last_checked_at IS NULL 
                    OR last_checked_at <= datetime('now', '-1 hour'))"""
        )
        feeds = await cursor.fetchall()
    
    results = []
    for feed_row in feeds:
        result = await check_feed(feed_row["id"])
        results.append(result)
    
    total_created = sum(r.get("posts_created", 0) for r in results)
    
    return {
        "feeds_checked": len(feeds),
        "total_posts_created": total_created,
        "results": results
    }


async def get_feed_stats(feed_id: int) -> dict:
    """Get stats for an RSS feed."""
    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT * FROM rss_feeds WHERE id = ?",
            (feed_id,)
        )
        feed = await cursor.fetchone()
        
        if not feed:
            return {"error": "Feed not found"}
        
        # Count total items posted
        cursor = await db.execute(
            "SELECT COUNT(*) as total FROM rss_items_posted WHERE feed_id = ?",
            (feed_id,)
        )
        count_row = await cursor.fetchone()
        
        # Get recent items
        cursor = await db.execute(
            """SELECT rip.*, sp.status, sp.engagement_score
               FROM rss_items_posted rip
               LEFT JOIN social_posts sp ON rip.social_post_id = sp.id
               WHERE rip.feed_id = ?
               ORDER BY rip.posted_at DESC
               LIMIT 10""",
            (feed_id,)
        )
        recent = await cursor.fetchall()
        
    return {
        "feed": dict(feed),
        "total_items_posted": count_row["total"],
        "recent_items": [dict(r) for r in recent]
    }
