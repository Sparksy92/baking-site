"""Auto-comment moderation service.

Monitors incoming comments and applies moderation rules:
  - Keyword blocking
  - Sentiment-based hiding
  - Spam detection
  - User blocklists
  - Auto-replies for FAQs

Rules are configurable via moderation_rules table.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone

from app.database import db_connection

logger = logging.getLogger(__name__)


async def process_incoming_comment(
    engagement_event_id: int,
    comment_text: str,
    author_handle: str,
) -> dict:
    """Process a new comment through moderation rules.

    Returns action taken (if any) and reason.
    """
    # Load active rules
    rules = await _load_active_rules()

    for rule in rules:
        matched, reason = await _check_rule_match(rule, comment_text, author_handle)

        if matched:
            # Take action
            action_result = await _apply_moderation_action(
                rule=rule,
                engagement_event_id=engagement_event_id,
            )

            # Log the action
            await _log_moderation_action(rule["id"], engagement_event_id, action_result["action"])

            return {
                "action_taken": action_result["action"],
                "rule_name": rule["name"],
                "reason": reason,
                "engagement_event_id": engagement_event_id,
            }

    return {
        "action_taken": "none",
        "rule_name": None,
        "reason": "No matching rules",
    }


async def _load_active_rules() -> list[dict]:
    """Load all active moderation rules."""
    async with db_connection() as db:
        cursor = await db.execute(
            """SELECT * FROM moderation_rules
                WHERE is_active = TRUE
                ORDER BY id ASC"""
        )
        rows = await cursor.fetchall()

    return [dict(r) for r in rows]


async def _check_rule_match(
    rule: dict,
    comment_text: str,
    author_handle: str,
) -> tuple[bool, str]:
    """Check if a comment matches a moderation rule.

    Returns (matched, reason).
    """
    rule_type = rule["rule_type"]
    condition = rule["condition"]
    pattern = rule["pattern"]

    if rule_type == "keyword":
        if condition == "contains":
            if pattern.lower() in comment_text.lower():
                return True, f"Contains prohibited keyword: {pattern}"
        elif condition == "regex":
            try:
                if re.search(pattern, comment_text, re.IGNORECASE):
                    return True, f"Matches pattern: {pattern}"
            except re.error:
                logger.error(f"Invalid regex in moderation rule: {pattern}")

    elif rule_type == "spam":
        # Check for repetitive characters or excessive links
        if condition == "regex":
            try:
                if re.search(pattern, comment_text, re.IGNORECASE):
                    return True, "Spam pattern detected"
            except re.error:
                pass

    elif rule_type == "user_block":
        if condition == "user_in_list":
            blocked_users = [u.strip().lower() for u in pattern.split(",")]
            if author_handle.lower() in blocked_users:
                return True, f"Blocked user: {author_handle}"

    elif rule_type == "sentiment":
        # This requires sentiment to already be analyzed
        # We'd check against stored sentiment in social_engagement_events
        pass

    return False, ""


async def _apply_moderation_action(
    rule: dict,
    engagement_event_id: int,
) -> dict:
    """Apply the moderation action specified in the rule."""
    action = rule["action"]

    if action == "hide":
        # Mark as hidden in our system
        # Note: Actual hiding on Meta would require API call
        async with db_connection() as db:
            await db.execute(
                """UPDATE social_engagement_events
                   SET moderation_action = 'hidden', hidden_at = ?
                   WHERE id = ?""",
                (datetime.now(timezone.utc).isoformat(), engagement_event_id),
            )
            await db.commit()
        return {"action": "hide", "platform_action": "pending"}

    elif action == "delete":
        # Mark for deletion
        async with db_connection() as db:
            await db.execute(
                """UPDATE social_engagement_events
                   SET moderation_action = 'deleted', deleted_at = ?
                   WHERE id = ?""",
                (datetime.now(timezone.utc).isoformat(), engagement_event_id),
            )
            await db.commit()
        return {"action": "delete", "platform_action": "pending"}

    elif action == "flag_for_review":
        # Add to crisis alerts or flagged queue
        async with db_connection() as db:
            await db.execute(
                """UPDATE social_engagement_events
                   SET moderation_action = 'flagged'
                   WHERE id = ?""",
                (engagement_event_id,),
            )
            # Could also create a crisis alert here
            await db.commit()
        return {"action": "flag_for_review"}

    elif action == "auto_reply":
        # Auto-reply with canned response
        reply_text = rule.get("auto_reply_text", "")
        if reply_text:
            # Store as auto-generated reply (different from AI reply)
            async with db_connection() as db:
                await db.execute(
                    """UPDATE social_engagement_events
                       SET reply_content = ?,
                           replied_at = ?,
                           reply_type = 'auto_moderation'
                       WHERE id = ?""",
                    (reply_text, datetime.now(timezone.utc).isoformat(), engagement_event_id),
                )
                await db.commit()
        return {"action": "auto_reply", "reply": reply_text}

    return {"action": "unknown"}


async def _log_moderation_action(
    rule_id: int,
    engagement_event_id: int,
    action_taken: str,
) -> None:
    """Log that a moderation action was taken."""
    async with db_connection() as db:
        await db.execute(
            """INSERT INTO moderation_actions (rule_id, engagement_event_id, action_taken)
                VALUES (?, ?, ?)""",
            (rule_id, engagement_event_id, action_taken),
        )
        await db.commit()

        # Increment rule match count
        await db.execute(
            "UPDATE moderation_rules SET match_count = match_count + 1 WHERE id = ?",
            (rule_id,),
        )
        await db.commit()


async def create_moderation_rule(
    name: str,
    rule_type: str,
    condition: str,
    pattern: str,
    action: str,
    auto_reply_text: str = "",
    created_by: str = "admin",
) -> dict:
    """Create a new moderation rule."""
    async with db_connection() as db:
        cursor = await db.execute(
            """INSERT INTO moderation_rules
               (name, rule_type, condition, pattern, action, auto_reply_text, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (name, rule_type, condition, pattern, action, auto_reply_text, created_by),
        )
        await db.commit()
        rule_id = cursor.lastrowid

    return {"rule_id": rule_id, "name": name, "action": action}


async def list_moderation_rules(is_active: bool | None = None) -> list[dict]:
    """List moderation rules."""
    async with db_connection() as db:
        if is_active is not None:
            cursor = await db.execute(
                "SELECT * FROM moderation_rules WHERE is_active = ? ORDER BY created_at DESC",
                (is_active,),
            )
        else:
            cursor = await db.execute(
                "SELECT * FROM moderation_rules ORDER BY created_at DESC"
            )
        rows = await cursor.fetchall()

    return [dict(r) for r in rows]


async def toggle_moderation_rule(rule_id: int, is_active: bool) -> dict:
    """Enable or disable a moderation rule."""
    async with db_connection() as db:
        await db.execute(
            "UPDATE moderation_rules SET is_active = ? WHERE id = ?",
            (is_active, rule_id),
        )
        await db.commit()

    return {"rule_id": rule_id, "is_active": is_active}
