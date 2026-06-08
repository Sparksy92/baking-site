"""API routes for Social Inbox (unified DMs and comments)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from app.auth import require_admin
from app.database import get_db
import aiosqlite

from app.services.social_inbox_service import (
    get_inbox,
    get_conversation_detail,
    reply_to_conversation,
    assign_conversation,
    update_conversation_status,
    add_conversation_tag,
    get_inbox_stats,
)

router = APIRouter(prefix="/admin/social-inbox", tags=["social-inbox"])


class ReplyCreate(BaseModel):
    content: str


class StatusUpdate(BaseModel):
    status: str = Field(..., description="One of: open, pending, resolved, spam")


class TagUpdate(BaseModel):
    tag: str


@router.get("/conversations")
async def list_conversations(
    platform: Optional[str] = None,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user: dict = Depends(require_admin),
):
    """Get inbox conversations with filtering."""
    return await get_inbox(platform, status, assigned_to, limit, offset)


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: int,
    user: dict = Depends(require_admin),
):
    """Get full conversation with all messages."""
    conversation = await get_conversation_detail(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.post("/conversations/{conversation_id}/reply")
async def send_reply(
    conversation_id: int,
    data: ReplyCreate,
    user: dict = Depends(require_admin),
):
    """Send a reply to a conversation."""
    result = await reply_to_conversation(
        conversation_id=conversation_id,
        content=data.content,
        sent_by=user.get("email", "admin")
    )
    return result


@router.post("/conversations/{conversation_id}/assign")
async def assign(
    conversation_id: int,
    assignee: Optional[str] = None,
    user: dict = Depends(require_admin),
):
    """Assign or unassign a conversation."""
    result = await assign_conversation(conversation_id, assignee)
    return result


@router.post("/conversations/{conversation_id}/status")
async def update_status(
    conversation_id: int,
    data: StatusUpdate,
    user: dict = Depends(require_admin),
):
    """Update conversation status."""
    result = await update_conversation_status(conversation_id, data.status)
    return result


@router.post("/conversations/{conversation_id}/tags")
async def add_tag(
    conversation_id: int,
    data: TagUpdate,
    user: dict = Depends(require_admin),
):
    """Add a tag to a conversation."""
    result = await add_conversation_tag(conversation_id, data.tag)
    return result


@router.get("/stats")
async def get_stats(
    days: int = 7,
    user: dict = Depends(require_admin),
):
    """Get inbox analytics."""
    stats = await get_inbox_stats(days)
    return stats
