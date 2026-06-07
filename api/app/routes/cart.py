"""Server-side cart persistence for abandoned cart recovery."""
from __future__ import annotations

import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from app.database import PostgresConnection

from app.customer_auth import get_optional_customer
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cart", tags=["cart"])

CART_COOKIE_NAME = "_cart_token"


class CartItemAdd(BaseModel):
    variant_id: int
    quantity: int = Field(gt=0, le=20)


class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=0, le=20)  # 0 = remove


class CartEmailCapture(BaseModel):
    email: EmailStr
    name: str | None = None


async def _get_or_create_cart(
    request: Request,
    response: Response,
    db: PostgresConnection,
    customer: dict | None,
) -> dict:
    """Get existing cart or create new one. Returns cart row."""
    cart_token = request.cookies.get(CART_COOKIE_NAME)

    if cart_token:
        cursor = await db.execute(
            "SELECT * FROM carts WHERE cart_token = ? AND status = 'active'",
            (cart_token,),
        )
        cart = await cursor.fetchone()
        if cart:
            return dict(cart)

    # Create new cart
    cart_token = str(uuid.uuid4())
    customer_id = int(customer["sub"]) if customer else None
    customer_email = customer.get("email") if customer else None

    cursor = await db.execute(
        """INSERT INTO carts (cart_token, customer_id, customer_email)
           VALUES (?, ?, ?)""",
        (cart_token, customer_id, customer_email),
    )
    await db.commit()

    response.set_cookie(
        CART_COOKIE_NAME, cart_token,
        httponly=True, samesite="lax", max_age=60 * 60 * 24 * 30,  # 30 days
    )

    cursor = await db.execute("SELECT * FROM carts WHERE id = ?", (cursor.lastrowid,))
    return dict(await cursor.fetchone())


@router.get("")
async def get_cart(
    request: Request,
    response: Response,
    db: PostgresConnection = Depends(get_db),
    customer: dict | None = Depends(get_optional_customer),
):
    """Get current cart contents with product details."""
    cart = await _get_or_create_cart(request, response, db, customer)

    cursor = await db.execute("""
        SELECT ci.id as item_id, ci.variant_id, ci.quantity,
               pv.size, pv.color, pv.price_cents, pv.stock_quantity,
               p.id as product_id, p.name as product_name, p.slug as product_slug,
               (SELECT url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, sort_order LIMIT 1) as image_url
        FROM cart_items ci
        JOIN product_variants pv ON pv.id = ci.variant_id
        JOIN products p ON p.id = pv.product_id
        WHERE ci.cart_id = ?
        ORDER BY ci.added_at
    """, (cart["id"],))
    items = await cursor.fetchall()

    subtotal = sum(i["price_cents"] * i["quantity"] for i in items)

    return {
        "cart_token": cart["cart_token"],
        "items": [dict(i) for i in items],
        "item_count": sum(i["quantity"] for i in items),
        "subtotal_cents": subtotal,
    }


@router.post("/items", status_code=status.HTTP_201_CREATED)
async def add_to_cart(
    body: CartItemAdd,
    request: Request,
    response: Response,
    db: PostgresConnection = Depends(get_db),
    customer: dict | None = Depends(get_optional_customer),
):
    """Add item to cart (or update quantity if already present)."""
    cart = await _get_or_create_cart(request, response, db, customer)

    # Verify variant exists and is in stock
    cursor = await db.execute(
        "SELECT id, stock_quantity FROM product_variants WHERE id = ? AND is_active = 1",
        (body.variant_id,),
    )
    variant = await cursor.fetchone()
    if not variant:
        # Debug why it's missing
        cursor_debug = await db.execute("SELECT * FROM product_variants WHERE id = ?", (body.variant_id,))
        debug_var = await cursor_debug.fetchone()
        logger.error(f"Variant 404 debug: variant_id={body.variant_id}, row={dict(debug_var) if debug_var else None}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    # Upsert: add or update quantity
    cursor = await db.execute(
        "SELECT id, quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?",
        (cart["id"], body.variant_id),
    )
    existing = await cursor.fetchone()

    if existing:
        new_qty = existing["quantity"] + body.quantity
        await db.execute(
            "UPDATE cart_items SET quantity = ? WHERE id = ?",
            (new_qty, existing["id"]),
        )
    else:
        await db.execute(
            "INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES (?, ?, ?)",
            (cart["id"], body.variant_id, body.quantity),
        )

    # Update cart activity + subtotal
    cursor = await db.execute(
        "SELECT SUM(ci.quantity * pv.price_cents) FROM cart_items ci JOIN product_variants pv ON pv.id = ci.variant_id WHERE ci.cart_id = ?",
        (cart["id"],),
    )
    subtotal = (await cursor.fetchone())[0] or 0
    await db.execute(
        "UPDATE carts SET subtotal_cents = ?, last_activity_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (subtotal, cart["id"]),
    )
    await db.commit()

    return {"added": True}


@router.patch("/items/{variant_id}")
async def update_cart_item(
    variant_id: int,
    body: CartItemUpdate,
    request: Request,
    response: Response,
    db: PostgresConnection = Depends(get_db),
    customer: dict | None = Depends(get_optional_customer),
):
    """Update quantity (0 = remove) of a cart item."""
    cart = await _get_or_create_cart(request, response, db, customer)

    if body.quantity == 0:
        await db.execute(
            "DELETE FROM cart_items WHERE cart_id = ? AND variant_id = ?",
            (cart["id"], variant_id),
        )
    else:
        await db.execute(
            "UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND variant_id = ?",
            (body.quantity, cart["id"], variant_id),
        )

    # Update subtotal
    cursor = await db.execute(
        "SELECT SUM(ci.quantity * pv.price_cents) FROM cart_items ci JOIN product_variants pv ON pv.id = ci.variant_id WHERE ci.cart_id = ?",
        (cart["id"],),
    )
    subtotal = (await cursor.fetchone())[0] or 0
    await db.execute(
        "UPDATE carts SET subtotal_cents = ?, last_activity_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (subtotal, cart["id"]),
    )
    await db.commit()

    return {"updated": True}


@router.post("/email")
async def capture_cart_email(
    body: CartEmailCapture,
    request: Request,
    response: Response,
    db: PostgresConnection = Depends(get_db),
    customer: dict | None = Depends(get_optional_customer),
):
    """Capture customer email early in checkout flow for abandoned cart recovery."""
    cart = await _get_or_create_cart(request, response, db, customer)

    await db.execute(
        "UPDATE carts SET customer_email = ?, customer_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (body.email, body.name, cart["id"]),
    )
    await db.commit()

    return {"captured": True}


@router.post("/convert")
async def mark_cart_converted(
    request: Request,
    db: PostgresConnection = Depends(get_db),
):
    """Mark cart as converted after successful checkout."""
    cart_token = request.cookies.get(CART_COOKIE_NAME)
    if cart_token:
        await db.execute(
            "UPDATE carts SET status = 'converted', updated_at = CURRENT_TIMESTAMP WHERE cart_token = ?",
            (cart_token,),
        )
        await db.commit()
    return {"converted": True}
