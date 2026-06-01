from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import aiosqlite

from app.auth import require_admin
from app.database import get_db

router = APIRouter(prefix="/admin/settings", tags=["admin-settings"])


class SettingUpdate(BaseModel):
    key: str
    value: str


@router.get("")
async def get_all_settings(
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    cursor = await db.execute("SELECT * FROM settings ORDER BY key")
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.put("")
async def update_settings(
    updates: list[SettingUpdate],
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    for item in updates:
        await db.execute(
            "INSERT INTO settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP",
            (item.key, item.value, user["sub"]),
        )
    await db.commit()
    return {"updated": len(updates)}
