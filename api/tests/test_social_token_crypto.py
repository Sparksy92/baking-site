"""Tests for social/token_crypto.py — v2 encryption, legacy compat, error paths."""
import base64
import os
import pytest
from unittest.mock import MagicMock

os.environ["SOCIAL_TOKEN_ENCRYPTION_KEY"] = "test-social-encryption-key-secure"


@pytest.fixture(autouse=True)
def _clear_cache():
    from app.config import get_settings
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _mock_settings(key="test-social-encryption-key-secure"):
    s = MagicMock()
    s.social_token_encryption_key = key
    return s


# ── encrypt_token ─────────────────────────────────────────────────────────────

def test_encrypt_token_returns_v2_prefix():
    from app.services.social.token_crypto import encrypt_token
    result = encrypt_token("access_token_abc123", _mock_settings())
    assert result is not None
    assert result.startswith("v2:")


def test_encrypt_token_none_returns_none():
    from app.services.social.token_crypto import encrypt_token
    assert encrypt_token(None, _mock_settings()) is None


def test_encrypt_token_empty_string_returns_none():
    from app.services.social.token_crypto import encrypt_token
    assert encrypt_token("", _mock_settings()) is None


def test_encrypt_token_each_call_unique():
    from app.services.social.token_crypto import encrypt_token
    s = _mock_settings()
    t = "same_token"
    assert encrypt_token(t, s) != encrypt_token(t, s)


def test_encrypt_token_no_key_raises():
    from app.services.social.token_crypto import encrypt_token, TokenCryptoError
    with pytest.raises(TokenCryptoError, match="not configured"):
        encrypt_token("token", _mock_settings(key=None))


# ── decrypt_token ─────────────────────────────────────────────────────────────

def test_decrypt_token_roundtrip():
    from app.services.social.token_crypto import encrypt_token, decrypt_token
    s = _mock_settings()
    original = "EAABxxxxYYYY"
    assert decrypt_token(encrypt_token(original, s), s) == original


def test_decrypt_token_none_returns_none():
    from app.services.social.token_crypto import decrypt_token
    assert decrypt_token(None, _mock_settings()) is None


def test_decrypt_token_empty_returns_none():
    from app.services.social.token_crypto import decrypt_token
    assert decrypt_token("", _mock_settings()) is None


def test_decrypt_token_legacy_backwards_compat():
    """v1 tokens (no v2: prefix) should decrypt with legacy salt."""
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from app.services.social.token_crypto import decrypt_token, _LEGACY_SALT

    secret = "test-social-encryption-key-secure"
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=_LEGACY_SALT, iterations=200_000)
    key = base64.urlsafe_b64encode(kdf.derive(secret.encode()))
    legacy = Fernet(key).encrypt(b"legacy_oauth_token").decode()

    s = _mock_settings(secret)
    assert decrypt_token(legacy, s) == "legacy_oauth_token"


def test_decrypt_token_tampered_raises():
    from app.services.social.token_crypto import encrypt_token, decrypt_token, TokenCryptoError
    s = _mock_settings()
    enc = encrypt_token("real_token", s)
    tampered = enc[:-6] + "XXXXXX"
    with pytest.raises(TokenCryptoError):
        decrypt_token(tampered, s)


def test_decrypt_token_wrong_key_raises():
    from app.services.social.token_crypto import encrypt_token, decrypt_token, TokenCryptoError
    enc = encrypt_token("token", _mock_settings("key-one-secret-value"))
    with pytest.raises(TokenCryptoError):
        decrypt_token(enc, _mock_settings("different-key-value"))


def test_decrypt_token_no_key_raises():
    from app.services.social.token_crypto import decrypt_token, TokenCryptoError
    with pytest.raises(TokenCryptoError, match="not configured"):
        decrypt_token("v2:somejunk", _mock_settings(key=None))


# ── _derive_fernet_key ────────────────────────────────────────────────────────

def test_derive_fernet_key_deterministic():
    from app.services.social.token_crypto import _derive_fernet_key
    salt = b"fixed_test_salt_32bytesxxxxxxxxx"
    k1 = _derive_fernet_key("secret", salt)
    k2 = _derive_fernet_key("secret", salt)
    assert k1 == k2


def test_derive_fernet_key_different_salts():
    from app.services.social.token_crypto import _derive_fernet_key
    import secrets as sec
    k1 = _derive_fernet_key("secret", sec.token_bytes(32))
    k2 = _derive_fernet_key("secret", sec.token_bytes(32))
    assert k1 != k2


# ── _get_secret ───────────────────────────────────────────────────────────────

def test_get_secret_raises_when_not_set():
    from app.services.social.token_crypto import _get_secret, TokenCryptoError
    with pytest.raises(TokenCryptoError):
        _get_secret(_mock_settings(key=""))
