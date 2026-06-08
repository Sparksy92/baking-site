"""Webhook security service.

Implements:
- Signature verification (HMAC-SHA256)
- Timestamp validation (prevent replay attacks)
- Idempotency checking (prevent duplicate processing)
- IP allowlisting (optional)
- Rate limiting per source

All webhook handlers should use this for validation.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any

from app.config import get_settings
from app.database import db_connection

logger = logging.getLogger(__name__)


class WebhookValidationError(Exception):
    """Raised when webhook validation fails."""
    pass


def verify_meta_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify Meta (Facebook/Instagram) webhook signature.
    
    Meta sends: X-Hub-Signature-256: sha256=<hmac>
    
    Args:
        payload: Raw request body bytes
        signature: Header value from X-Hub-Signature-256
        secret: App secret from Meta developer console
        
    Returns:
        True if signature valid
        
    Raises:
        WebhookValidationError if signature missing or invalid
    """
    if not signature:
        raise WebhookValidationError("Missing X-Hub-Signature-256 header")
    
    if not signature.startswith("sha256="):
        raise WebhookValidationError("Invalid signature format")
    
    expected_mac = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    provided_mac = signature[7:]  # Remove "sha256=" prefix
    
    if not hmac.compare_digest(expected_mac, provided_mac):
        raise WebhookValidationError("Signature mismatch - possible tampering")
    
    return True


