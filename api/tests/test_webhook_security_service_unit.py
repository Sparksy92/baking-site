"""Unit tests for webhook_security_service pure functions — no DB."""
import hashlib
import hmac
import time
import pytest

from app.services.webhook_security_service import WebhookValidationError


# ── verify_meta_signature ─────────────────────────────────────────────────────

def _make_meta_sig(payload: bytes, secret: str) -> str:
    mac = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return f"sha256={mac}"


def test_verify_meta_signature_valid():
    from app.services.webhook_security_service import verify_meta_signature
    payload = b'{"event": "test"}'
    secret = "my_app_secret"
    sig = _make_meta_sig(payload, secret)
    assert verify_meta_signature(payload, sig, secret) is True


def test_verify_meta_signature_wrong_secret():
    from app.services.webhook_security_service import verify_meta_signature
    payload = b'{"event": "test"}'
    sig = _make_meta_sig(payload, "correct_secret")
    with pytest.raises(WebhookValidationError, match="mismatch"):
        verify_meta_signature(payload, sig, "wrong_secret")


def test_verify_meta_signature_missing_header():
    from app.services.webhook_security_service import verify_meta_signature
    with pytest.raises(WebhookValidationError, match="Missing"):
        verify_meta_signature(b"payload", "", "secret")


def test_verify_meta_signature_none_header():
    from app.services.webhook_security_service import verify_meta_signature
    with pytest.raises(WebhookValidationError):
        verify_meta_signature(b"payload", None, "secret")


def test_verify_meta_signature_wrong_format():
    from app.services.webhook_security_service import verify_meta_signature
    with pytest.raises(WebhookValidationError, match="format"):
        verify_meta_signature(b"payload", "md5=abcdef", "secret")


def test_verify_meta_signature_tampered_payload():
    from app.services.webhook_security_service import verify_meta_signature
    payload = b'{"event": "test"}'
    secret = "secret"
    sig = _make_meta_sig(payload, secret)
    tampered = b'{"event": "tampered"}'
    with pytest.raises(WebhookValidationError, match="mismatch"):
        verify_meta_signature(tampered, sig, secret)


# ── verify_tiktok_signature ───────────────────────────────────────────────────

def _make_tiktok_sig(payload: bytes, secret: str) -> str:
    return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()


def test_verify_tiktok_signature_valid():
    from app.services.webhook_security_service import verify_tiktok_signature
    payload = b'{"type": "video.uploaded"}'
    secret = "tiktok_secret"
    sig = _make_tiktok_sig(payload, secret)
    assert verify_tiktok_signature(payload, sig, secret) is True


def test_verify_tiktok_signature_missing():
    from app.services.webhook_security_service import verify_tiktok_signature
    with pytest.raises(WebhookValidationError, match="Missing"):
        verify_tiktok_signature(b"payload", "", "secret")


def test_verify_tiktok_signature_mismatch():
    from app.services.webhook_security_service import verify_tiktok_signature
    payload = b"real payload"
    sig = _make_tiktok_sig(payload, "correct")
    with pytest.raises(WebhookValidationError, match="mismatch"):
        verify_tiktok_signature(payload, sig, "wrong_secret")


# ── verify_timestamp ──────────────────────────────────────────────────────────

def test_verify_timestamp_current():
    from app.services.webhook_security_service import verify_timestamp
    now = int(time.time())
    assert verify_timestamp(now) is True


def test_verify_timestamp_string_input():
    from app.services.webhook_security_service import verify_timestamp
    now = str(int(time.time()))
    assert verify_timestamp(now) is True


def test_verify_timestamp_too_old():
    from app.services.webhook_security_service import verify_timestamp
    old = int(time.time()) - 600  # 10 min ago
    with pytest.raises(WebhookValidationError, match="too old"):
        verify_timestamp(old, max_age_seconds=300)


def test_verify_timestamp_custom_max_age():
    from app.services.webhook_security_service import verify_timestamp
    old = int(time.time()) - 400
    assert verify_timestamp(old, max_age_seconds=600) is True


def test_verify_timestamp_far_future():
    from app.services.webhook_security_service import verify_timestamp
    future = int(time.time()) + 3600
    with pytest.raises(WebhookValidationError, match="future"):
        verify_timestamp(future)


def test_verify_timestamp_invalid_format():
    from app.services.webhook_security_service import verify_timestamp
    with pytest.raises(WebhookValidationError, match="Invalid"):
        verify_timestamp("not-a-timestamp")


def test_verify_timestamp_recent_past():
    from app.services.webhook_security_service import verify_timestamp
    recent = int(time.time()) - 10
    assert verify_timestamp(recent) is True


# ── validate_ip_address ───────────────────────────────────────────────────────

def test_validate_ip_no_allowlist():
    from app.services.webhook_security_service import validate_ip_address
    # No allowlist means all IPs pass
    assert validate_ip_address("1.2.3.4", allowed_ips=None) is True
    assert validate_ip_address("1.2.3.4", allowed_ips=[]) is True


def test_validate_ip_allowed():
    from app.services.webhook_security_service import validate_ip_address
    assert validate_ip_address("10.0.0.1", allowed_ips=["10.0.0.1", "10.0.0.2"]) is True


def test_validate_ip_not_allowed():
    from app.services.webhook_security_service import validate_ip_address
    assert validate_ip_address("9.9.9.9", allowed_ips=["10.0.0.1"]) is False


def test_validate_ip_empty_string():
    from app.services.webhook_security_service import validate_ip_address
    assert validate_ip_address("", allowed_ips=["10.0.0.1"]) is False
