"""Social Inbox service - Unified DMs and comments management.

Agorapulse/Sprout Social-style unified inbox for managing
conversations across all platforms.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any

from app.database import db_connection
from app.services.sentiment_service import analyze_sentiment
from app.services.reply_service import generate_reply_draft

logger = logging.getLogger(__name__)


# Intent detection keywords
INTENT_PATTERNS = {
    "question": ["?", "how", "what", "when", "where", "why", "can you", "do you"],
    "complaint": ["angry", "terrible", "awful", "worst", "hate", "disappointed", "refund", "problem", "issue"],
    "praise": ["love", "amazing", "best", "awesome", "great", "thank", "beautiful", "perfect"],
    "sales": ["price", "cost", "buy", "order", "shop", "discount", "available", "in stock"],
    "spam": ["follow back", "check my", "dm for", "free money", "click here"],
}


def detect_intent(content: str) -> str:
    """Detect the intent of a message."""
    content_lower = content.lower()
    
    scores = {}
    for intent, patterns in INTENT_PATTERNS.items():
        score = sum(1 for p in patterns if p in content_lower)
        scores[intent] = score
    
    # Return highest scoring intent
    if max(scores.values()) > 0:
        return max(scores, key=scores.get)
    
    return "general"


async def get_or_create_conversation(
    platform: str,
    platform_user_id: str,
    platform_user_name: str | None = None,
    platform_user_avatar: str | None = None,
) -> dict:
    """Get existing conversation or create new one."""
    async with db_connection() as db:
        # Try to get existing
        cursor = await db.execute(
            """SELECT * FROM social_conversations 
               WHERE platform = ? AND platform_user_id = ?""",
            (platform, platform_user_id)
        )
        conv = await cursor.fetchone()
        
        if conv:
            # Update user info if changed
            if platform_user_name and platform_user_name != conv["platform_user_name"]:
                await db.execute(
                    """UPDATE social_conversations 
                       SET platform_user_name = ?, updated_at = CURRENT_TIMESTAMP
                       WHERE id = ?""",
                    (platform_user_name, conv["id"])
                )
                await db.commit()
            return dict(conv)
        
        # Create new conversation
        cursor = await db.execute(
            """INSERT INTO social_conversations
               (platform, platform_user_id, platform_user_name, platform_user_avatar, status)
               VALUES (?, ?, ?, ?, 'open')
               RETURNING *""",
            (platform, platform_user_id, platform_user_name, platform_user_avatar)
        )
        new_conv = await cursor.fetchone()
        await db.commit()
        
    logger.info(f"Created conversation: id={new_conv['id']} platform={platform} user={platform_user_id}")
    return dict(new_conv)


async def add_message(
    conversation_id: int,
    direction: str,  # 'inbound' or 'outbound'
    content: str,
    message_type: str = "text",
    platform_message_id: str | None = None,
    media_urls: list[str] | None = None,
    sent_at: datetime | None = None,
    auto_process: bool = True,
) -> dict:
    """Add a message to a conversation."""
    sent_at = sent_at or datetime.now(timezone.utc)
    
    # Analyze if inbound
    sentiment = None
    detected_intent = None
    if direction == "inbound" and auto_process:
        sentiment = await analyze_sentiment(content)
        detected_intent = detect_intent(content)
    
    async with db_connection() as db:
        cursor = await db.execute(
            """INSERT INTO social_messages
               (conversation_id, platform_message_id, direction, message_type,
                content, media_urls, sent_at, sentiment_score, detected_intent)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               RETURNING id""",
            (conversation_id, platform_message_id, direction, message_type,
             content, json.dumps(media_urls or []), sent_at,
             sentiment.get("compound") if sentiment else None,
             detected_intent)
        )
        msg = await cursor.fetchone()
        
        # Update conversation
        await db.execute(
            """UPDATE social_conversations
               SET last_message_at = ?,
                   unread_count = CASE WHEN ? = 'inbound' THEN unread_count + 1 ELSE unread_count END,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (sent_at, direction, conversation_id)
        )
        await db.commit()
        
    # Auto-reply logic for certain intents
    if direction == "inbound" and detected_intent == "sales" and auto_process:
        # Could trigger auto-reply with product info
        pass
    
    return {"id": msg["id"], "conversation_id": conversation_id, "added": True}


