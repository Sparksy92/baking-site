"""Admin size guide management."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from app.database import PostgresConnection

from app.auth import require_admin
from app.database import get_db

router = APIRouter(prefix="/admin/size-guides", tags=["admin-size-guides"])


class SizeGuideCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    measurements_json: str  # JSON string
    product_id: int | None = None
    category_id: int | None = None
    is_default: bool = False


class SizeGuideUpdate(BaseModel):
    name: str | None = None
    measurements_json: str | None = None
    product_id: int | None = None
    category_id: int | None = None
    is_default: bool | None = None


@router.get("")
async def list_size_guides(
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT * FROM size_guides ORDER BY name")
    return [dict(r) for r in await cursor.fetchall()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_size_guide(
    body: SizeGuideCreate,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    try:
        json.loads(body.measurements_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid measurements JSON")

    # If setting as default, unset existing default
    if body.is_default:
        await db.execute("UPDATE size_guides SET is_default = 0 WHERE is_default = 1")

    cursor = await db.execute(
        """INSERT INTO size_guides (name, measurements_json, product_id, category_id, is_default)
           VALUES (?, ?, ?, ?, ?)""",
        (body.name, body.measurements_json, body.product_id, body.category_id, int(body.is_default)),
    )
    await db.commit()
    return {"id": cursor.lastrowid, "name": body.name}


@router.patch("/{guide_id}")
async def update_size_guide(
    guide_id: int,
    body: SizeGuideUpdate,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT id FROM size_guides WHERE id = ?", (guide_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guide not found")

    updates = {}
    for k, v in body.model_dump().items():
        if v is not None:
            updates[k] = int(v) if k == "is_default" else v

    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields")

    if "measurements_json" in updates:
        try:
            json.loads(updates["measurements_json"])
        except json.JSONDecodeError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid measurements JSON")

    if updates.get("is_default"):
        await db.execute("UPDATE size_guides SET is_default = 0 WHERE is_default = 1")

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [guide_id]
    await db.execute(
        f"UPDATE size_guides SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?", values
    )
    await db.commit()
    return {"updated": True}


@router.delete("/{guide_id}")
async def delete_size_guide(
    guide_id: int,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT id FROM size_guides WHERE id = ?", (guide_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guide not found")

    await db.execute("DELETE FROM size_guides WHERE id = ?", (guide_id,))
    await db.commit()
    return {"deleted": True}
