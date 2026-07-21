"""Admin Media Library — unified image/video upload with AI Vision naming.

Endpoints:
    POST   /api/admin/media/upload      Upload file → AI Vision → SEO filename + alt text
    GET    /api/admin/media             List library (pagination, search, tag filter)
    PATCH  /api/admin/media/{id}        Update alt_text or tags manually
    DELETE /api/admin/media/{id}        Delete file from disk + DB
"""
from __future__ import annotations
from typing import Annotated

import logging
import os
import uuid

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.config import get_settings
from app.database import PostgresConnection, get_db
from app.auth import require_admin
from app.services.ai_service import generate_image_metadata

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/media", tags=["admin-media"])

_RESPONSES = {400: {"description": "Bad Request"}, 404: {"description": "Not Found"}, 413: {"description": "Request Entity Too Large"}, 415: {"description": "Unsupported Media Type"}}

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm"}
MAX_IMAGE_BYTES = 20 * 1024 * 1024   # 20 MB
MAX_VIDEO_BYTES = 200 * 1024 * 1024  # 200 MB

UPLOAD_DIR = "./data/uploads/media"


def _upload_dir() -> str:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    return UPLOAD_DIR


class MediaUpdate(BaseModel):
    alt_text: str | None = None
    tags: list[str] | None = None


@router.post("/upload", responses=_RESPONSES)
async def upload_media(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    file: UploadFile = File(...),
):
    """Upload an image or video.

    On upload the file is:
    1. Validated (type + size)
    2. Read into memory
    3. Sent to GPT-4o Vision → returns SEO filename slug + alt text
    4. Saved as {slug}-{uuid8}.{ext}  (slug="" if vision unavailable → uuid-only name)
    5. Recorded in media_library_v2
    """
    import mimetypes
    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""

    if content_type in ALLOWED_IMAGE_TYPES:
        file_type = "image"
        max_size = MAX_IMAGE_BYTES
    elif content_type in ALLOWED_VIDEO_TYPES:
        file_type = "video"
        max_size = MAX_VIDEO_BYTES
    else:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported type '{content_type}'. Allowed: JPEG, PNG, WebP, GIF, MP4, MOV, WebM.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > max_size:
        raise HTTPException(status_code=413, detail=f"File too large. Max {max_size // (1024 * 1024)} MB.")

    ext = (file.filename or "upload").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp", "gif", "mp4", "mov", "webm"):
        ext = "jpg"
    if ext == "jpeg":
        ext = "jpg"

    uid = uuid.uuid4().hex[:8]
    alt_text = ""
    ai_generated = False

    if file_type == "image":
        meta = await generate_image_metadata(file_bytes, content_type)
        slug = meta.get("filename_slug") or ""
        alt_text = meta.get("alt_text") or ""
        ai_generated = bool(alt_text)
        filename = f"{slug}-{uid}.{ext}" if slug else f"{uid}.{ext}"
    else:
        filename = f"{uid}.{ext}"

    dest = os.path.join(_upload_dir(), filename)
    async with aiofiles.open(dest, "wb") as f:
        await f.write(file_bytes)

    settings = get_settings()
    url = f"{settings.store_domain.rstrip('/')}/media/{filename}"

    cursor = await db.execute(
        """INSERT INTO media_library_v2
           (filename, original_name, file_type, mime_type, size_bytes, url, alt_text, ai_generated_alt, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (filename, file.filename or filename, file_type, content_type,
         len(file_bytes), url, alt_text, ai_generated, user.get("username", "admin")),
    )
    await db.commit()

    cursor2 = await db.execute("SELECT * FROM media_library_v2 WHERE id = ?", (cursor.lastrowid,))
    row = await cursor2.fetchone()
    logger.info(f"Media uploaded: {filename} ({file_type}, {len(file_bytes)//1024}KB) ai_alt={ai_generated}")
    return dict(row)


@router.get("", responses=_RESPONSES)
async def list_media(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    page: int = Query(1, ge=1),
    per_page: int = Query(40, ge=1, le=200),
    search: str = Query("", description="Search filename or alt_text"),
    file_type: str = Query("", description="Filter by 'image' or 'video'"),
):
    """List media library with pagination, search and type filter."""
    offset = (page - 1) * per_page
    conditions = []
    params: list = []

    if search:
        conditions.append("(filename LIKE ? OR alt_text LIKE ? OR original_name LIKE ?)")
        like = f"%{search}%"
        params += [like, like, like]
    if file_type in ("image", "video"):
        conditions.append("file_type = ?")
        params.append(file_type)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    count_cursor = await db.execute(f"SELECT COUNT(*) FROM media_library_v2 {where}", params)
    total = (await count_cursor.fetchone())[0]

    params_page = params + [per_page, offset]
    cursor = await db.execute(
        f"SELECT * FROM media_library_v2 {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        params_page,
    )
    rows = await cursor.fetchall()
    return {
        "items": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
    }


@router.patch("/{media_id}", responses=_RESPONSES)
async def update_media(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    media_id: int,
    body: MediaUpdate,
):
    """Manually update alt_text and/or tags for a media item."""
    cursor = await db.execute("SELECT id FROM media_library_v2 WHERE id = ?", (media_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Media not found")

    updates: dict = {}
    if body.alt_text is not None:
        updates["alt_text"] = body.alt_text
        updates["ai_generated_alt"] = False
    if body.tags is not None:
        import json
        updates["tags"] = json.dumps(body.tags)

    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [media_id]
    await db.execute(f"UPDATE media_library_v2 SET {set_clause} WHERE id = ?", values)
    await db.commit()

    cursor2 = await db.execute("SELECT * FROM media_library_v2 WHERE id = ?", (media_id,))
    return dict(await cursor2.fetchone())


@router.delete("/{media_id}", responses=_RESPONSES)
async def delete_media(
    db: Annotated[PostgresConnection, Depends(get_db)],
    user: Annotated[dict, Depends(require_admin)],
    media_id: int,
):
    """Delete a media item from DB and disk."""
    cursor = await db.execute("SELECT * FROM media_library_v2 WHERE id = ?", (media_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Media not found")

    file_path = os.path.join(UPLOAD_DIR, row["filename"])
    if os.path.exists(file_path):
        os.unlink(file_path)

    await db.execute("DELETE FROM media_library_v2 WHERE id = ?", (media_id,))
    await db.commit()
    return {"deleted": True, "id": media_id}
