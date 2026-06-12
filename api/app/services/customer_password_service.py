from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from app.config import get_settings
from app.customer_auth import generate_reset_token
from app.database import PostgresConnection
from app.services.email_service import send_password_reset

logger = logging.getLogger(__name__)


async def create_and_send_password_reset(
    db: PostgresConnection,
    *,
    customer_id: int,
    email: str,
    first_name: str,
    source: str,
    created_by: str | None = None,
) -> dict:
    """Create a reset token and send the customer a reset-link email."""
    token = generate_reset_token()
    expires = datetime.now(timezone.utc) + timedelta(hours=1)

    await db.execute(
        "UPDATE customers SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?",
        (token, expires.isoformat(), customer_id),
    )

    settings = get_settings()
    reset_url = f"{settings.store_domain}/account/reset-password?token={token}"
    email_sent = False
    email_error: str | None = None

    if not settings.resend_api_key:
        email_error = "Email provider is not configured."
        logger.warning("Password reset token created but RESEND_API_KEY is not configured")
    else:
        try:
            await send_password_reset(email=email, first_name=first_name, reset_url=reset_url)
            email_sent = True
        except Exception as exc:
            email_error = str(exc)
            logger.exception("Failed to send password reset email to %s", email)

    if source == "admin":
        detail = "Password reset email sent." if email_sent else "Password reset token created, but email failed to send."
        await db.execute(
            "INSERT INTO customer_notes (customer_id, note, created_by) VALUES (?, ?, ?)",
            (customer_id, detail, created_by),
        )

    return {
        "email_sent": email_sent,
        "email_error": email_error,
        "expires_at": expires.isoformat(),
        "reset_url": reset_url if settings.dev_mode else None,
    }
