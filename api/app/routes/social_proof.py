"""Social proof endpoints — viewing count + recent sales for PDP."""
from __future__ import annotations

import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from app.database import PostgresConnection

from app.database import get_db

router = APIRouter(prefix="/social-proof", tags=["social-proof"])


@router.get("/{product_id}")
async def get_social_proof(
    product_id: int,
    db: PostgresConnection = Depends(get_db),
):
    """Return social proof data for a product.

    - viewers: recent event count (product_viewed in last 30 min) + random jitter
    - sold_this_week: actual order items for product in last 7 days
    """
    # Recent viewers (events from last 30 min)
    cursor = await db.execute(
            """SELECT COUNT(DISTINCT COALESCE(session_id, CAST(id AS TEXT))) as viewer_count
               FROM events
               WHERE event_type = 'product_viewed'
                 AND product_id = ?
                 AND CAST(created_at AS timestamp) >= (CURRENT_TIMESTAMP - INTERVAL '30 minutes')""",
        (product_id,),
    )
    row = await cursor.fetchone()
    raw_viewers = row["viewer_count"] if row else 0
    # Add subtle jitter (1-3) so it never shows 0
    viewers = max(raw_viewers, 1) + random.randint(0, 2)

    # Sold this week
    cursor = await db.execute(
        """SELECT COALESCE(SUM(oi.quantity), 0) as sold
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE oi.product_id = ?
             AND o.payment_status = 'confirmed'
             AND CAST(o.created_at AS timestamp) >= (CURRENT_TIMESTAMP - INTERVAL '7 days')""",
        (product_id,),
    )
    row = await cursor.fetchone()
    sold_this_week = row["sold"] if row else 0

    return {
        "viewers": viewers,
        "sold_this_week": sold_this_week,
    }


@router.get("/instagram-feed")
async def get_instagram_feed(
    limit: int = 12,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Return recent Instagram posts for the storefront social proof grid.

    Pulls from social_posts where platform='instagram' and status='published'.
    Includes engagement metrics (likes, comments) if synced from Meta.
    """
    cursor = await db.execute(
        """SELECT sp.*, p.slug as blog_slug
           FROM social_posts sp
           LEFT JOIN pages p ON sp.page_id = p.id
           WHERE sp.platform = 'instagram'
           AND sp.status = 'published'
           AND sp.platform_post_id IS NOT NULL
           ORDER BY sp.published_at DESC
           LIMIT ?""",
        (limit,),
    )
    rows = await cursor.fetchall()

    posts = []
    for r in rows:
        post = dict(r)
        posts.append({
            "id": post["id"],
            "platform_post_id": post["platform_post_id"],
            "content": post["content"],
            "image_url": post["image_url"],
            "video_url": post["video_url"],
            "published_at": post["published_at"],
            "likes": post.get("likes", 0),
            "comments_count": post.get("comments_count", 0),
            "blog_slug": post.get("blog_slug"),
        })

    return {"posts": posts, "count": len(posts)}
