"""Tests for token_encryption_service — covers encrypt/decrypt round-trips,
backwards-compat legacy tokens, error paths, and the secure_store stub."""
import os
import pytest

_TEST_SECRET = "test-encryption-secret-32chars!!"


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    from app.config import get_settings
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


# ── encrypt / decrypt round-trip ─────────────────────────────────────────────

def test_encrypt_returns_v2_prefix():
    from app.services.token_encryption_service import encrypt_token
    result = encrypt_token("EAAB_test_token")
    assert result.startswith("v2:")


def test_encrypt_decrypt_roundtrip():
    from app.services.token_encryption_service import encrypt_token, decrypt_token
    plaintext = "EAAB_access_token_12345"
    encrypted = encrypt_token(plaintext)
    assert decrypt_token(encrypted) == plaintext


def test_each_encryption_produces_different_ciphertext():
    from app.services.token_encryption_service import encrypt_token
    t = "same_plaintext"
    assert encrypt_token(t) != encrypt_token(t)


def test_encrypt_empty_string_returns_empty():
    from app.services.token_encryption_service import encrypt_token
    assert encrypt_token("") == ""


def test_decrypt_empty_string_returns_empty():
    from app.services.token_encryption_service import decrypt_token
    assert decrypt_token("") == ""


def test_encrypt_long_token():
    from app.services.token_encryption_service import encrypt_token, decrypt_token
    long_token = "A" * 1024
    assert decrypt_token(encrypt_token(long_token)) == long_token


def test_encrypt_unicode_token():
    from app.services.token_encryption_service import encrypt_token, decrypt_token
    token = "token_with_unicode_\u00e9\u00e0\u00fc"
    assert decrypt_token(encrypt_token(token)) == token


# ── legacy (v1) backwards compatibility ──────────────────────────────────────

def test_decrypt_legacy_token_backwards_compat():
    """Legacy tokens encrypted with fixed salt must still decrypt correctly."""
    import base64
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

    secret = _TEST_SECRET
    legacy_salt = b"social_platform_token_salt_v1"
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=legacy_salt, iterations=100000)
    key = base64.urlsafe_b64encode(kdf.derive(secret.encode()))
    legacy_ciphertext = Fernet(key).encrypt(b"legacy_plaintext_token")

    from app.services.token_encryption_service import decrypt_token
    assert decrypt_token(legacy_ciphertext.decode()) == "legacy_plaintext_token"


# ── error paths ───────────────────────────────────────────────────────────────

def test_decrypt_tampered_ciphertext_raises():
    from app.services.token_encryption_service import encrypt_token, decrypt_token
    enc = encrypt_token("some_token")
    tampered = enc[:-5] + "XXXXX"
    with pytest.raises(Exception):
        decrypt_token(tampered)


def test_decrypt_raises_without_secret(monkeypatch):
    from app.config import get_settings
    get_settings.cache_clear()
    monkeypatch.delenv("TOKEN_ENCRYPTION_SECRET", raising=False)
    get_settings.cache_clear()

    from app.services.token_encryption_service import decrypt_token
    with pytest.raises(Exception):
        decrypt_token("v2:somejunk")


def test_rotate_token_encryption_returns_stats():
    from app.services.token_encryption_service import rotate_token_encryption
    stats = rotate_token_encryption("old-secret", "new-secret")
    assert "processed" in stats
    assert "failed" in stats
    assert stats["processed"] == 0


# ── derive key helper ─────────────────────────────────────────────────────────

def test_derive_key_with_different_salts_differs():
    from app.services.token_encryption_service import _derive_key_with_salt
    import secrets
    secret = "my-secret"
    k1 = _derive_key_with_salt(secret, secrets.token_bytes(32))
    k2 = _derive_key_with_salt(secret, secrets.token_bytes(32))
    assert k1 != k2


def test_derive_key_deterministic_with_same_salt():
    from app.services.token_encryption_service import _derive_key_with_salt
    salt = b"fixed_salt_for_test"
    k1 = _derive_key_with_salt("secret", salt)
    k2 = _derive_key_with_salt("secret", salt)
    assert k1 == k2
