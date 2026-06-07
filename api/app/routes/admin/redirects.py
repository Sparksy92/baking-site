from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from app.database import PostgresConnection
from pydantic import BaseModel, Field

from app.auth import require_admin
from app.database import get_db

router = APIRouter(prefix="/admin/redirects", tags=["admin-redirects"])


class RedirectCreate(BaseModel):
    from_path: str = Field(min_length=1, max_length=500)
    to_path: str = Field(min_length=1, max_length=500)
    status_code: int = 301


class RedirectUpdate(BaseModel):
    to_path: str | None = None
    status_code: int | None = None
    is_active: bool | None = None


@router.get("")
async def list_redirects(
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute(
        "SELECT * FROM redirects ORDER BY created_at DESC"
    )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_redirect(
    body: RedirectCreate,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    if body.status_code not in (301, 302, 307, 308):
        raise HTTPException(status_code=400, detail="status_code must be 301, 302, 307, or 308")
    try:
        cursor = await db.execute(
            "INSERT INTO redirects (from_path, to_path, status_code) VALUES (?, ?, ?)",
            (body.from_path, body.to_path, body.status_code),
        )
        new_id = cursor.lastrowid
        await db.commit()
        row_cur = await db.execute("SELECT * FROM redirects WHERE id = ?", (new_id,))
        row = await row_cur.fetchone()
        return dict(row)
    except Exception:
        raise HTTPException(status_code=409, detail="A redirect from this path already exists")


@router.get("/export")
async def export_redirects_alias(
    db: PostgresConnection = Depends(get_db),
):
    """Export all active redirects — alias kept for backwards compat."""
    cursor = await db.execute(
        "SELECT from_path, to_path, status_code FROM redirects WHERE is_active = true ORDER BY from_path"
    )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.get("/{redirect_id}")
async def get_redirect(
    redirect_id: int,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT * FROM redirects WHERE id = ?", (redirect_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Redirect not found")
    return dict(row)


@router.patch("/{redirect_id}")
async def update_redirect(
    redirect_id: int,
    body: RedirectUpdate,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [redirect_id]
    await db.execute(
        f"UPDATE redirects SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        values,
    )
    await db.commit()
    return {"updated": True}


@router.delete("/{redirect_id}")
async def delete_redirect(
    redirect_id: int,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    result = await db.execute("DELETE FROM redirects WHERE id = ?", (redirect_id,))
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Redirect not found")
    return {"deleted": True}
