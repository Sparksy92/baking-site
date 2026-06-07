"""Admin product tags management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from app.database import PostgresConnection

from app.auth import require_admin
from app.database import get_db

router = APIRouter(prefix="/admin/tags", tags=["admin-tags"])


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=100)


class TagUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None


@router.get("")
async def list_tags(
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("""
        SELECT t.*, COUNT(pt.product_id) as product_count
        FROM tags t
        LEFT JOIN product_tags pt ON pt.tag_id = t.id
        GROUP BY t.id
        ORDER BY t.name
    """)
    return [dict(r) for r in await cursor.fetchall()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_tag(
    body: TagCreate,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    try:
        cursor = await db.execute(
            "INSERT INTO tags (name, slug) VALUES (?, ?)", (body.name, body.slug)
        )
        await db.commit()
    except Exception:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tag already exists")
    return {"id": cursor.lastrowid, "name": body.name, "slug": body.slug}


@router.patch("/{tag_id}")
async def update_tag(
    tag_id: int,
    body: TagUpdate,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT id FROM tags WHERE id = ?", (tag_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields")

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [tag_id]
    await db.execute(f"UPDATE tags SET {set_clause} WHERE id = ?", values)
    await db.commit()
    return {"updated": True}


@router.delete("/{tag_id}")
async def delete_tag(
    tag_id: int,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT id FROM tags WHERE id = ?", (tag_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")

    await db.execute("DELETE FROM tags WHERE id = ?", (tag_id,))
    await db.commit()
    return {"deleted": True}


@router.post("/products/{product_id}/tags/{tag_id}", status_code=status.HTTP_201_CREATED)
async def add_tag_to_product(
    product_id: int,
    tag_id: int,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    try:
        await db.execute(
            "INSERT INTO product_tags (product_id, tag_id) VALUES (?, ?)", (product_id, tag_id)
        )
        await db.commit()
    except Exception:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tag already on product")
    return {"added": True}


@router.delete("/products/{product_id}/tags/{tag_id}")
async def remove_tag_from_product(
    product_id: int,
    tag_id: int,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    result = await db.execute(
        "DELETE FROM product_tags WHERE product_id = ? AND tag_id = ?", (product_id, tag_id)
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not on product")
    return {"removed": True}
