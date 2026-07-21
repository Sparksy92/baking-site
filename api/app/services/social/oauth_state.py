from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone

from app.database import PostgresConnection


def hash_state(state: str) -> str:
    return hashlib.sha256(state.encode("utf-8")).hexdigest()


async def create_oauth_state(
    db: PostgresConnection,
    *,
    provider: str,
    admin_user_id: str | None,
    brand_id: str = "default",
    return_path: str = "/admin/social/platforms",
    ttl_minutes: int = 15,
    metadata: dict | None = None,
) -> str:
    state = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    await db.execute(
        """INSERT INTO social_oauth_states
           (state_hash, provider, brand_id, admin_user_id, return_path, expires_at, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (hash_state(state), provider, brand_id, admin_user_id, return_path, expires_at, json.dumps(metadata or {})),
    )
    await db.commit()
    return state


async def consume_oauth_state(
    db: PostgresConnection,
    *,
    state: str,
    provider: str,
) -> dict | None:
    cursor = await db.execute(
        """SELECT * FROM social_oauth_states
           WHERE state_hash = ? AND provider = ? AND status = 'pending'
           LIMIT 1""",
        (hash_state(state), provider),
    )
    row = await cursor.fetchone()
    if not row:
        return None

    data = dict(row)
    expires_at = data.get("expires_at")
    if expires_at:
        expires = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
        if expires < datetime.now(timezone.utc):
            await db.execute(
                "UPDATE social_oauth_states SET status = 'expired' WHERE id = ?",
                (data["id"],),
            )
            await db.commit()
            return None

    await db.execute(
        "UPDATE social_oauth_states SET status = 'used', used_at = CURRENT_TIMESTAMP WHERE id = ?",
        (data["id"],),
    )
    await db.commit()
    return data
