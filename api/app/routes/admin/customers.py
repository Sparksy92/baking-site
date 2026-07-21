"""Admin customer management."""
from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.auth import require_admin
from app.database import PostgresConnection, get_db
from app.services.customer_password_service import create_and_send_password_reset

router = APIRouter(prefix="/admin/customers", tags=["admin-customers"])

CUSTOMER_TYPES = {"registered", "guest", "newsletter_only", "wholesale", "admin_created", "imported", "test"}
MARKETING_STATUSES = {"subscribed", "unsubscribed", "non_subscribed", "suppressed", "bounced"}


class CustomerAdminUpdate(BaseModel):
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    phone: str | None = None
    customer_type: str | None = None
    marketing_email_status: str | None = None
    marketing_email_source: str | None = None
    internal_note: str | None = None


class CustomerTagsUpdate(BaseModel):
    tags: list[str] = Field(default_factory=list)


class CustomerNoteCreate(BaseModel):
    note: str = Field(min_length=1, max_length=4000)


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "tag"


async def _customer_exists(db: PostgresConnection, customer_id: int):
    cursor = await db.execute("SELECT id, email FROM customers WHERE id = ?", (customer_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return row


def _filters(
    q: str | None,
    customer_type: str | None,
    marketing_status: str | None,
    is_active: bool | None,
) -> tuple[str, list]:
    conditions = []
    params: list = []
    if q:
        conditions.append(
            "(c.email ILIKE ? OR c.first_name ILIKE ? OR c.last_name ILIKE ? OR c.phone ILIKE ?)"
        )
        term = f"%{q}%"
        params.extend([term, term, term, term])
    if customer_type:
        conditions.append("c.customer_type = ?")
        params.append(customer_type)
    if marketing_status:
        conditions.append("c.marketing_email_status = ?")
        params.append(marketing_status)
    if is_active is not None:
        conditions.append("c.is_active = ?")
        params.append(1 if is_active else 0)
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    return where, params


@router.get("")
async def list_customers(
    q: str | None = Query(None),
    customer_type: str | None = Query(None),
    marketing_status: str | None = Query(None),
    is_active: bool | None = Query(None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List customers with admin-facing account and marketing summary fields."""
    where, params = _filters(q, customer_type, marketing_status, is_active)
    offset = (page - 1) * limit

    cursor = await db.execute(f"SELECT COUNT(*) FROM customers c {where}", params)
    total = (await cursor.fetchone())[0]

    cursor = await db.execute(
        f"""
        SELECT c.id, c.email, c.first_name, c.last_name, c.phone, c.is_active,
               c.customer_type, c.marketing_email_status, c.created_source,
               c.last_login, c.created_at,
               COALESCE(os.order_count, 0) AS order_count,
               COALESCE(os.lifetime_spend_cents, 0) AS lifetime_spend_cents,
               os.last_order_at,
               COALESCE(STRING_AGG(ct.name, ','), '') AS tags
        FROM customers c
        LEFT JOIN (
            SELECT customer_id, COUNT(*) AS order_count, SUM(total_cents) AS lifetime_spend_cents,
                   MAX(created_at) AS last_order_at
            FROM orders
            WHERE customer_id IS NOT NULL
            GROUP BY customer_id
        ) os ON os.customer_id = c.id
        LEFT JOIN customer_tag_members ctm ON ctm.customer_id = c.id
        LEFT JOIN customer_tags ct ON ct.id = ctm.tag_id
        {where}
        GROUP BY c.id, os.order_count, os.lifetime_spend_cents, os.last_order_at
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
        """,
        params + [limit, offset],
    )
    rows = []
    for row in await cursor.fetchall():
        item = dict(row)
        item["tags"] = [tag for tag in item["tags"].split(",") if tag]
        rows.append(item)

    return {"customers": rows, "total": total, "page": page, "limit": limit}


@router.get("/export")
async def export_customers(
    q: str | None = Query(None),
    customer_type: str | None = Query(None),
    marketing_status: str | None = Query(None),
    is_active: bool | None = Query(None),
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Export customers for CSV-based marketing workflows."""
    where, params = _filters(q, customer_type, marketing_status, is_active)
    cursor = await db.execute(
        f"""
        SELECT c.email, c.first_name, c.last_name, c.phone, c.customer_type,
               c.marketing_email_status, c.marketing_email_source,
               c.marketing_email_consented_at, c.is_active, c.created_at,
               COALESCE(os.order_count, 0) AS order_count,
               COALESCE(os.lifetime_spend_cents, 0) AS lifetime_spend_cents
        FROM customers c
        LEFT JOIN (
            SELECT customer_id, COUNT(*) AS order_count, SUM(total_cents) AS lifetime_spend_cents
            FROM orders
            WHERE customer_id IS NOT NULL
            GROUP BY customer_id
        ) os ON os.customer_id = c.id
        {where}
        ORDER BY c.created_at DESC
        """,
        params,
    )
    rows = await cursor.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "email", "first_name", "last_name", "phone", "customer_type",
        "marketing_email_status", "marketing_email_source", "marketing_email_consented_at",
        "is_active", "created_at", "order_count", "lifetime_spend_cents",
    ])
    for row in rows:
        writer.writerow([row[key] for key in [
            "email", "first_name", "last_name", "phone", "customer_type",
            "marketing_email_status", "marketing_email_source", "marketing_email_consented_at",
            "is_active", "created_at", "order_count", "lifetime_spend_cents",
        ]])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=customers.csv"},
    )


@router.get("/{customer_id}")
async def get_customer(
    customer_id: int,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute(
        """
        SELECT c.*,
               COALESCE(os.order_count, 0) AS order_count,
               COALESCE(os.lifetime_spend_cents, 0) AS lifetime_spend_cents,
               os.last_order_at
        FROM customers c
        LEFT JOIN (
            SELECT customer_id, COUNT(*) AS order_count, SUM(total_cents) AS lifetime_spend_cents,
                   MAX(created_at) AS last_order_at
            FROM orders
            WHERE customer_id = ?
            GROUP BY customer_id
        ) os ON os.customer_id = c.id
        WHERE c.id = ?
        """,
        (customer_id, customer_id),
    )
    customer = await cursor.fetchone()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    cursor = await db.execute(
        "SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC",
        (customer_id,),
    )
    addresses = [dict(r) for r in await cursor.fetchall()]

    cursor = await db.execute(
        """SELECT id, order_number, status, payment_status, total_cents, created_at
           FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20""",
        (customer_id,),
    )
    orders = [dict(r) for r in await cursor.fetchall()]

    cursor = await db.execute(
        """SELECT cs.id, cs.name, cs.slug
           FROM customer_segment_members csm
           JOIN customer_segments cs ON cs.id = csm.segment_id
           WHERE csm.customer_id = ?
           ORDER BY cs.name""",
        (customer_id,),
    )
    segments = [dict(r) for r in await cursor.fetchall()]

    cursor = await db.execute(
        """SELECT ct.name
           FROM customer_tag_members ctm
           JOIN customer_tags ct ON ct.id = ctm.tag_id
           WHERE ctm.customer_id = ?
           ORDER BY ct.name""",
        (customer_id,),
    )
    tags = [r["name"] for r in await cursor.fetchall()]

    cursor = await db.execute(
        """SELECT id, amount_cents, balance_after_cents, reason, order_id, issued_by, created_at
           FROM store_credit_transactions
           WHERE customer_id = ?
           ORDER BY created_at DESC LIMIT 20""",
        (customer_id,),
    )
    store_credit_transactions = [dict(r) for r in await cursor.fetchall()]

    cursor = await db.execute(
        """SELECT id, points, reason, order_id, created_at
           FROM loyalty_transactions
           WHERE customer_id = ?
           ORDER BY created_at DESC LIMIT 20""",
        (customer_id,),
    )
    loyalty_transactions = [dict(r) for r in await cursor.fetchall()]

    cursor = await db.execute(
        """SELECT id, status, source, created_by, created_at
           FROM customer_consent_events
           WHERE customer_id = ?
           ORDER BY created_at DESC LIMIT 20""",
        (customer_id,),
    )
    consent_events = [dict(r) for r in await cursor.fetchall()]

    cursor = await db.execute(
        """SELECT id, note, created_by, created_at
           FROM customer_notes
           WHERE customer_id = ?
           ORDER BY created_at DESC LIMIT 20""",
        (customer_id,),
    )
    notes = [dict(r) for r in await cursor.fetchall()]

    return {
        "customer": dict(customer),
        "addresses": addresses,
        "orders": orders,
        "segments": segments,
        "tags": tags,
        "store_credit_transactions": store_credit_transactions,
        "loyalty_transactions": loyalty_transactions,
        "consent_events": consent_events,
        "notes": notes,
    }


@router.patch("/{customer_id}")
async def update_customer(
    customer_id: int,
    body: CustomerAdminUpdate,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    customer = await _customer_exists(db, customer_id)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}

    if "customer_type" in updates and updates["customer_type"] not in CUSTOMER_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid customer type")
    if "marketing_email_status" in updates and updates["marketing_email_status"] not in MARKETING_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid marketing status")

    marketing_changed = "marketing_email_status" in updates
    if marketing_changed and updates["marketing_email_status"] == "subscribed":
        updates["marketing_email_consented_at"] = datetime.now(timezone.utc).isoformat()
        updates.setdefault("marketing_email_source", "admin")

    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    await db.execute(
        f"UPDATE customers SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        list(updates.values()) + [customer_id],
    )

    if marketing_changed:
        await db.execute(
            """INSERT INTO customer_consent_events (customer_id, email, status, source, created_by)
               VALUES (?, ?, ?, ?, ?)""",
            (
                customer_id,
                customer["email"],
                updates["marketing_email_status"],
                updates.get("marketing_email_source") or "admin",
                user["sub"],
            ),
        )
        if updates["marketing_email_status"] == "subscribed":
            await db.execute(
                """INSERT INTO newsletter_subscribers (email, is_active, source)
                   VALUES (?, 1, ?)
                   ON CONFLICT (email) DO UPDATE SET is_active = TRUE, source = EXCLUDED.source""",
                (customer["email"], updates.get("marketing_email_source") or "admin"),
            )
        elif updates["marketing_email_status"] in {"unsubscribed", "suppressed", "bounced"}:
            await db.execute(
                "UPDATE newsletter_subscribers SET is_active = FALSE WHERE LOWER(email) = LOWER(?)",
                (customer["email"],),
            )

    await db.commit()
    return {"updated": True}


@router.post("/{customer_id}/activate")
async def activate_customer(
    customer_id: int,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    await _customer_exists(db, customer_id)
    await db.execute("UPDATE customers SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (customer_id,))
    await db.commit()
    return {"active": True}


@router.post("/{customer_id}/deactivate")
async def deactivate_customer(
    customer_id: int,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    await _customer_exists(db, customer_id)
    await db.execute("UPDATE customers SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (customer_id,))
    await db.commit()
    return {"active": False}


@router.post("/{customer_id}/password-reset")
async def create_password_reset(
    customer_id: int,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    customer = await _customer_exists(db, customer_id)
    cursor = await db.execute("SELECT first_name FROM customers WHERE id = ?", (customer_id,))
    profile = await cursor.fetchone()
    result = await create_and_send_password_reset(
        db,
        customer_id=customer_id,
        email=customer["email"],
        first_name=profile["first_name"] if profile else "Customer",
        source="admin",
        created_by=user["sub"],
    )
    await db.commit()
    return {
        "email_sent": result["email_sent"],
        "email_error": result["email_error"],
        "expires_at": result["expires_at"],
        "reset_url": result["reset_url"],
    }


@router.put("/{customer_id}/tags")
async def replace_tags(
    customer_id: int,
    body: CustomerTagsUpdate,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    await _customer_exists(db, customer_id)
    clean_tags = []
    seen = set()
    for tag in body.tags:
        name = tag.strip()
        slug = _slugify(name)
        if name and slug not in seen:
            clean_tags.append((name, slug))
            seen.add(slug)

    await db.execute("DELETE FROM customer_tag_members WHERE customer_id = ?", (customer_id,))
    for name, slug in clean_tags:
        await db.execute(
            "INSERT INTO customer_tags (name, slug) VALUES (?, ?) ON CONFLICT (slug) DO NOTHING",
            (name, slug),
        )
        cursor = await db.execute("SELECT id FROM customer_tags WHERE slug = ?", (slug,))
        tag_row = await cursor.fetchone()
        if tag_row:
            await db.execute(
                "INSERT INTO customer_tag_members (customer_id, tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
                (customer_id, tag_row["id"]),
            )
    await db.commit()
    return {"tags": [name for name, _ in clean_tags]}


@router.post("/{customer_id}/notes", status_code=status.HTTP_201_CREATED)
async def add_note(
    customer_id: int,
    body: CustomerNoteCreate,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    await _customer_exists(db, customer_id)
    cursor = await db.execute(
        "INSERT INTO customer_notes (customer_id, note, created_by) VALUES (?, ?, ?)",
        (customer_id, body.note, user["sub"]),
    )
    await db.commit()
    return {"id": cursor.lastrowid, "note": body.note}