async def get_inbox(
    platform: str | None = None,
    status: str | None = None,
    assigned_to: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """Get inbox conversations with filtering."""
    async with db_connection() as db:
        # Build query
        where_parts = ["1=1"]
        params = []
        
        if platform:
            where_parts.append("platform = ?")
            params.append(platform)
        if status:
            where_parts.append("status = ?")
            params.append(status)
        if assigned_to:
            where_parts.append("assigned_to = ?")
            params.append(assigned_to)
        
        # Get conversations
        cursor = await db.execute(
            f"""SELECT * FROM social_conversations
                WHERE {' AND '.join(where_parts)}
                ORDER BY 
                  CASE status WHEN 'open' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                  unread_count DESC,
                  last_message_at DESC
                LIMIT ? OFFSET ?""",
            params + [limit, offset]
        )
        conversations = await cursor.fetchall()
        
        # Get total count
        cursor = await db.execute(
            f"""SELECT COUNT(*) as total FROM social_conversations
                WHERE {' AND '.join(where_parts)}""",
            params
        )
        total = (await cursor.fetchone())["total"]
        
        # Get recent messages for each conversation
        result = []
        for conv in conversations:
            conv_dict = dict(conv)
            
            cursor = await db.execute(
                """SELECT * FROM social_messages
                   WHERE conversation_id = ?
                   ORDER BY sent_at DESC
                   LIMIT 5""",
                (conv["id"],)
            )
            messages = await cursor.fetchall()
            conv_dict["recent_messages"] = [dict(m) for m in reversed(messages)]
            
            result.append(conv_dict)
        
    return {
        "conversations": result,
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": (offset + limit) < total
    }


async def get_conversation_detail(conversation_id: int) -> dict | None:
    """Get full conversation with all messages."""
    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT * FROM social_conversations WHERE id = ?",
            (conversation_id,)
        )
        conv = await cursor.fetchone()
        
        if not conv:
            return None
        
        cursor = await db.execute(
            """SELECT * FROM social_messages
               WHERE conversation_id = ?
               ORDER BY sent_at ASC""",
            (conversation_id,)
        )
        messages = await cursor.fetchall()
        
        # Mark as read
        await db.execute(
            """UPDATE social_messages SET is_read = TRUE 
               WHERE conversation_id = ? AND direction = 'inbound' AND is_read = FALSE""",
            (conversation_id,)
        )
        await db.execute(
            "UPDATE social_conversations SET unread_count = 0 WHERE id = ?",
            (conversation_id,)
        )
        await db.commit()
        
    conv_dict = dict(conv)
    conv_dict["messages"] = [dict(m) for m in messages]
    return conv_dict


async def reply_to_conversation(
    conversation_id: int,
    content: str,
    sent_by: str = "admin",
) -> dict:
    """Send a reply to a conversation."""
    # Add outbound message
    msg = await add_message(
        conversation_id=conversation_id,
        direction="outbound",
        content=content,
        sent_at=datetime.now(timezone.utc)
    )
    
    # Update conversation status
    async with db_connection() as db:
        await db.execute(
            """UPDATE social_conversations
               SET status = 'pending',
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (conversation_id,)
        )
        await db.commit()
        
    # TODO: Actually send to platform API (Meta, X, etc.)
    # This would call the appropriate platform service
    
    return {"sent": True, "message_id": msg["id"]}


async def assign_conversation(conversation_id: int, assignee: str | None) -> dict:
    """Assign or unassign a conversation."""
    async with db_connection() as db:
        await db.execute(
            """UPDATE social_conversations
               SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (assignee, conversation_id)
        )
        await db.commit()
        
    return {"assigned": assignee, "conversation_id": conversation_id}


