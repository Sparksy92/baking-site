"""Product reviews endpoints — public listing + customer submission."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from app.database import IntegrityError, PostgresConnection

from app.customer_auth import get_current_customer
from app.database import get_db

router = APIRouter(tags=["reviews"])


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    title: str | None = Field(default=None, max_length=200)
    body: str | None = Field(default=None, max_length=2000)


class ReviewResponse(BaseModel):
    id: int
    rating: int
    title: str | None
    body: str | None
    customer_name: str
    created_at: str


class ReviewSummary(BaseModel):
    average_rating: float
    total_reviews: int
    distribution: dict[str, int]  # {"5": 10, "4": 5, ...}


@router.get("/products/{product_id}/reviews")
async def list_product_reviews(
    product_id: int,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=50),
    db: PostgresConnection = Depends(get_db),
):
    """List approved reviews for a product (public)."""
    offset = (page - 1) * limit

    cursor = await db.execute("""
        SELECT pr.id, pr.rating, pr.title, pr.body, pr.created_at,
               c.first_name || ' ' || SUBSTR(c.last_name, 1, 1) || '.' as customer_name
        FROM product_reviews pr
        JOIN customers c ON c.id = pr.customer_id
        WHERE pr.product_id = ? AND pr.status = 'approved'
        ORDER BY pr.created_at DESC
        LIMIT ? OFFSET ?
    """, (product_id, limit, offset))
    rows = await cursor.fetchall()

    # Summary
    cursor = await db.execute("""
        SELECT COUNT(*) as total,
               COALESCE(AVG(rating), 0) as avg_rating,
               SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as r5,
               SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as r4,
               SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as r3,
               SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as r2,
               SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as r1
        FROM product_reviews
        WHERE product_id = ? AND status = 'approved'
    """, (product_id,))
    summary_row = await cursor.fetchone()

    return {
        "reviews": [dict(r) for r in rows],
        "summary": {
            "average_rating": round(summary_row["avg_rating"], 1),
            "total_reviews": summary_row["total"],
            "distribution": {
                "5": summary_row["r5"] or 0,
                "4": summary_row["r4"] or 0,
                "3": summary_row["r3"] or 0,
                "2": summary_row["r2"] or 0,
                "1": summary_row["r1"] or 0,
            },
        },
    }


@router.post("/products/{product_id}/reviews", status_code=status.HTTP_201_CREATED)
async def create_review(
    product_id: int,
    body: ReviewCreate,
    db: PostgresConnection = Depends(get_db),
    customer: dict = Depends(get_current_customer),
):
    """Submit a review for a product (requires customer login, one review per product)."""
    customer_id = int(customer["sub"])

    # Verify product exists
    cursor = await db.execute("SELECT id FROM products WHERE id = ? AND is_active = 1", (product_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    try:
        cursor = await db.execute(
            "INSERT INTO product_reviews (product_id, customer_id, rating, title, body) VALUES (?, ?, ?, ?, ?)",
            (product_id, customer_id, body.rating, body.title, body.body),
        )
        await db.commit()
        return {"id": cursor.lastrowid, "status": "pending"}
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You've already reviewed this product",
        )
