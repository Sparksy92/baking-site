"""Admin loyalty program management."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from app.database import PostgresConnection

from app.auth import require_admin
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/loyalty", tags=["admin-loyalty"])


class LoyaltyRuleCreate(BaseModel):
    name: str
    points_per_dollar: int = Field(default=1, ge=1)
    redemption_rate_cents: int = Field(default=1, ge=1)
    minimum_points_redeem: int = Field(default=100, ge=1)


class PointsAdjust(BaseModel):
    customer_id: int
    points: int
    reason: str = "adjustment"


@router.get("/rules")
async def list_rules(
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT * FROM loyalty_rules ORDER BY created_at DESC")
    return [dict(r) for r in await cursor.fetchall()]


@router.post("/rules", status_code=status.HTTP_201_CREATED)
async def create_rule(
    body: LoyaltyRuleCreate,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    # Deactivate existing rules
    await db.execute("UPDATE loyalty_rules SET is_active = FALSE")

    cursor = await db.execute(
        """INSERT INTO loyalty_rules (name, points_per_dollar, redemption_rate_cents, minimum_points_redeem)
           VALUES (?, ?, ?, ?)""",
        (body.name, body.points_per_dollar, body.redemption_rate_cents, body.minimum_points_redeem),
    )
    await db.commit()
    return {"id": cursor.lastrowid}


@router.post("/adjust")
async def adjust_points(
    body: PointsAdjust,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Manually adjust a customer's loyalty points."""
    cursor = await db.execute("SELECT loyalty_points FROM customers WHERE id = ?", (body.customer_id,))
    cust = await cursor.fetchone()
    if not cust:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    new_points = cust["loyalty_points"] + body.points
    if new_points < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient points")

    await db.execute(
        "UPDATE customers SET loyalty_points = ?, lifetime_points = lifetime_points + CASE WHEN ? > 0 THEN ? ELSE 0 END WHERE id = ?",
        (new_points, body.points, body.points, body.customer_id),
    )
    await db.execute(
        "INSERT INTO loyalty_transactions (customer_id, points, reason) VALUES (?, ?, ?)",
        (body.customer_id, body.points, body.reason),
    )
    await db.commit()

    return {"new_balance": new_points}


@router.get("/stats")
async def loyalty_stats(
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT COUNT(*) as members, SUM(loyalty_points) as total_outstanding FROM customers WHERE loyalty_points > 0")
    row = await cursor.fetchone()
    cursor = await db.execute("SELECT SUM(points) as total_redeemed FROM loyalty_transactions WHERE points < 0")
    redeemed = await cursor.fetchone()

    return {
        "members_with_points": row["members"] or 0,
        "total_outstanding_points": row["total_outstanding"] or 0,
        "total_redeemed_points": abs(redeemed["total_redeemed"] or 0),
    }