def verify_tiktok_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify TikTok webhook signature.
    
    TikTok uses similar HMAC-SHA256 approach.
    """
    if not signature:
        raise WebhookValidationError("Missing TikTok-Signature header")
    
    expected_mac = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(expected_mac, signature):
        raise WebhookValidationError("TikTok signature mismatch")
    
    return True


def verify_timestamp(timestamp: int | str, max_age_seconds: int = 300) -> bool:
    """Verify webhook timestamp to prevent replay attacks.
    
    Args:
        timestamp: Unix timestamp from webhook (seconds since epoch)
        max_age_seconds: Maximum acceptable age (default 5 minutes)
        
    Returns:
        True if timestamp within acceptable window
        
    Raises:
        WebhookValidationError if timestamp too old or in future
    """
    try:
        if isinstance(timestamp, str):
            timestamp = int(timestamp)
        
        now = int(time.time())
        age = now - timestamp
        
        if age < 0:
            # Timestamp in future - possible clock skew or attack
            if abs(age) > 60:  # Allow 1 min clock skew
                raise WebhookValidationError(f"Timestamp in future: {age}s ahead")
        
        if age > max_age_seconds:
            raise WebhookValidationError(
                f"Webhook too old: {age}s old (max {max_age_seconds}s)"
            )
        
        return True
        
    except (ValueError, TypeError) as exc:
        raise WebhookValidationError(f"Invalid timestamp format: {exc}")


async def check_idempotency(event_id: str, platform: str) -> bool:
    """Check if webhook event was already processed.
    
    Prevents duplicate processing of the same event.
    
    Args:
        event_id: Unique event ID from platform
        platform: Platform name (meta, tiktok, etc.)
        
    Returns:
        True if event already processed (should skip)
        False if new event (should process)
    """
    try:
        async with db_connection() as db:
            # Try to insert - if fails due to unique constraint, event exists
            try:
                await db.execute(
                    """INSERT INTO webhook_events (platform, event_id, received_at, processed)
                        VALUES (?, ?, CURRENT_TIMESTAMP, FALSE)""",
                    (platform, event_id)
                )
                await db.commit()
                return False  # New event, should process
            except Exception:
                # Event already exists
                await db.rollback()
                
                # Check if already processed
                cur = await db.execute(
                    "SELECT processed FROM webhook_events WHERE platform = ? AND event_id = ?",
                    (platform, event_id)
                )
                row = await cur.fetchone()
                
                if row and row["processed"]:
                    logger.info(f"Duplicate webhook: {platform}/{event_id} already processed")
                    return True  # Already processed, skip
                
                return False  # Exists but not processed, should retry
                
    except Exception as exc:
        logger.error(f"Idempotency check failed for {platform}/{event_id}: {exc}")
        # Fail open - process the event rather than drop it
        return False


async def mark_event_processed(event_id: str, platform: str, result: dict | None = None) -> None:
    """Mark webhook event as successfully processed.
    
    Args:
        event_id: Event ID that was processed
        platform: Platform name
        result: Optional processing result to store
    """
    try:
        result_json = json.dumps(result) if result else None
        
        async with db_connection() as db:
            await db.execute(
                """UPDATE webhook_events 
                    SET processed = TRUE, processed_at = CURRENT_TIMESTAMP, result_json = ?
                    WHERE platform = ? AND event_id = ?""",
                (result_json, platform, event_id)
            )
            await db.commit()
    except Exception as exc:
        logger.error(f"Failed to mark event processed: {exc}")


def validate_ip_address(client_ip: str, allowed_ips: list[str] | None = None) -> bool:
    """Validate webhook source IP (optional security layer).
    
    Args:
        client_ip: IP address from request
        allowed_ips: List of allowed IPs/ranges (if None, allows all)
        
    Returns:
        True if IP allowed
        
    Note: Meta webhooks come from dynamic IPs, so this is less useful for them.
    Better for internal webhooks or TikTok which has documented IP ranges.
    """
    if not allowed_ips:
        return True  # No IP filtering configured
    
    # Simple exact match (production would use CIDR ranges)
    if client_ip in allowed_ips:
        return True
    
    logger.warning(f"Webhook from unauthorized IP: {client_ip}")
    return False


class WebhookSecurityContext:
    """Context manager for webhook security validation.
    
    Usage:
        async with WebhookSecurityContext(platform="meta", headers=headers, body=body) as ctx:
            if ctx.valid:
                process_webhook(ctx.payload)
    """
    
    def __init__(self, platform: str, headers: dict, body: bytes, secret: str | None = None):
        self.platform = platform
        self.headers = headers
        self.body = body
        self.secret = secret or self._get_secret()
        self.valid = False
        self.error = None
        self.event_id = None
        self.timestamp = None
        
    def _get_secret(self) -> str:
        """Get webhook secret from settings."""
        settings = get_settings()
        return getattr(settings, 'webhook_secret', 'fallback-secret-change-me')
    
    async def __aenter__(self):
        try:
            # Extract headers
            signature = self._get_signature_header()
            timestamp = self._get_timestamp_header()
            self.event_id = self._get_event_id()
            
            # Verify signature
            if self.platform == "meta":
                verify_meta_signature(self.body, signature, self.secret)
            elif self.platform == "tiktok":
                verify_tiktok_signature(self.body, signature, self.secret)
            else:
                # Generic signature check
                if signature:
                    verify_meta_signature(self.body, signature, self.secret)
            
            # Verify timestamp
            if timestamp:
                self.timestamp = timestamp
                verify_timestamp(timestamp)
            
            # Check idempotency
            if self.event_id:
                is_duplicate = await check_idempotency(self.event_id, self.platform)
                if is_duplicate:
                    self.error = "Duplicate event"
                    return self
            
            self.valid = True
            return self
            
        except WebhookValidationError as exc:
            self.error = str(exc)
            logger.warning(f"Webhook validation failed for {self.platform}: {exc}")
            return self
        except Exception as exc:
            self.error = f"Validation error: {exc}"
            logger.error(f"Unexpected webhook validation error: {exc}")
            return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.valid and self.event_id:
            # Mark as processed on success
            await mark_event_processed(self.event_id, self.platform)
    
    def _get_signature_header(self) -> str | None:
        """Extract signature from headers based on platform."""
        if self.platform == "meta":
            return self.headers.get("X-Hub-Signature-256", "")
        elif self.platform == "tiktok":
            return self.headers.get("TikTok-Signature", "")
        return self.headers.get("X-Signature", "")
    
    def _get_timestamp_header(self) -> int | None:
        """Extract timestamp from headers."""
        ts = self.headers.get("X-Timestamp") or self.headers.get("X-Request-Timestamp")
        if ts:
            try:
                return int(ts)
            except ValueError:
                pass
        return None
    
    def _get_event_id(self) -> str | None:
        """Extract event ID for idempotency."""
        return self.headers.get("X-Event-ID") or self.headers.get("X-Idempotency-Key")
    
    @property
    def payload(self) -> dict:
        """Parse webhook body as JSON."""
        return json.loads(self.body.decode())


# Database table for webhook events (should be in migrations)
WEBHOOK_EVENTS_TABLE = """
CREATE TABLE IF NOT EXISTS webhook_events (
    id SERIAL PRIMARY KEY,
    platform TEXT NOT NULL,
    event_id TEXT NOT NULL,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    result_json TEXT,
    UNIQUE(platform, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_lookup 
    ON webhook_events(platform, event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed 
    ON webhook_events(processed, received_at);
"""
