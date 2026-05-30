"""Admin customer segment management."""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import aiosqlite

from app.auth import require_admin
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/segments", tags=["admin-segments"])


class SegmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200)
    description: str | None = None
    rules_json: str | None = None  # JSON string with rules
    is_auto: bool = False


class SegmentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    rules_json: str | None = None
    is_auto: bool | None = None


@router.get("")
async def list_segments(
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("""
        SELECT cs.*, COUNT(csm.customer_id) as member_count
        FROM customer_segments cs
        LEFT JOIN customer_segment_members csm ON csm.segment_id = cs.id
        GROUP BY cs.id
        ORDER BY cs.name
    """)
    return [dict(r) for r in await cursor.fetchall()]


@router.get("/{segment_id}")
async def get_segment(
    segment_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT * FROM customer_segments WHERE id = ?", (segment_id,))
    seg = await cursor.fetchone()
    if not seg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")

    cursor = await db.execute("""
        SELECT c.id, c.email, c.first_name, c.last_name
        FROM customer_segment_members csm
        JOIN customers c ON c.id = csm.customer_id
        WHERE csm.segment_id = ?
        ORDER BY csm.added_at DESC
    """, (segment_id,))
    members = [dict(r) for r in await cursor.fetchall()]

    result = dict(seg)
    result["members"] = members
    return result


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_segment(
    body: SegmentCreate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    # Validate JSON rules if provided
    if body.rules_json:
        try:
            json.loads(body.rules_json)
        except json.JSONDecodeError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid rules JSON")

    try:
        cursor = await db.execute(
            """INSERT INTO customer_segments (name, slug, description, rules_json, is_auto)
               VALUES (?, ?, ?, ?, ?)""",
            (body.name, body.slug, body.description, body.rules_json, int(body.is_auto)),
        )
        await db.commit()
    except aiosqlite.IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already exists")

    return {"id": cursor.lastrowid, "name": body.name}


@router.patch("/{segment_id}")
async def update_segment(
    segment_id: int,
    body: SegmentUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT id FROM customer_segments WHERE id = ?", (segment_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")

    updates = {}
    for k, v in body.model_dump().items():
        if v is not None:
            updates[k] = int(v) if k == "is_auto" else v

    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields")

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [segment_id]
    await db.execute(
        f"UPDATE customer_segments SET {set_clause}, updated_at = datetime('now') WHERE id = ?", values
    )
    await db.commit()
    return {"updated": True}


@router.delete("/{segment_id}")
async def delete_segment(
    segment_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT id FROM customer_segments WHERE id = ?", (segment_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")

    await db.execute("DELETE FROM customer_segments WHERE id = ?", (segment_id,))
    await db.commit()
    return {"deleted": True}


@router.post("/{segment_id}/members/{customer_id}", status_code=status.HTTP_201_CREATED)
async def add_member(
    segment_id: int,
    customer_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    try:
        await db.execute(
            "INSERT INTO customer_segment_members (segment_id, customer_id) VALUES (?, ?)",
            (segment_id, customer_id),
        )
        await db.commit()
    except aiosqlite.IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already a member")
    return {"added": True}


@router.delete("/{segment_id}/members/{customer_id}")
async def remove_member(
    segment_id: int,
    customer_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    result = await db.execute(
        "DELETE FROM customer_segment_members WHERE segment_id = ? AND customer_id = ?",
        (segment_id, customer_id),
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    return {"removed": True}
