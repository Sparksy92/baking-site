from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
import aiosqlite
import csv
import io

from app.auth import require_admin
from app.database import get_db

router = APIRouter(prefix="/admin/newsletter", tags=["admin-newsletter"])


@router.get("/subscribers")
async def list_subscribers(
    active_only: bool = True,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List newsletter subscribers with pagination."""
    offset = (page - 1) * limit
    condition = "WHERE is_active = 1" if active_only else ""

    cursor = await db.execute(f"SELECT COUNT(*) FROM newsletter_subscribers {condition}")
    row = await cursor.fetchone()
    total = row[0]

    cursor = await db.execute(
        f"SELECT id, email, is_active, source, created_at FROM newsletter_subscribers {condition} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (limit, offset),
    )
    rows = await cursor.fetchall()

    return {
        "subscribers": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/subscribers/export")
async def export_subscribers(
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Export active newsletter subscribers as CSV."""
    cursor = await db.execute(
        "SELECT email, source, created_at FROM newsletter_subscribers WHERE is_active = 1 ORDER BY created_at DESC"
    )
    rows = await cursor.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["email", "source", "subscribed_at"])
    for row in rows:
        writer.writerow([row["email"], row["source"], row["created_at"]])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=newsletter-subscribers.csv"},
    )
