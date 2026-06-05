from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
import aiosqlite

from app.auth import require_admin
from app.database import get_db
from app.models.schemas import CollectionCreate, CollectionUpdate, CollectionDetail

router = APIRouter(prefix="/admin/collections", tags=["admin-collections"])


@router.get("")
async def list_collections(
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("""
        SELECT col.*, COUNT(cp.product_id) as product_count
        FROM collections col
        LEFT JOIN collection_products cp ON cp.collection_id = col.id
        GROUP BY col.id
        ORDER BY col.sort_order, col.name
    """)
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.get("/{collection_id}", response_model=CollectionDetail)
async def get_collection(
    collection_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("""
        SELECT col.*, COUNT(cp.product_id) as product_count
        FROM collections col
        LEFT JOIN collection_products cp ON cp.collection_id = col.id
        WHERE col.id = ?
        GROUP BY col.id
    """, (collection_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Collection not found")
    r = dict(row)
    return CollectionDetail(
        id=r["id"], name=r["name"], slug=r["slug"],
        description=r["description"], image_url=r.get("image_url"),
        is_active=bool(r["is_active"]), sort_order=r["sort_order"],
        product_count=r["product_count"],
        meta_title=r.get("meta_title"), meta_description=r.get("meta_description"),
        intro_copy=r.get("intro_copy"), noindex=bool(r.get("noindex") or False),
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_collection(
    body: CollectionCreate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    try:
        cursor = await db.execute(
            """INSERT INTO collections (name, slug, description, is_active, sort_order,
                                       meta_title, meta_description, intro_copy, noindex)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (body.name, body.slug, body.description, body.is_active, body.sort_order,
             body.meta_title, body.meta_description, body.intro_copy, body.noindex),
        )
        new_id = cursor.lastrowid
        await db.commit()
        row_cur = await db.execute("SELECT * FROM collections WHERE id = ?", (new_id,))
        row = await row_cur.fetchone()
        return dict(row)
    except aiosqlite.IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Collection slug already exists")


@router.patch("/{collection_id}")
async def update_collection(
    collection_id: int,
    body: CollectionUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [collection_id]

    await db.execute(
        f"UPDATE collections SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        values,
    )
    await db.commit()
    return {"updated": True}


@router.delete("/{collection_id}")
async def delete_collection(
    collection_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    await db.execute("DELETE FROM collections WHERE id = ?", (collection_id,))
    await db.commit()
    return {"deleted": True}


@router.post("/{collection_id}/products/{product_id}", status_code=status.HTTP_201_CREATED)
async def add_product_to_collection(
    collection_id: int,
    product_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    try:
        await db.execute(
            "INSERT INTO collection_products (collection_id, product_id) VALUES (?, ?)",
            (collection_id, product_id),
        )
        await db.commit()
        return {"added": True}
    except aiosqlite.IntegrityError:
        return {"added": True}  # Already exists, idempotent


@router.delete("/{collection_id}/products/{product_id}")
async def remove_product_from_collection(
    collection_id: int,
    product_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    await db.execute(
        "DELETE FROM collection_products WHERE collection_id = ? AND product_id = ?",
        (collection_id, product_id),
    )
    await db.commit()
    return {"removed": True}
