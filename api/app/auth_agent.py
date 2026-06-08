"""Agent API key authentication.

AI agents authenticate via X-Agent-Key header. Keys are scoped per-agent
with specific permissions (scopes) and store restrictions.

This is separate from admin JWT auth — agents are external systems, not humans.
"""
from __future__ import annotations

import functools
import logging
import secrets
from datetime import datetime, timezone
from typing import Callable

import bcrypt
from fastapi import Header, HTTPException, Request, status

from app.database import db_connection

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

AGENT_KEY_HEADER = "X-Agent-Key"
AGENT_SCOPES = {
    "read:engagement",     # read social_engagement_events
    "write:replies",      # submit reply drafts for approval
    "read:metrics",       # read post performance metrics
    "read:products",      # read product catalog
    "read:persona",       # read brand persona
    "write:drafts",       # submit social post drafts for approval
    "read:outbox",        # read current outbox status
}


# ── Key validation ───────────────────────────────────────────────────────────

async def validate_agent_key(agent_key: str) -> dict | None:
    """Validate an agent API key. Returns agent record or None if invalid.

    Also updates last_used_at timestamp.
    """
    if not agent_key or len(agent_key) < 32:
        return None

    try:
        async with db_connection() as db:
            # Fetch all active keys (in production with many agents, optimize this)
            cursor = await db.execute(
                "SELECT * FROM agent_api_keys WHERE is_active = TRUE"
            )
            rows = await cursor.fetchall()

            for row in rows:
                stored_hash = row["key_hash"]
                if bcrypt.checkpw(agent_key.encode(), stored_hash.encode()):
                    # Update last_used_at
                    await db.execute(
                        "UPDATE agent_api_keys SET last_used_at = ? WHERE id = ?",
                        (datetime.now(timezone.utc).isoformat(), row["id"]),
                    )
                    await db.commit()
                    return dict(row)

    except Exception as e:
        logger.error(f"Agent key validation error: {e}")

    return None


def require_agent_scope(*required_scopes: str) -> Callable:
    """Decorator factory for agent endpoint scope checking.

    Usage:
        @router.get("/engagement")
        @require_agent_scope("read:engagement")
        async def list_engagement(agent: dict = Depends(get_agent)):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            agent = kwargs.get("agent")
            if not agent:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Agent authentication required"
                )

            agent_scopes = set(s.strip() for s in (agent.get("scopes") or "").split(",") if s.strip())
            missing = set(required_scopes) - agent_scopes
            if missing:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Missing scopes: {', '.join(missing)}"
                )

            return await func(*args, **kwargs)
        return wrapper
    return decorator


# ── FastAPI dependency ───────────────────────────────────────────────────────

async def get_agent(
    request: Request,
    x_agent_key: str | None = Header(default=None, alias=AGENT_KEY_HEADER),
) -> dict:
    """FastAPI dependency to validate agent key and return agent record.

    Raises HTTPException(401) if key missing or invalid.
    """
    if not x_agent_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Missing {AGENT_KEY_HEADER} header",
            headers={"WWW-Authenticate": "AgentKey"},
        )

    agent = await validate_agent_key(x_agent_key)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid agent API key",
            headers={"WWW-Authenticate": "AgentKey"},
        )

    # Attach to request state for logging
    request.state.agent = agent
    return agent


# ── Admin utilities for key management ───────────────────────────────────────

async def hash_agent_key(plain_key: str) -> str:
    """Hash a plain agent key for storage."""
    return bcrypt.hashpw(plain_key.encode(), bcrypt.gensalt()).decode()


def generate_agent_key() -> str:
    """Generate a cryptographically secure agent API key."""
    # Format: agent_ prefix + 48 random chars = 54 chars total
    return "agent_" + secrets.token_urlsafe(36)


async def create_agent_key(
    name: str,
    scopes: list[str],
    stores: list[str] | None = None,
    rate_limit_rpm: int = 60,
    created_by: str = "admin",
) -> tuple[str, int]:
    """Create a new agent API key. Returns (plain_key, key_id).

    IMPORTANT: The plain key is only returned once — store it securely.
    """
    plain_key = generate_agent_key()
    key_hash = await hash_agent_key(plain_key)

    async with db_connection() as db:
        cursor = await db.execute(
            """INSERT INTO agent_api_keys
               (key_hash, name, scopes, stores, rate_limit_rpm, created_by)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                key_hash,
                name,
                ",".join(scopes),
                ",".join(stores or []),
                rate_limit_rpm,
                created_by,
            ),
        )
        await db.commit()
        key_id = cursor.lastrowid

    logger.info(f"Created agent key: id={key_id} name={name} scopes={scopes}")
    return plain_key, key_id


async def revoke_agent_key(key_id: int) -> bool:
    """Revoke an agent key by ID. Returns True if found and revoked."""
    async with db_connection() as db:
        cursor = await db.execute(
            "UPDATE agent_api_keys SET is_active = FALSE WHERE id = ?",
            (key_id,),
        )
        await db.commit()
        return cursor.rowcount > 0