async def update_conversation_status(conversation_id: int, status: str) -> dict:
    """Update conversation status (open, pending, resolved, spam)."""
    async with db_connection() as db:
        await db.execute(
            """UPDATE social_conversations
               SET status = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (status, conversation_id)
        )
        await db.commit()
        
    return {"status": status, "conversation_id": conversation_id}


async def add_conversation_tag(conversation_id: int, tag: str) -> dict:
    """Add a tag to a conversation."""
    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT tags FROM social_conversations WHERE id = ?",
            (conversation_id,)
        )
        row = await cursor.fetchone()
        
        tags = json.loads(row["tags"] or "[]")
        if tag not in tags:
            tags.append(tag)
            await db.execute(
                "UPDATE social_conversations SET tags = ? WHERE id = ?",
                (json.dumps(tags), conversation_id)
            )
            await db.commit()
            
    return {"tag_added": tag, "tags": tags}


async def get_inbox_stats(days: int = 7) -> dict:
    """Get inbox analytics."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    
    async with db_connection() as db:
        # Message counts
        cursor = await db.execute(
            """SELECT 
                COUNT(*) as total_messages,
                SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound,
                SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound,
                AVG(CASE WHEN sentiment_score IS NOT NULL THEN sentiment_score END) as avg_sentiment
               FROM social_messages
               WHERE created_at >= ?""",
            (since.isoformat(),)
        )
        msg_stats = await cursor.fetchone()
        
        # Conversation status breakdown
        cursor = await db.execute(
            """SELECT status, COUNT(*) as count
               FROM social_conversations
               GROUP BY status"""
        )
        status_breakdown = {r["status"]: r["count"] for r in await cursor.fetchall()}
        
        # Intent breakdown
        cursor = await db.execute(
            """SELECT detected_intent, COUNT(*) as count
               FROM social_messages
               WHERE direction = 'inbound' AND created_at >= ?
               GROUP BY detected_intent""",
            (since.isoformat(),)
        )
        intent_breakdown = {r["detected_intent"]: r["count"] for r in await cursor.fetchall()}
        
        # Average response time (simplified)
        cursor = await db.execute(
            """SELECT AVG(
                julianday(m2.sent_at) - julianday(m1.sent_at)
               ) * 24 * 60 as avg_minutes
               FROM social_messages m1
               JOIN social_messages m2 ON m1.conversation_id = m2.conversation_id
               WHERE m1.direction = 'inbound'
               AND m2.direction = 'outbound'
               AND m2.sent_at > m1.sent_at
               AND m1.created_at >= ?""",
            (since.isoformat(),)
        )
        avg_response = await cursor.fetchone()
        
    return {
        "period_days": days,
        "messages": {
            "total": msg_stats["total_messages"] or 0,
            "inbound": msg_stats["inbound"] or 0,
            "outbound": msg_stats["outbound"] or 0,
            "avg_sentiment": round(msg_stats["avg_sentiment"] or 0, 2)
        },
        "conversations_by_status": status_breakdown,
        "intents": intent_breakdown,
        "avg_response_time_minutes": round(avg_response["avg_minutes"] or 0, 1) if avg_response else None
    }


async def sync_platform_messages(platform: str, since: datetime | None = None) -> dict:
    """Sync messages from a platform into the inbox.
    
    This would be called by a background task to pull DMs/comments.
    """
    since = since or datetime.now(timezone.utc) - timedelta(hours=1)
    
    # TODO: Platform-specific sync logic
    # Meta: Use Instagram Graph API for DMs
    # X: Use Twitter API v2 for DMs
    # etc.
    
    logger.info(f"Syncing {platform} messages since {since}")
    
    return {"platform": platform, "synced": 0, "note": "Platform sync not yet implemented"}
