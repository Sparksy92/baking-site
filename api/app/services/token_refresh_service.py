"""Meta access token refresh service.

Meta long-lived page tokens expire after ~60 days. This service:
  1. Checks all platform configs with a token that expires within 7 days
  2. Exchanges the existing token for a new 60-day token via Meta Graph API
  3. Updates social_platform_configs.access_token and token_expires_at
  4. Logs an error if refresh fails so the admin can see it in the platform config

Called from the FastAPI startup lifespan as a background task and can also
be triggered manually via the admin API at POST /api/admin/social/refresh-tokens.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

import httpx

from app.config import get_settings
from app.database import db_connection

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.facebook.com/v19.0"
REFRESH_THRESHOLD_DAYS = 7


async def refresh_expiring_tokens() -> dict:
    """Check and refresh any Meta tokens expiring within REFRESH_THRESHOLD_DAYS.

    Returns a summary dict: {refreshed: int, failed: int, skipped: int}
    """
    settings = get_settings()
    summary = {"refreshed": 0, "failed": 0, "skipped": 0}

    if not settings.meta_page_access_token:
        logger.info("Meta not configured — skipping token refresh check")
        return summary

    threshold = datetime.now(timezone.utc) + timedelta(days=REFRESH_THRESHOLD_DAYS)

    try:
        async with db_connection() as db:
            cursor = await db.execute(
                """SELECT platform, access_token, token_expires_at
                   FROM social_platform_configs
                   WHERE platform IN ('facebook', 'instagram')
                   AND access_token IS NOT NULL
                   AND access_token != ''
                   AND (token_expires_at IS NULL OR token_expires_at <= ?)""",
                (threshold.isoformat(),),
            )
            rows = await cursor.fetchall()
    except Exception as e:
        logger.error(f"Token refresh check failed to query DB: {e}")
        return summary

    if not rows:
        logger.info("No Meta tokens due for refresh")
        return summary

    for row in rows:
        platform = row["platform"]
        current_token = row["access_token"]

        try:
            new_token, expires_at = await _exchange_token(
                current_token,
                settings.meta_app_secret or "",
            )
            async with db_connection() as db:
                await db.execute(
                    """UPDATE social_platform_configs
                       SET access_token = ?, token_expires_at = ?,
                           setup_notes = NULL, updated_at = CURRENT_TIMESTAMP
                       WHERE platform = ?""",
                    (new_token, expires_at.isoformat(), platform),
                )
                await db.commit()

            logger.info(f"Refreshed Meta token for platform={platform} expires={expires_at.date()}")
            summary["refreshed"] += 1

        except Exception as e:
            logger.error(f"Failed to refresh Meta token for platform={platform}: {e}")
            try:
                async with db_connection() as db:
                    await db.execute(
                        """UPDATE social_platform_configs
                           SET setup_status = 'error',
                               setup_notes = ?,
                               updated_at = CURRENT_TIMESTAMP
                           WHERE platform = ?""",
                        (f"Token refresh failed: {e}", platform),
                    )
                    await db.commit()
            except Exception:
                pass
            summary["failed"] += 1

    return summary


async def _exchange_token(short_token: str, app_secret: str) -> tuple[str, datetime]:
    """Exchange a short/expiring token for a new long-lived token via Meta Graph API.

    Returns (new_access_token, expires_at datetime).
    Raises on failure.
    """
    settings = get_settings()

    if not settings.meta_page_access_token:
        raise ValueError("META_PAGE_ACCESS_TOKEN not configured")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GRAPH_BASE}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": _extract_app_id_from_token(short_token),
                "client_secret": app_secret,
                "fb_exchange_token": short_token,
            },
            timeout=15.0,
        )
        data = resp.json()

    if "error" in data:
        raise ValueError(f"Meta token exchange error: {data['error'].get('message', 'Unknown')}")

    new_token = data.get("access_token")
    if not new_token:
        raise ValueError("Meta returned no access_token")

    # expires_in is in seconds; default 60 days if not returned
    expires_in = data.get("expires_in", 60 * 24 * 3600)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    return new_token, expires_at


def _extract_app_id_from_token(token: str) -> str:
    """Meta page access tokens encode the app ID as the first segment before the pipe.
    Falls back to empty string if format is unexpected — caller handles the error.
    """
    if "|" in token:
        return token.split("|")[0]
    return ""
