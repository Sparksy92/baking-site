"""Admin bundle management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import aiosqlite

from app.auth import require_admin
from app.database import get_db

router = APIRouter(prefix="/admin/bundles", tags=["admin-bundles"])


class BundleItemInput(BaseModel):
    product_id: int
    quantity: int = Field(default=1, ge=1)
    default_variant_id: int | None = None


class BundleCreate(BaseModel):
    name: str = Field(min_length=1)
    slug: str = Field(min_length=1)
    description: str | None = None
    discount_type: str = "percentage"
    discount_value: int = Field(default=0, ge=0)
    items: list[BundleItemInput] = Field(min_length=1)


class BundleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    discount_type: str | None = None
    discount_value: int | None = None
    is_active: bool | None = None


@router.get("")
async def list_bundles(
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT * FROM bundles ORDER BY created_at DESC")
    return [dict(r) for r in await cursor.fetchall()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_bundle(
    body: BundleCreate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    try:
        cursor = await db.execute(
            """INSERT INTO bundles (name, slug, description, discount_type, discount_value)
               VALUES (?, ?, ?, ?, ?)""",
            (body.name, body.slug, body.description, body.discount_type, body.discount_value),
        )
    except aiosqlite.IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already exists")

    bundle_id = cursor.lastrowid
    for item in body.items:
        await db.execute(
            "INSERT INTO bundle_items (bundle_id, product_id, default_variant_id, quantity) VALUES (?, ?, ?, ?)",
            (bundle_id, item.product_id, item.default_variant_id, item.quantity),
        )
    await db.commit()

    return {"id": bundle_id, "slug": body.slug}


@router.patch("/{bundle_id}")
async def update_bundle(
    bundle_id: int,
    body: BundleUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT id FROM bundles WHERE id = ?", (bundle_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bundle not found")

    updates = {}
    for k, v in body.model_dump().items():
        if v is not None:
            updates[k] = int(v) if k == "is_active" else v

    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields")

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [bundle_id]
    await db.execute(
        f"UPDATE bundles SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?", values
    )
    await db.commit()
    return {"updated": True}


@router.delete("/{bundle_id}")
async def delete_bundle(
    bundle_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT id FROM bundles WHERE id = ?", (bundle_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bundle not found")

    await db.execute("DELETE FROM bundles WHERE id = ?", (bundle_id,))
    await db.commit()
    return {"deleted": True}
