"""Admin endpoints for managing automatic discounts."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
import aiosqlite

from app.auth import require_admin
from app.database import get_db

router = APIRouter(prefix="/admin/discounts", tags=["admin-discounts"])


class AutoDiscountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    discount_type: str = Field(pattern="^(percentage|fixed_cents|buy_x_get_y)$")
    discount_value: int = Field(gt=0)
    buy_quantity: int | None = None
    get_quantity: int | None = None
    applies_to: str = Field(default="all", pattern="^(all|collection|category|product)$")
    applies_to_id: int | None = None
    minimum_quantity: int = 0
    minimum_order_cents: int = 0
    max_discount_cents: int | None = None
    starts_at: str | None = None
    expires_at: str | None = None
    is_active: bool = True
    priority: int = 0
    stackable: bool = False


class AutoDiscountUpdate(BaseModel):
    name: str | None = None
    discount_type: str | None = None
    discount_value: int | None = None
    buy_quantity: int | None = None
    get_quantity: int | None = None
    applies_to: str | None = None
    applies_to_id: int | None = None
    minimum_quantity: int | None = None
    minimum_order_cents: int | None = None
    max_discount_cents: int | None = None
    starts_at: str | None = None
    expires_at: str | None = None
    is_active: bool | None = None
    priority: int | None = None
    stackable: bool | None = None


@router.get("")
async def list_auto_discounts(
    is_active: bool | None = None,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List all automatic discounts."""
    conditions = []
    params: list = []

    if is_active is not None:
        conditions.append("is_active = ?")
        params.append(int(is_active))

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    cursor = await db.execute(
        f"SELECT * FROM automatic_discounts {where} ORDER BY priority DESC, created_at DESC",
        params,
    )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_auto_discount(
    body: AutoDiscountCreate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Create an automatic discount rule."""
    cursor = await db.execute(
        """INSERT INTO automatic_discounts
           (name, discount_type, discount_value, buy_quantity, get_quantity,
            applies_to, applies_to_id, minimum_quantity, minimum_order_cents,
            max_discount_cents, starts_at, expires_at, is_active, priority, stackable)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (body.name, body.discount_type, body.discount_value,
         body.buy_quantity, body.get_quantity,
         body.applies_to, body.applies_to_id,
         body.minimum_quantity, body.minimum_order_cents,
         body.max_discount_cents, body.starts_at, body.expires_at,
         int(body.is_active), body.priority, int(body.stackable)),
    )
    await db.commit()
    return {"id": cursor.lastrowid}


@router.get("/{discount_id}")
async def get_auto_discount(
    discount_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Get a single automatic discount."""
    cursor = await db.execute("SELECT * FROM automatic_discounts WHERE id = ?", (discount_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discount not found")
    return dict(row)


@router.patch("/{discount_id}")
async def update_auto_discount(
    discount_id: int,
    body: AutoDiscountUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Update an automatic discount."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    if "is_active" in updates:
        updates["is_active"] = int(updates["is_active"])
    if "stackable" in updates:
        updates["stackable"] = int(updates["stackable"])

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [discount_id]

    await db.execute(
        f"UPDATE automatic_discounts SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        values,
    )
    await db.commit()
    return {"updated": True}


@router.delete("/{discount_id}")
async def delete_auto_discount(
    discount_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Delete an automatic discount."""
    cursor = await db.execute("SELECT id FROM automatic_discounts WHERE id = ?", (discount_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discount not found")

    await db.execute("DELETE FROM automatic_discounts WHERE id = ?", (discount_id,))
    await db.commit()
    return {"deleted": True}
