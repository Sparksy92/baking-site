"""Public size guide endpoint."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from app.database import PostgresConnection

from app.database import get_db

router = APIRouter(prefix="/size-guides", tags=["size-guides"])


@router.get("/product/{product_id}")
async def get_size_guide_for_product(
    product_id: int,
    db: PostgresConnection = Depends(get_db),
):
    """Get the size guide for a specific product.

    Falls back to category guide, then default guide.
    """
    # 1. Product-specific guide
    cursor = await db.execute(
        "SELECT * FROM size_guides WHERE product_id = ?", (product_id,)
    )
    guide = await cursor.fetchone()

    if not guide:
        # 2. Category guide
        cursor = await db.execute(
            "SELECT category_id FROM products WHERE id = ?", (product_id,)
        )
        product = await cursor.fetchone()
        if product and product["category_id"]:
            cursor = await db.execute(
                "SELECT * FROM size_guides WHERE category_id = ?", (product["category_id"],)
            )
            guide = await cursor.fetchone()

    if not guide:
        # 3. Default guide
        cursor = await db.execute(
            "SELECT * FROM size_guides WHERE is_default = 1 LIMIT 1"
        )
        guide = await cursor.fetchone()

    if not guide:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No size guide available")

    result = dict(guide)
    result["measurements"] = json.loads(result["measurements_json"]) if result["measurements_json"] else []
    return result
