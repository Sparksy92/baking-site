"""Admin review moderation endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
import aiosqlite

from app.auth import require_admin
from app.database import get_db

router = APIRouter(prefix="/admin/reviews", tags=["admin-reviews"])


class ReviewModerate(BaseModel):
    status: str  # "approved" or "rejected"


@router.get("")
async def list_reviews(
    status_filter: str = Query(default="pending", alias="status"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List reviews for moderation."""
    offset = (page - 1) * limit

    cursor = await db.execute("""
        SELECT pr.*, p.name as product_name, c.first_name, c.last_name, c.email
        FROM product_reviews pr
        JOIN products p ON p.id = pr.product_id
        JOIN customers c ON c.id = pr.customer_id
        WHERE pr.status = ?
        ORDER BY pr.created_at DESC
        LIMIT ? OFFSET ?
    """, (status_filter, limit, offset))
    rows = await cursor.fetchall()

    # Total count
    cursor = await db.execute(
        "SELECT COUNT(*) FROM product_reviews WHERE status = ?",
        (status_filter,),
    )
    total = (await cursor.fetchone())[0]

    return {"reviews": [dict(r) for r in rows], "total": total}


@router.patch("/{review_id}")
async def moderate_review(
    review_id: int,
    body: ReviewModerate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Approve or reject a review."""
    if body.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")

    result = await db.execute(
        "UPDATE product_reviews SET status = ?, updated_at = datetime('now') WHERE id = ?",
        (body.status, review_id),
    )
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")

    return {"moderated": True, "status": body.status}


@router.delete("/{review_id}")
async def delete_review(
    review_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Delete a review permanently."""
    await db.execute("DELETE FROM product_reviews WHERE id = ?", (review_id,))
    await db.commit()
    return {"deleted": True}
