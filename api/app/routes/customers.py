from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from app.database import PostgresConnection

from app.config import get_settings
from app.customer_auth import (
    CUSTOMER_COOKIE_NAME,
    create_customer_token,
    get_current_customer,
    hash_password,
    verify_password,
    generate_reset_token,
)
from app.database import get_db
from app.models.schemas import (
    CustomerRegister,
    CustomerLogin,
    CustomerResponse,
    CustomerUpdate,
    CustomerPasswordChange,
    CustomerPasswordResetRequest,
    CustomerPasswordReset,
    AddressCreate,
    AddressUpdate,
    AddressResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/customers", tags=["customers"])


# ── Auth ────────────────────────────────────────────────────────

@router.post("/register", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: CustomerRegister,
    response: Response,
    db: PostgresConnection = Depends(get_db),
):
    """Register a new customer account."""
    # Check for existing email
    cursor = await db.execute(
        "SELECT id FROM customers WHERE email = ? COLLATE NOCASE", (body.email,)
    )
    if await cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    pw_hash = hash_password(body.password)
    cursor = await db.execute(
        """INSERT INTO customers (email, password_hash, first_name, last_name, phone)
           VALUES (?, ?, ?, ?, ?)""",
        (body.email.lower(), pw_hash, body.first_name, body.last_name, body.phone),
    )
    await db.commit()
    customer_id = cursor.lastrowid

    # Auto-login after registration
    settings = get_settings()
    token = create_customer_token(customer_id, body.email.lower(), body.first_name, settings)
    response.set_cookie(
        key=CUSTOMER_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=not settings.dev_mode,
        max_age=settings.customer_jwt_lifetime_hours * 3600,
        path="/",
    )

    return CustomerResponse(
        id=customer_id,
        email=body.email.lower(),
        first_name=body.first_name,
        last_name=body.last_name,
        phone=body.phone,
    )


@router.post("/login", response_model=CustomerResponse)
async def login(
    body: CustomerLogin,
    response: Response,
    db: PostgresConnection = Depends(get_db),
):
    """Authenticate a customer."""
    cursor = await db.execute(
        "SELECT * FROM customers WHERE email = ? COLLATE NOCASE AND is_active = 1",
        (body.email,),
    )
    customer = await cursor.fetchone()

    if not customer or not verify_password(body.password, customer["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    settings = get_settings()
    token = create_customer_token(
        customer["id"], customer["email"], customer["first_name"], settings
    )

    await db.execute(
        "UPDATE customers SET last_login = ? WHERE id = ?",
        (datetime.now(timezone.utc).isoformat(), customer["id"]),
    )
    await db.commit()

    response.set_cookie(
        key=CUSTOMER_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=not settings.dev_mode,
        max_age=settings.customer_jwt_lifetime_hours * 3600,
        path="/",
    )

    return CustomerResponse(
        id=customer["id"],
        email=customer["email"],
        first_name=customer["first_name"],
        last_name=customer["last_name"],
        phone=customer["phone"],
    )


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key=CUSTOMER_COOKIE_NAME, path="/")
    return {"detail": "Logged out"}


@router.get("/me", response_model=CustomerResponse)
async def me(
    db: PostgresConnection = Depends(get_db),
    customer: dict = Depends(get_current_customer),
):
    """Get current customer profile."""
    cursor = await db.execute("SELECT * FROM customers WHERE id = ?", (int(customer["sub"]),))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return CustomerResponse(
        id=row["id"],
        email=row["email"],
        first_name=row["first_name"],
        last_name=row["last_name"],
        phone=row["phone"],
    )


@router.patch("/me", response_model=CustomerResponse)
async def update_profile(
    body: CustomerUpdate,
    db: PostgresConnection = Depends(get_db),
    customer: dict = Depends(get_current_customer),
):
    """Update customer profile fields."""
    customer_id = int(customer["sub"])
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [customer_id]
    await db.execute(
        f"UPDATE customers SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        values,
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
    row = await cursor.fetchone()
    return CustomerResponse(
        id=row["id"],
        email=row["email"],
        first_name=row["first_name"],
        last_name=row["last_name"],
        phone=row["phone"],
    )


@router.post("/me/change-password")
async def change_password(
    body: CustomerPasswordChange,
    db: PostgresConnection = Depends(get_db),
    customer: dict = Depends(get_current_customer),
):
    """Change password for logged-in customer."""
    customer_id = int(customer["sub"])
    cursor = await db.execute("SELECT password_hash FROM customers WHERE id = ?", (customer_id,))
    row = await cursor.fetchone()
    if not row or not verify_password(body.current_password, row["password_hash"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    new_hash = hash_password(body.new_password)
    await db.execute(
        "UPDATE customers SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (new_hash, customer_id),
    )
    await db.commit()
    return {"detail": "Password updated"}


@router.post("/forgot-password")
async def forgot_password(
    body: CustomerPasswordResetRequest,
    db: PostgresConnection = Depends(get_db),
):
    """Request a password reset email."""
    cursor = await db.execute(
        "SELECT id, first_name FROM customers WHERE email = ? COLLATE NOCASE AND is_active = 1",
        (body.email,),
    )
    customer = await cursor.fetchone()

    # Always return success to prevent email enumeration
    if not customer:
        return {"detail": "If an account exists with that email, a reset link has been sent."}

    token = generate_reset_token()
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    await db.execute(
        "UPDATE customers SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?",
        (token, expires.isoformat(), customer["id"]),
    )
    await db.commit()

    # Send reset email
    try:
        from app.services.email_service import send_password_reset
        settings = get_settings()
        await send_password_reset(
            email=body.email,
            first_name=customer["first_name"],
            reset_url=f"{settings.store_domain}/account/reset-password?token={token}",
        )
    except Exception:
        logger.exception("Failed to send password reset email to %s", body.email)

    return {"detail": "If an account exists with that email, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(
    body: CustomerPasswordReset,
    db: PostgresConnection = Depends(get_db),
):
    """Reset password using a token from the forgot-password email."""
    cursor = await db.execute(
        "SELECT id, password_reset_expires FROM customers WHERE password_reset_token = ? AND is_active = 1",
        (body.token,),
    )
    customer = await cursor.fetchone()

    if not customer:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    if customer["password_reset_expires"]:
        expires = datetime.fromisoformat(customer["password_reset_expires"])
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token has expired")

    new_hash = hash_password(body.new_password)
    await db.execute(
        """UPDATE customers SET password_hash = ?, password_reset_token = NULL,
           password_reset_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?""",
        (new_hash, customer["id"]),
    )
    await db.commit()
    return {"detail": "Password has been reset. You can now log in."}


# ── Addresses ───────────────────────────────────────────────────

@router.get("/me/addresses", response_model=list[AddressResponse])
async def list_addresses(
    db: PostgresConnection = Depends(get_db),
    customer: dict = Depends(get_current_customer),
):
    customer_id = int(customer["sub"])
    cursor = await db.execute(
        "SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, id DESC",
        (customer_id,),
    )
    rows = await cursor.fetchall()
    return [AddressResponse(**dict(r)) for r in rows]


@router.post("/me/addresses", response_model=AddressResponse, status_code=status.HTTP_201_CREATED)
async def create_address(
    body: AddressCreate,
    db: PostgresConnection = Depends(get_db),
    customer: dict = Depends(get_current_customer),
):
    customer_id = int(customer["sub"])

    # If this is the first address or marked as default, clear other defaults
    if body.is_default:
        await db.execute(
            "UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?",
            (customer_id,),
        )

    # Auto-default if this is the first address
    cursor = await db.execute(
        "SELECT COUNT(*) FROM customer_addresses WHERE customer_id = ?", (customer_id,)
    )
    count = (await cursor.fetchone())[0]
    is_default = 1 if count == 0 or body.is_default else 0

    cursor = await db.execute(
        """INSERT INTO customer_addresses
           (customer_id, label, first_name, last_name, line1, line2, city, province, postal_code, country, phone, is_default)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            customer_id, body.label, body.first_name, body.last_name,
            body.line1, body.line2, body.city, body.province,
            body.postal_code, body.country, body.phone, is_default,
        ),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM customer_addresses WHERE id = ?", (cursor.lastrowid,))
    row = await cursor.fetchone()
    return AddressResponse(**dict(row))


@router.patch("/me/addresses/{address_id}", response_model=AddressResponse)
async def update_address(
    address_id: int,
    body: AddressUpdate,
    db: PostgresConnection = Depends(get_db),
    customer: dict = Depends(get_current_customer),
):
    customer_id = int(customer["sub"])
    cursor = await db.execute(
        "SELECT * FROM customer_addresses WHERE id = ? AND customer_id = ?",
        (address_id, customer_id),
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    # Handle default flag
    if updates.get("is_default"):
        await db.execute(
            "UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?",
            (customer_id,),
        )

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [address_id, customer_id]
    await db.execute(
        f"UPDATE customer_addresses SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND customer_id = ?",
        values,
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM customer_addresses WHERE id = ?", (address_id,))
    row = await cursor.fetchone()
    return AddressResponse(**dict(row))


@router.delete("/me/addresses/{address_id}")
async def delete_address(
    address_id: int,
    db: PostgresConnection = Depends(get_db),
    customer: dict = Depends(get_current_customer),
):
    customer_id = int(customer["sub"])
    cursor = await db.execute(
        "SELECT * FROM customer_addresses WHERE id = ? AND customer_id = ?",
        (address_id, customer_id),
    )
    addr = await cursor.fetchone()
    if not addr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")

    await db.execute("DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?", (address_id, customer_id))

    # If we deleted the default, promote the most recent remaining address
    if addr["is_default"]:
        await db.execute(
            """UPDATE customer_addresses SET is_default = 1
               WHERE id = (SELECT id FROM customer_addresses WHERE customer_id = ? ORDER BY id DESC LIMIT 1)""",
            (customer_id,),
        )

    await db.commit()
    return {"deleted": True}


# ── Order History ───────────────────────────────────────────────

@router.get("/me/orders")
async def list_orders(
    db: PostgresConnection = Depends(get_db),
    customer: dict = Depends(get_current_customer),
):
    """List all orders for the logged-in customer."""
    customer_id = int(customer["sub"])
    email = customer["email"]

    # Match by customer_id (linked) OR by email (guest orders placed before account creation)
    cursor = await db.execute(
        """SELECT * FROM orders
           WHERE customer_id = ? OR (customer_id IS NULL AND customer_email = ? COLLATE NOCASE)
           ORDER BY created_at DESC""",
        (customer_id, email),
    )
    rows = await cursor.fetchall()

    orders = []
    for r in rows:
        item_cursor = await db.execute(
            "SELECT * FROM order_items WHERE order_id = ?", (r["id"],)
        )
        items = await item_cursor.fetchall()
        orders.append({
            "order_number": r["order_number"],
            "status": r["status"],
            "payment_status": r["payment_status"],
            "total_cents": r["total_cents"],
            "tracking_number": r["tracking_number"],
            "tracking_carrier": r["tracking_carrier"],
            "created_at": r["created_at"],
            "item_count": sum(i["quantity"] for i in items),
        })

    return {"orders": orders}


@router.get("/me/orders/{order_number}")
async def get_order_detail(
    order_number: str,
    db: PostgresConnection = Depends(get_db),
    customer: dict = Depends(get_current_customer),
):
    """Get full order details for the logged-in customer. No email required."""
    customer_id = int(customer["sub"])
    email = customer["email"]

    cursor = await db.execute(
        """SELECT * FROM orders
           WHERE order_number = ?
             AND (customer_id = ? OR (customer_id IS NULL AND customer_email = ? COLLATE NOCASE))""",
        (order_number, customer_id, email),
    )
    order = await cursor.fetchone()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    cursor = await db.execute("SELECT * FROM order_items WHERE order_id = ?", (order["id"],))
    item_rows = await cursor.fetchall()

    return {
        "order_number": order["order_number"],
        "status": order["status"],
        "payment_status": order["payment_status"],
        "payment_method": order["payment_method"],
        "items": [
            {
                "product_name": item["product_name"],
                "variant_size": item["variant_size"],
                "variant_color": item["variant_color"],
                "quantity": item["quantity"],
                "unit_price_cents": item["unit_price_cents"],
                "line_total_cents": item["line_total_cents"],
            }
            for item in item_rows
        ],
        "subtotal_cents": order["subtotal_cents"],
        "discount_cents": order["discount_cents"],
        "shipping_cents": order["shipping_cents"],
        "tax_cents": order["tax_cents"],
        "total_cents": order["total_cents"],
        "promo_code": order["promo_code"],
        "tracking_number": order["tracking_number"],
        "tracking_carrier": order["tracking_carrier"],
        "created_at": order["created_at"],
    }
