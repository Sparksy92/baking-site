"""Tests for webhook_security_service — HMAC verification, timestamp validation,
IP allowlisting, and WebhookSecurityContext."""
import hashlib
import hmac
import time
import pytest


# ── verify_meta_signature ─────────────────────────────────────────────────────

def test_meta_signature_valid():
    from app.services.webhook_security_service import verify_meta_signature
    secret = "test_secret"
    payload = b'{"object":"page"}'
    mac = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    assert verify_meta_signature(payload, f"sha256={mac}", secret) is True


def test_meta_signature_mismatch_raises():
    from app.services.webhook_security_service import verify_meta_signature, WebhookValidationError
    with pytest.raises(WebhookValidationError, match="Signature mismatch"):
        verify_meta_signature(b"body", "sha256=deadbeef", "secret")


def test_meta_signature_missing_raises():
    from app.services.webhook_security_service import verify_meta_signature, WebhookValidationError
    with pytest.raises(WebhookValidationError, match="Missing"):
        verify_meta_signature(b"body", "", "secret")


def test_meta_signature_bad_format_raises():
    from app.services.webhook_security_service import verify_meta_signature, WebhookValidationError
    with pytest.raises(WebhookValidationError, match="Invalid signature format"):
        verify_meta_signature(b"body", "md5=abc123", "secret")


# ── verify_tiktok_signature ───────────────────────────────────────────────────

def test_tiktok_signature_valid():
    from app.services.webhook_security_service import verify_tiktok_signature
    secret = "tiktok_secret"
    payload = b'{"event":"video"}'
    mac = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    assert verify_tiktok_signature(payload, mac, secret) is True


def test_tiktok_signature_missing_raises():
    from app.services.webhook_security_service import verify_tiktok_signature, WebhookValidationError
    with pytest.raises(WebhookValidationError, match="Missing"):
        verify_tiktok_signature(b"body", "", "secret")


def test_tiktok_signature_mismatch_raises():
    from app.services.webhook_security_service import verify_tiktok_signature, WebhookValidationError
    with pytest.raises(WebhookValidationError, match="mismatch"):
        verify_tiktok_signature(b"body", "wrongmac", "secret")


# ── verify_timestamp ──────────────────────────────────────────────────────────

def test_timestamp_current_is_valid():
    from app.services.webhook_security_service import verify_timestamp
    assert verify_timestamp(int(time.time())) is True


def test_timestamp_string_is_accepted():
    from app.services.webhook_security_service import verify_timestamp
    assert verify_timestamp(str(int(time.time()))) is True


def test_timestamp_too_old_raises():
    from app.services.webhook_security_service import verify_timestamp, WebhookValidationError
    old = int(time.time()) - 400
    with pytest.raises(WebhookValidationError, match="too old"):
        verify_timestamp(old, max_age_seconds=300)


def test_timestamp_far_future_raises():
    from app.services.webhook_security_service import verify_timestamp, WebhookValidationError
    future = int(time.time()) + 120
    with pytest.raises(WebhookValidationError, match="future"):
        verify_timestamp(future)


def test_timestamp_minor_clock_skew_accepted():
    from app.services.webhook_security_service import verify_timestamp
    slightly_ahead = int(time.time()) + 30
    assert verify_timestamp(slightly_ahead) is True


def test_timestamp_invalid_format_raises():
    from app.services.webhook_security_service import verify_timestamp, WebhookValidationError
    with pytest.raises(WebhookValidationError, match="Invalid timestamp"):
        verify_timestamp("not-a-number")


# ── validate_ip_address ───────────────────────────────────────────────────────

def test_ip_no_allowlist_permits_all():
    from app.services.webhook_security_service import validate_ip_address
    assert validate_ip_address("1.2.3.4", None) is True
    assert validate_ip_address("1.2.3.4", []) is True


def test_ip_in_allowlist():
    from app.services.webhook_security_service import validate_ip_address
    assert validate_ip_address("10.0.0.1", ["10.0.0.1", "10.0.0.2"]) is True


def test_ip_not_in_allowlist():
    from app.services.webhook_security_service import validate_ip_address
    assert validate_ip_address("9.9.9.9", ["10.0.0.1"]) is False


# ── WebhookSecurityContext ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_context_valid_meta_signature():
    from app.services.webhook_security_service import WebhookSecurityContext
    secret = "ctx_secret"
    body = b'{"object":"page","entry":[]}'
    mac = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    headers = {"X-Hub-Signature-256": f"sha256={mac}"}

    async with WebhookSecurityContext("meta", headers, body, secret=secret) as ctx:
        assert ctx.valid is True
        assert ctx.error is None


@pytest.mark.asyncio
async def test_context_invalid_meta_signature():
    from app.services.webhook_security_service import WebhookSecurityContext
    body = b'{"object":"page"}'
    headers = {"X-Hub-Signature-256": "sha256=badhash"}

    async with WebhookSecurityContext("meta", headers, body, secret="secret") as ctx:
        assert ctx.valid is False
        assert ctx.error is not None


@pytest.mark.asyncio
async def test_context_no_signature_generic_platform():
    from app.services.webhook_security_service import WebhookSecurityContext
    body = b'{"event":"test"}'
    headers = {}  # No signature header

    async with WebhookSecurityContext("other", headers, body, secret="s") as ctx:
        assert ctx.valid is True


@pytest.mark.asyncio
async def test_context_payload_parsed():
    from app.services.webhook_security_service import WebhookSecurityContext
    secret = "s"
    body = b'{"key":"value"}'
    mac = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    headers = {"X-Hub-Signature-256": f"sha256={mac}"}

    async with WebhookSecurityContext("meta", headers, body, secret=secret) as ctx:
        assert ctx.payload == {"key": "value"}


@pytest.mark.asyncio
async def test_context_tiktok_signature_validated():
    from app.services.webhook_security_service import WebhookSecurityContext
    secret = "tiktok_ctx_secret"
    body = b'{"event":"video.publish"}'
    mac = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    headers = {"TikTok-Signature": mac}

    async with WebhookSecurityContext("tiktok", headers, body, secret=secret) as ctx:
        assert ctx.valid is True
