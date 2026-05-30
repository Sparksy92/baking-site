"""Admin CSV import/export for products and variants."""
from __future__ import annotations

import csv
import io
import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
import aiosqlite

from app.auth import require_admin
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/products", tags=["admin-csv"])

CSV_EXPORT_HEADERS = [
    "product_name", "product_slug", "description", "category_id",
    "is_active", "is_featured", "sort_order",
    "variant_size", "variant_color", "variant_color_hex",
    "price_cents", "compare_at_price_cents", "sku", "stock_quantity",
    "variant_is_active",
]


@router.get("/export.csv")
async def export_products_csv(
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Export all products and variants as CSV."""
    cursor = await db.execute("""
        SELECT p.name as product_name, p.slug as product_slug, p.description,
               p.category_id, p.is_active, p.is_featured, p.sort_order,
               pv.size as variant_size, pv.color as variant_color,
               pv.color_hex as variant_color_hex, pv.price_cents,
               pv.compare_at_price_cents, pv.sku, pv.stock_quantity,
               pv.is_active as variant_is_active
        FROM products p
        LEFT JOIN product_variants pv ON pv.product_id = p.id
        ORDER BY p.sort_order, p.name, pv.sort_order
    """)
    rows = await cursor.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_EXPORT_HEADERS)

    for row in rows:
        writer.writerow([row[h] for h in CSV_EXPORT_HEADERS])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=products_export.csv"},
    )


@router.post("/import.csv", status_code=status.HTTP_201_CREATED)
async def import_products_csv(
    file: UploadFile = File(...),
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Import products and variants from CSV.

    - If a product slug already exists, it's skipped (no upsert).
    - Creates product + variants in one pass.
    """
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # Handle BOM
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(text))

    # Validate headers
    required = {"product_name", "product_slug", "price_cents"}
    if not required.issubset(set(reader.fieldnames or [])):
        raise HTTPException(
            status_code=400,
            detail=f"CSV must contain columns: {', '.join(sorted(required))}",
        )

    created_products = 0
    created_variants = 0
    skipped_products = set()
    errors = []

    # Group rows by product slug
    products: dict[str, list[dict]] = {}
    for i, row in enumerate(reader, start=2):  # row 1 is header
        slug = (row.get("product_slug") or "").strip()
        if not slug:
            errors.append(f"Row {i}: missing product_slug")
            continue
        products.setdefault(slug, []).append(row)

    for slug, rows in products.items():
        # Check if product already exists
        cursor = await db.execute("SELECT id FROM products WHERE slug = ?", (slug,))
        existing = await cursor.fetchone()
        if existing:
            skipped_products.add(slug)
            continue

        first = rows[0]
        name = (first.get("product_name") or "").strip()
        if not name:
            errors.append(f"Product '{slug}': missing product_name")
            continue

        description = first.get("description") or None
        category_id = int(first["category_id"]) if first.get("category_id") else None
        is_active = int(first.get("is_active", "1") or "1")
        is_featured = int(first.get("is_featured", "0") or "0")
        sort_order = int(first.get("sort_order", "0") or "0")

        cursor = await db.execute(
            """INSERT INTO products (name, slug, description, category_id, is_active, is_featured, sort_order)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (name, slug, description, category_id, is_active, is_featured, sort_order),
        )
        product_id = cursor.lastrowid
        created_products += 1

        # Create variants
        for vi, row in enumerate(rows):
            price = row.get("price_cents")
            if not price:
                continue  # Skip rows without price (product-only row)

            try:
                price_cents = int(price)
            except ValueError:
                errors.append(f"Product '{slug}' variant {vi + 1}: invalid price_cents")
                continue

            size = (row.get("variant_size") or "").strip() or "One Size"
            color = (row.get("variant_color") or "").strip() or "Default"
            color_hex = row.get("variant_color_hex") or None
            compare_at = int(row["compare_at_price_cents"]) if row.get("compare_at_price_cents") else None
            sku = row.get("sku") or None
            stock = int(row.get("stock_quantity", "0") or "0")
            variant_active = int(row.get("variant_is_active", "1") or "1")

            await db.execute(
                """INSERT INTO product_variants
                   (product_id, size, color, color_hex, price_cents, compare_at_price_cents, sku, stock_quantity, is_active, sort_order)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (product_id, size, color, color_hex, price_cents, compare_at, sku, stock, variant_active, vi),
            )
            created_variants += 1

    await db.commit()

    return {
        "created_products": created_products,
        "created_variants": created_variants,
        "skipped_products": len(skipped_products),
        "errors": errors[:20],  # Cap error messages
    }
