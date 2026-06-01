from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
import aiosqlite

from app.auth import require_admin
from app.database import get_db
from app.models.schemas import CategoryCreate, CategoryUpdate

router = APIRouter(prefix="/admin/categories", tags=["admin-categories"])


@router.get("")
async def list_categories(
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List all categories (including inactive) for admin."""
    cursor = await db.execute("""
        SELECT c.*, COUNT(p.id) as product_count
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id
        GROUP BY c.id
        ORDER BY c.sort_order, c.name
    """)
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_category(
    body: CategoryCreate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Create a new category."""
    try:
        cursor = await db.execute(
            "INSERT INTO categories (name, slug, description, sort_order, is_active) VALUES (?, ?, ?, ?, ?)",
            (body.name, body.slug, body.description, body.sort_order, int(body.is_active)),
        )
        await db.commit()
        return {"id": cursor.lastrowid, "slug": body.slug}
    except aiosqlite.IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category slug already exists")


@router.get("/{category_id}")
async def get_category(
    category_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Get a single category by ID."""
    cursor = await db.execute("SELECT * FROM categories WHERE id = ?", (category_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return dict(row)


@router.patch("/{category_id}")
async def update_category(
    category_id: int,
    body: CategoryUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Update category fields."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    if "is_active" in updates:
        updates["is_active"] = int(updates["is_active"])

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [category_id]

    result = await db.execute(
        f"UPDATE categories SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        values,
    )
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    return {"updated": True}


@router.delete("/{category_id}")
async def delete_category(
    category_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Delete a category. Products in this category will have their category_id set to NULL."""
    # Check if category exists
    cursor = await db.execute("SELECT id FROM categories WHERE id = ?", (category_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    # Unlink products from this category
    await db.execute("UPDATE products SET category_id = NULL WHERE category_id = ?", (category_id,))
    await db.execute("DELETE FROM categories WHERE id = ?", (category_id,))
    await db.commit()
    return {"deleted": True}
