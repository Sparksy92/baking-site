from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
import aiosqlite

from app.auth import require_admin
from app.config import get_settings
from app.database import get_db
from app.models.schemas import (
    ProductCreate, ProductUpdate, VariantCreate, VariantUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/products", tags=["admin-products"])


@router.get("")
async def list_all_products(
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List all products (including inactive) for admin."""
    cursor = await db.execute("""
        SELECT p.*, c.name as category_name,
               (SELECT url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, sort_order LIMIT 1) as image_url,
               (SELECT SUM(stock_quantity) FROM product_variants WHERE product_id = p.id) as total_stock
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        ORDER BY p.sort_order, p.name
    """)
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_product(
    body: ProductCreate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Create a new product."""
    try:
        cursor = await db.execute(
            """INSERT INTO products (name, slug, description, category_id, is_active, is_featured, sort_order)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (body.name, body.slug, body.description, body.category_id,
             int(body.is_active), int(body.is_featured), body.sort_order),
        )
        await db.commit()
        return {"id": cursor.lastrowid, "slug": body.slug}
    except aiosqlite.IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product slug already exists")


@router.patch("/{product_id}")
async def update_product(
    product_id: int,
    body: ProductUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Update product fields."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    # Convert booleans to int for SQLite
    for k in ("is_active", "is_featured"):
        if k in updates:
            updates[k] = int(updates[k])

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [product_id]

    await db.execute(
        f"UPDATE products SET {set_clause}, updated_at = datetime('now') WHERE id = ?",
        values,
    )
    await db.commit()
    return {"updated": True}


@router.delete("/{product_id}")
async def delete_product(
    product_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Delete a product (cascades to variants, images)."""
    await db.execute("DELETE FROM products WHERE id = ?", (product_id,))
    await db.commit()
    return {"deleted": True}


# ── Variants ──────────────────────────────────────────────────

@router.post("/{product_id}/variants", status_code=status.HTTP_201_CREATED)
async def create_variant(
    product_id: int,
    body: VariantCreate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Add a variant to a product."""
    cursor = await db.execute(
        """INSERT INTO product_variants
           (product_id, size, color, color_hex, price_cents, compare_at_price_cents, sku, stock_quantity, is_active, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (product_id, body.size, body.color, body.color_hex, body.price_cents,
         body.compare_at_price_cents, body.sku, body.stock_quantity,
         int(body.is_active), body.sort_order),
    )
    await db.commit()
    return {"id": cursor.lastrowid}


@router.patch("/{product_id}/variants/{variant_id}")
async def update_variant(
    product_id: int,
    variant_id: int,
    body: VariantUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Update a variant."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    if "is_active" in updates:
        updates["is_active"] = int(updates["is_active"])

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [variant_id, product_id]

    await db.execute(
        f"UPDATE product_variants SET {set_clause}, updated_at = datetime('now') WHERE id = ? AND product_id = ?",
        values,
    )
    await db.commit()
    return {"updated": True}


@router.delete("/{product_id}/variants/{variant_id}")
async def delete_variant(
    product_id: int,
    variant_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    await db.execute("DELETE FROM product_variants WHERE id = ? AND product_id = ?", (variant_id, product_id))
    await db.commit()
    return {"deleted": True}


# ── Images ────────────────────────────────────────────────────

@router.post("/{product_id}/images", status_code=status.HTTP_201_CREATED)
async def upload_image(
    product_id: int,
    file: UploadFile = File(...),
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Upload a product image."""
    from PIL import Image
    import io
    import uuid

    settings = get_settings()
    uploads_dir = settings.uploads_dir
    uploads_dir.mkdir(parents=True, exist_ok=True)

    # Validate file size (10MB max)
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image must be under 10MB")

    # Validate image
    try:
        img = Image.open(io.BytesIO(contents))
        img.verify()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image file")

    # Save file
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "jpg"
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"

    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = uploads_dir / filename
    filepath.write_bytes(contents)

    # Check if first image (make primary)
    cursor = await db.execute(
        "SELECT COUNT(*) FROM product_images WHERE product_id = ?", (product_id,)
    )
    count = (await cursor.fetchone())[0]
    is_primary = 1 if count == 0 else 0

    url = f"/images/uploads/products/{filename}"
    cursor = await db.execute(
        "INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary) VALUES (?, ?, ?, ?, ?)",
        (product_id, url, file.filename, count, is_primary),
    )
    await db.commit()

    return {"id": cursor.lastrowid, "url": url}


@router.delete("/{product_id}/images/{image_id}")
async def delete_image(
    product_id: int,
    image_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    from pathlib import Path

    # Get image URL before deleting record
    cursor = await db.execute(
        "SELECT url FROM product_images WHERE id = ? AND product_id = ?", (image_id, product_id)
    )
    image = await cursor.fetchone()

    await db.execute("DELETE FROM product_images WHERE id = ? AND product_id = ?", (image_id, product_id))
    await db.commit()

    # Clean up file on disk
    if image and image["url"]:
        settings = get_settings()
        filename = image["url"].rsplit("/", 1)[-1]
        filepath = settings.uploads_dir / filename
        if filepath.is_file():
            filepath.unlink(missing_ok=True)
            logger.info("Deleted image file: %s", filepath)

    return {"deleted": True}
