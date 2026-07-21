"""Public influencer submission portal.

Influencers receive a unique URL containing their collaboration portal_token.
They can view their collaboration brief and submit content for admin review —
no authentication required beyond possessing the token.

Routes (all public, no JWT):
  GET  /portal/influencer/{token}           — view brief
  POST /portal/influencer/{token}/submit    — submit content
  GET  /portal/influencer/{token}/submissions — list own submissions
"""
from __future__ import annotations
from typing import Annotated

import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.database import PostgresConnection, get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/portal/influencer", tags=["influencer-portal"])

_RESPONSES = {400: {"description": "Bad Request"}, 404: {"description": "Not Found"}}


async def _get_collab_by_token(token: str, db: PostgresConnection) -> dict:
    cursor = await db.execute(
        """SELECT c.*, i.name AS influencer_name, i.handle, i.platform
           FROM influencer_collaborations c
           JOIN influencers i ON c.influencer_id = i.id
           WHERE c.portal_token = ?""",
        (token,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Portal link not found or expired")
    return dict(row)


@router.get("/{token}", responses=_RESPONSES)
async def get_portal_brief(
    token: str,
    db: Annotated[PostgresConnection, Depends(get_db)],
):
    """Return the collaboration brief for the influencer.

    Public endpoint — token acts as the access credential.
    """
    collab = await _get_collab_by_token(token, db)

    # Only expose safe fields to the influencer
    return {
        "campaign_name": collab["campaign_name"],
        "influencer_name": collab["influencer_name"],
        "handle": collab["handle"],
        "platform": collab["platform"],
        "deliverables": collab["deliverables"],
        "start_date": collab["start_date"],
        "end_date": collab["end_date"],
        "content_requirements": collab["content_requirements"],
        "status": collab["status"],
        "posts_delivered": collab["posts_delivered"],
        "collaboration_id": collab["id"],
    }


class SubmitContentBody(BaseModel):
    content_type: str       # 'post' | 'story' | 'reel'
    caption: str
    media_urls: list[str]   # publicly accessible URLs
    submitted_by_name: str = ""
    submitted_by_email: str = ""


@router.post("/{token}/submit", responses=_RESPONSES)
async def submit_content(
    token: str,
    body: SubmitContentBody,
    db: Annotated[PostgresConnection, Depends(get_db)],
):
    """Influencer submits content for admin review.

    Returns submission_id. Admin reviews via /api/admin/social/influencers/submissions.
    """
    collab = await _get_collab_by_token(token, db)

    if collab["status"] not in ("active", "proposed"):
        raise HTTPException(
            status_code=400,
            detail=f"This collaboration is {collab['status']} and not accepting submissions."
        )

    valid_types = {"post", "story", "reel", "video", "image"}
    if body.content_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"content_type must be one of: {valid_types}")

    import json
    cursor = await db.execute(
        """INSERT INTO influencer_submissions
           (collaboration_id, content_type, caption, media_urls, status,
            submitted_by_name, submitted_by_email)
           VALUES (?, ?, ?, ?, 'pending', ?, ?)""",
        (
            collab["id"],
            body.content_type,
            body.caption,
            json.dumps(body.media_urls),
            body.submitted_by_name,
            body.submitted_by_email,
        ),
    )
    await db.commit()
    submission_id = cursor.lastrowid

    logger.info(
        f"Influencer portal submission: collab={collab['id']} "
        f"type={body.content_type} sub_id={submission_id}"
    )
    return {
        "submission_id": submission_id,
        "status": "pending",
        "message": "Your content has been submitted for review. You'll be notified once it's reviewed.",
    }


@router.get("/{token}/submissions", responses=_RESPONSES)
async def list_own_submissions(
    token: str,
    db: Annotated[PostgresConnection, Depends(get_db)],
):
    """List the influencer's own submissions for this collaboration."""
    collab = await _get_collab_by_token(token, db)

    cursor = await db.execute(
        """SELECT id, content_type, caption, media_urls, status,
                  submitted_at, reviewed_at, feedback
           FROM influencer_submissions
           WHERE collaboration_id = ?
           ORDER BY submitted_at DESC""",
        (collab["id"],),
    )
    rows = [dict(r) for r in await cursor.fetchall()]
    return {"submissions": rows, "total": len(rows)}
