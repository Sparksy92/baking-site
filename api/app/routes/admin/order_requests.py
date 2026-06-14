from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.database import PostgresConnection, get_db
from app.auth import require_admin
from app.models.schemas import OrderRequestResponse, OrderRequestUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/order-requests", tags=["admin-order-requests"])


@router.get("", response_model=dict)
async def list_order_requests(
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List order requests with status filtering and pagination, sorted newest first."""
    offset = (page - 1) * limit
    conditions = []
    params = []

    if status_filter:
        conditions.append("status = ?")
        params.append(status_filter)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    # Get total count
    count_cursor = await db.execute(f"SELECT COUNT(*) FROM order_requests {where_clause}", params)
    total = (await count_cursor.fetchone())[0]

    # Get rows sorted newest first
    cursor = await db.execute(
        f"SELECT * FROM order_requests {where_clause} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        params + [limit, offset]
    )
    rows = await cursor.fetchall()

    requests_list = []
    for row in rows:
        req_dict = dict(row)
        # Handle JSONB/string parsing of requested_items
        req_items_raw = req_dict.get("requested_items")
        if isinstance(req_items_raw, str):
            req_dict["requested_items"] = json.loads(req_items_raw)
        requests_list.append(req_dict)

    return {"order_requests": requests_list, "total": total, "page": page}


@router.get("/{id}", response_model=OrderRequestResponse)
async def get_order_request(
    id: int,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Get details of a single order request."""
    cursor = await db.execute("SELECT * FROM order_requests WHERE id = ?", (id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order request with ID {id} not found."
        )

    req_dict = dict(row)
    req_items_raw = req_dict.get("requested_items")
    if isinstance(req_items_raw, str):
        req_dict["requested_items"] = json.loads(req_items_raw)

    return req_dict


@router.patch("/{id}", response_model=OrderRequestResponse)
async def update_order_request(
    id: int,
    body: OrderRequestUpdate,
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Update order request status and/or admin notes."""
    cursor = await db.execute("SELECT * FROM order_requests WHERE id = ?", (id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order request with ID {id} not found."
        )

    updates = []
    params = []

    if body.status is not None:
        updates.append("status = ?")
        params.append(body.status)

    if body.admin_notes is not None:
        updates.append("admin_notes = ?")
        params.append(body.admin_notes)

    if not updates:
        # Nothing to update, just return the existing record
        req_dict = dict(row)
        req_items_raw = req_dict.get("requested_items")
        if isinstance(req_items_raw, str):
            req_dict["requested_items"] = json.loads(req_items_raw)
        return req_dict

    # Set updated_at manually to current timestamp
    now = datetime.now(timezone.utc)
    updates.append("updated_at = ?")
    params.append(now)
    params.append(id)

    # Perform the update
    set_clause = ", ".join(updates)
    await db.execute(
        f"UPDATE order_requests SET {set_clause} WHERE id = ?",
        params
    )

    # Fetch updated record
    cursor = await db.execute("SELECT * FROM order_requests WHERE id = ?", (id,))
    updated_row = await cursor.fetchone()
    req_dict = dict(updated_row)
    req_items_raw = req_dict.get("requested_items")
    if isinstance(req_items_raw, str):
        req_dict["requested_items"] = json.loads(req_items_raw)

    return req_dict
