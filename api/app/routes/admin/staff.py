"""Admin staff management — roles and permissions."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import aiosqlite

from app.auth import require_admin, hash_password, create_access_token
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/staff", tags=["admin-staff"])

VALID_PERMISSIONS = {"products", "orders", "collections", "categories", "promos", "settings", "customers", "reports"}


class StaffInvite(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=8, max_length=200)
    display_name: str | None = None
    permissions: str = Field(default="all")  # 'all' or comma-separated: 'orders,products'


class StaffUpdate(BaseModel):
    display_name: str | None = None
    permissions: str | None = None
    is_active: bool | None = None


def _validate_permissions(perms: str) -> bool:
    if perms == "all":
        return True
    parts = {p.strip() for p in perms.split(",")}
    return parts.issubset(VALID_PERMISSIONS)


@router.get("")
async def list_staff(
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List all staff members."""
    cursor = await db.execute(
        "SELECT id, username, display_name, role, permissions, created_at FROM admin_users ORDER BY created_at"
    )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
async def invite_staff(
    body: StaffInvite,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Create a new staff member with specific permissions.

    Only 'owner' role can create staff. Admins cannot create other admins.
    """
    if user.get("role") != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners can manage staff",
        )

    if not _validate_permissions(body.permissions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid permissions. Valid: {', '.join(sorted(VALID_PERMISSIONS))} or 'all'",
        )

    hashed = hash_password(body.password)
    try:
        cursor = await db.execute(
            """INSERT INTO admin_users (username, password_hash, display_name, role, permissions)
               VALUES (?, ?, ?, 'admin', ?)""",
            (body.username, hashed, body.display_name or body.username, body.permissions),
        )
        await db.commit()
    except aiosqlite.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )

    return {"id": cursor.lastrowid, "username": body.username}


@router.patch("/{staff_id}")
async def update_staff(
    staff_id: int,
    body: StaffUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Update a staff member's permissions or status."""
    if user.get("role") != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners can manage staff",
        )

    cursor = await db.execute("SELECT id FROM admin_users WHERE id = ?", (staff_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff not found")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    if "permissions" in updates and not _validate_permissions(updates["permissions"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid permissions. Valid: {', '.join(sorted(VALID_PERMISSIONS))} or 'all'",
        )

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [staff_id]

    await db.execute(f"UPDATE admin_users SET {set_clause} WHERE id = ?", values)
    await db.commit()

    return {"updated": True}


@router.delete("/{staff_id}")
async def remove_staff(
    staff_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Remove a staff member. Cannot remove yourself."""
    if user.get("role") != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners can manage staff",
        )

    # Prevent self-deletion
    cursor = await db.execute(
        "SELECT username FROM admin_users WHERE id = ?", (staff_id,)
    )
    staff = await cursor.fetchone()
    if not staff:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff not found")

    if staff["username"] == user.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove yourself",
        )

    await db.execute("DELETE FROM admin_users WHERE id = ?", (staff_id,))
    await db.commit()
    return {"deleted": True}
