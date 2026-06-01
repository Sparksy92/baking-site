from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
import aiosqlite

from app.auth import require_admin
from app.database import get_db
from app.models.schemas import PromoCodeCreate, PromoCodeUpdate

router = APIRouter(prefix="/admin/promos", tags=["admin-promos"])


@router.get("")
async def list_promos(
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List all promo codes."""
    cursor = await db.execute("SELECT * FROM promo_codes ORDER BY created_at DESC")
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_promo(
    body: PromoCodeCreate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Create a new promo code."""
    try:
        cursor = await db.execute(
            """INSERT INTO promo_codes
               (code, description, discount_type, discount_value, minimum_order_cents,
                max_uses, starts_at, expires_at, is_active)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                body.code.upper().strip(), body.description, body.discount_type,
                body.discount_value, body.minimum_order_cents,
                body.max_uses, body.starts_at, body.expires_at, int(body.is_active),
            ),
        )
        await db.commit()
        return {"id": cursor.lastrowid, "code": body.code.upper().strip()}
    except aiosqlite.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Promo code '{body.code}' already exists",
        )


@router.patch("/{promo_id}")
async def update_promo(
    promo_id: int,
    body: PromoCodeUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Update a promo code."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    if "is_active" in updates:
        updates["is_active"] = int(updates["is_active"])

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [promo_id]

    await db.execute(
        f"UPDATE promo_codes SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        values,
    )
    await db.commit()
    return {"updated": True}


@router.delete("/{promo_id}")
async def delete_promo(
    promo_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Delete a promo code."""
    await db.execute("DELETE FROM promo_codes WHERE id = ?", (promo_id,))
    await db.commit()
    return {"deleted": True}
