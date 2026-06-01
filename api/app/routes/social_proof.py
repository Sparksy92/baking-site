"""Social proof endpoints — viewing count + recent sales for PDP."""
from __future__ import annotations

import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
import aiosqlite

from app.database import get_db

router = APIRouter(prefix="/social-proof", tags=["social-proof"])


@router.get("/{product_id}")
async def get_social_proof(
    product_id: int,
    db: aiosqlite.Connection = Depends(get_db),
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
