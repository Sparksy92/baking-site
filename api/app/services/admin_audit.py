"""Admin audit logging service.

Tracks all admin actions for compliance, troubleshooting, and team accountability.
Logs: who did what, when, from where, what changed.

This complements agent_audit_log (external systems) with internal human actions.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from app.database import db_connection

logger = logging.getLogger(__name__)


async def log_admin_action(
    admin_email: str,
    action: str,
    resource_type: str,
    resource_id: str | int,
    old_values: dict | None = None,
    new_values: dict | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    """Log an admin action to the audit log.

    Args:
        admin_email: Who performed the action
        action: What happened (e.g., 'publish_post', 'update_persona', 'approve_draft')
        resource_type: What kind of resource (e.g., 'social_post', 'persona')
        resource_id: Primary key of the resource
        old_values: Previous state (for updates)
        new_values: New state (for creates/updates)
    """
    try:
        async with db_connection() as db:
            await db.execute(
                """INSERT INTO admin_audit_log
                   (admin_email, action, resource_type, resource_id,
                    old_values, new_values, ip_address, user_agent)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    admin_email,
                    action,
                    resource_type,
                    str(resource_id),
                    json.dumps(old_values, default=str)[:2000] if old_values else None,
                    json.dumps(new_values, default=str)[:2000] if new_values else None,
                    ip_address,
                    user_agent[:200] if user_agent else None,
                ),
            )
            await db.commit()
    except Exception as e:
        logger.error(f"Failed to write admin audit log: {e}")


# Convenience helpers for common actions

async def log_post_published(
    admin_email: str,
    post_id: int,
    platform: str,
    content_preview: str,
    ip: str | None = None,
    ua: str | None = None,
) -> None:
    await log_admin_action(
        admin_email, "publish_post", "social_post", post_id,
        new_values={"platform": platform, "content_preview": content_preview[:200]},
        ip_address=ip, user_agent=ua,
    )


async def log_draft_approved(
    admin_email: str,
    post_id: int,
    platform: str,
    ip: str | None = None,
    ua: str | None = None,
) -> None:
    await log_admin_action(
        admin_email, "approve_draft", "social_post", post_id,
        new_values={"platform": platform, "status": "approved"},
        ip_address=ip, user_agent=ua,
    )


async def log_persona_updated(
    admin_email: str,
    old_values: dict,
    new_values: dict,
    ip: str | None = None,
    ua: str | None = None,
) -> None:
    await log_admin_action(
        admin_email, "update_persona", "brand_persona", new_values.get("id", "unknown"),
        old_values=old_values, new_values=new_values,
        ip_address=ip, user_agent=ua,
    )


async def log_agent_key_created(
    admin_email: str,
    key_id: int,
    key_name: str,
    scopes: list[str],
    ip: str | None = None,
    ua: str | None = None,
) -> None:
    await log_admin_action(
        admin_email, "create_agent_key", "agent_api_key", key_id,
        new_values={"name": key_name, "scopes": scopes},
        ip_address=ip, user_agent=ua,
    )


async def log_submission_reviewed(
    admin_email: str,
    submission_id: int,
    decision: str,
    notes: str,
    ip: str | None = None,
    ua: str | None = None,
) -> None:
    await log_admin_action(
        admin_email, f"review_submission_{decision}", "agent_content_submission", submission_id,
        new_values={"decision": decision, "notes": notes},
        ip_address=ip, user_agent=ua,
    )


async def get_audit_log(
    admin_email: str | None = None,
    resource_type: str | None = None,
    resource_id: str | int | None = None,
    action: str | None = None,
    since: str | None = None,
    limit: int = 100,
) -> list[dict]:
    """Query the admin audit log with filters."""
    conditions = []
    params: list[Any] = []

    if admin_email:
        conditions.append("admin_email = ?")
        params.append(admin_email)
    if resource_type:
        conditions.append("resource_type = ?")
        params.append(resource_type)
    if resource_id:
        conditions.append("resource_id = ?")
        params.append(str(resource_id))
    if action:
        conditions.append("action = ?")
        params.append(action)
    if since:
        conditions.append("created_at >= ?")
        params.append(since)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    async with db_connection() as db:
        cursor = await db.execute(
            f"""SELECT * FROM admin_audit_log
                {where}
                ORDER BY created_at DESC
                LIMIT ?""",
            params + [limit],
        )
        rows = await cursor.fetchall()

    return [dict(r) for r in rows]
