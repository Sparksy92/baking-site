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
from app.services.back_in_stock_service import notify_back_in_stock

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
            """INSERT INTO products (name, slug, description, category_id, is_active, is_featured, sort_order, weight_g, meta_title, meta_description)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (body.name, body.slug, body.description, body.category_id,
             int(body.is_active), int(body.is_featured), body.sort_order, body.weight_g,
             body.meta_title, body.meta_description),
        )
        await db.commit()
        return {"id": cursor.lastrowid, "slug": body.slug}
    except aiosqlite.IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product slug already exists")


@router.get("/{product_id}")
async def get_product(
    product_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Get a single product with its variants and images."""
    cursor = await db.execute(
        """SELECT p.*, c.name as category_name
           FROM products p
           LEFT JOIN categories c ON c.id = p.category_id
           WHERE p.id = ?""",
        (product_id,),
    )
    product = await cursor.fetchone()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    result = dict(product)

    # Variants
    cursor = await db.execute(
        "SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id",
        (product_id,),
    )
    result["variants"] = [dict(r) for r in await cursor.fetchall()]

    # Images
    cursor = await db.execute(
        "SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order",
        (product_id,),
    )
    result["images"] = [dict(r) for r in await cursor.fetchall()]

    # Tags
    cursor = await db.execute(
        """SELECT t.id, t.name FROM tags t
           JOIN product_tags pt ON pt.tag_id = t.id
           WHERE pt.product_id = ?
           ORDER BY t.name""",
        (product_id,),
    )
    result["tags"] = [dict(r) for r in await cursor.fetchall()]

    return result


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
    """Soft-delete a product (deactivate). Hard-delete only if no orders reference it."""
    cursor = await db.execute(
        "SELECT COUNT(*) FROM order_items WHERE product_id = ?", (product_id,)
    )
    order_count = (await cursor.fetchone())[0]

    if order_count > 0:
        await db.execute(
            "UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?",
            (product_id,),
        )
        await db.commit()
        return {"deleted": False, "deactivated": True, "reason": "Product has existing orders"}

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
    variant_id = cursor.lastrowid
    cursor = await db.execute("SELECT * FROM product_variants WHERE id = ?", (variant_id,))
    row = await cursor.fetchone()
    return dict(row)


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

    # Check if restocking (was 0, now > 0) for back-in-stock notifications
    trigger_back_in_stock = False
    if "stock_quantity" in updates and updates["stock_quantity"] > 0:
        cursor = await db.execute(
            "SELECT stock_quantity FROM product_variants WHERE id = ? AND product_id = ?",
            (variant_id, product_id),
        )
        current = await cursor.fetchone()
        if current and current["stock_quantity"] == 0:
            trigger_back_in_stock = True

    if "is_active" in updates:
        updates["is_active"] = int(updates["is_active"])

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [variant_id, product_id]

    await db.execute(
        f"UPDATE product_variants SET {set_clause}, updated_at = datetime('now') WHERE id = ? AND product_id = ?",
        values,
    )
    await db.commit()

    # Fire back-in-stock notifications if restocked
    if trigger_back_in_stock:
        try:
            await notify_back_in_stock(db, variant_id)
        except Exception:
            logger.exception("Back-in-stock notification failed for variant %d", variant_id)

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

@router.get("/{product_id}/images")
async def list_images(
    product_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List all images for a product, ordered by sort_order."""
    cursor = await db.execute(
        "SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order",
        (product_id,),
    )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


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


@router.patch("/{product_id}/images/{image_id}/primary")
async def set_primary_image(
    product_id: int,
    image_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Set an image as the primary image for a product."""
    # Verify image exists
    cursor = await db.execute(
        "SELECT id FROM product_images WHERE id = ? AND product_id = ?", (image_id, product_id)
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    # Clear existing primary
    await db.execute(
        "UPDATE product_images SET is_primary = 0 WHERE product_id = ?", (product_id,)
    )
    # Set new primary
    await db.execute(
        "UPDATE product_images SET is_primary = 1 WHERE id = ? AND product_id = ?", (image_id, product_id)
    )
    await db.commit()
    return {"primary": True}


@router.patch("/{product_id}/images/reorder")
async def reorder_images(
    product_id: int,
    body: dict,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Reorder product images. Body: {"image_ids": [3, 1, 2]}"""
    image_ids = body.get("image_ids", [])
    if not image_ids or not isinstance(image_ids, list):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="image_ids list required")

    for sort_order, img_id in enumerate(image_ids):
        await db.execute(
            "UPDATE product_images SET sort_order = ? WHERE id = ? AND product_id = ?",
            (sort_order, img_id, product_id),
        )
    await db.commit()
    return {"reordered": True}


@router.patch("/{product_id}/images/{image_id}")
async def update_image(
    product_id: int,
    image_id: int,
    body: dict,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Update image metadata (variant_id, alt_text)."""
    allowed = {"variant_id", "alt_text"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid fields to update")

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [image_id, product_id]
    await db.execute(
        f"UPDATE product_images SET {set_clause} WHERE id = ? AND product_id = ?",
        values,
    )
    await db.commit()
    return {"updated": True}


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
