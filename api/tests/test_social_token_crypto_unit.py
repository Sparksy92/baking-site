"""Unit tests for social/token_crypto.py — no DB or network."""
import pytest
from unittest.mock import MagicMock

from app.services.social.token_crypto import TokenCryptoError


def _settings(secret="test-social-secret-256bit-long-enough!!"):
    s = MagicMock()
    s.social_token_encryption_key = secret
    return s


# ── _derive_fernet_key ────────────────────────────────────────────────────────

def test_derive_fernet_key_returns_bytes():
    from app.services.social.token_crypto import _derive_fernet_key
    key = _derive_fernet_key("my-secret", b"saltsaltsaltsalt" * 2)
    assert isinstance(key, bytes) and len(key) > 0


def test_derive_fernet_key_deterministic():
    from app.services.social.token_crypto import _derive_fernet_key
    salt = b"s" * 32
    k1 = _derive_fernet_key("secret", salt)
    k2 = _derive_fernet_key("secret", salt)
    assert k1 == k2


def test_derive_fernet_key_different_salts_differ():
    from app.services.social.token_crypto import _derive_fernet_key
    k1 = _derive_fernet_key("secret", b"a" * 32)
    k2 = _derive_fernet_key("secret", b"b" * 32)
    assert k1 != k2


def test_derive_fernet_key_different_secrets_differ():
    from app.services.social.token_crypto import _derive_fernet_key
    salt = b"x" * 32
    k1 = _derive_fernet_key("secret_a", salt)
    k2 = _derive_fernet_key("secret_b", salt)
    assert k1 != k2


# ── _get_secret ───────────────────────────────────────────────────────────────

def test_get_secret_returns_value():
    from app.services.social.token_crypto import _get_secret
    s = _settings("my-key")
    assert _get_secret(s) == "my-key"


def test_get_secret_none_raises():
    from app.services.social.token_crypto import _get_secret
    s = _settings(None)
    with pytest.raises(TokenCryptoError, match="not configured"):
        _get_secret(s)


def test_get_secret_empty_string_raises():
    from app.services.social.token_crypto import _get_secret
    s = _settings("")
    with pytest.raises(TokenCryptoError):
        _get_secret(s)


# ── encrypt_token / decrypt_token ─────────────────────────────────────────────

def test_encrypt_none_returns_none():
    from app.services.social.token_crypto import encrypt_token
    assert encrypt_token(None, _settings()) is None


def test_encrypt_empty_returns_none():
    from app.services.social.token_crypto import encrypt_token
    assert encrypt_token("", _settings()) is None


def test_decrypt_none_returns_none():
    from app.services.social.token_crypto import decrypt_token
    assert decrypt_token(None, _settings()) is None


def test_decrypt_empty_returns_none():
    from app.services.social.token_crypto import decrypt_token
    assert decrypt_token("", _settings()) is None


def test_encrypt_decrypt_roundtrip():
    from app.services.social.token_crypto import encrypt_token, decrypt_token
    s = _settings()
    token = "EAAB_facebook_access_token_abc123"
    encrypted = encrypt_token(token, s)
    assert encrypted != token
    assert decrypt_token(encrypted, s) == token


def test_encrypted_starts_with_v2_prefix():
    from app.services.social.token_crypto import encrypt_token
    result = encrypt_token("some_token", _settings())
    assert result.startswith("v2:")


def test_encrypt_produces_unique_ciphertext():
    from app.services.social.token_crypto import encrypt_token
    s = _settings()
    e1 = encrypt_token("same", s)
    e2 = encrypt_token("same", s)
    assert e1 != e2  # random salt per call


def test_encrypt_long_token_roundtrip():
    from app.services.social.token_crypto import encrypt_token, decrypt_token
    s = _settings()
    long_token = "t" * 1000
    assert decrypt_token(encrypt_token(long_token, s), s) == long_token


def test_decrypt_wrong_secret_raises():
    from app.services.social.token_crypto import encrypt_token, decrypt_token
    encrypted = encrypt_token("my_token", _settings("correct-secret"))
    with pytest.raises(TokenCryptoError):
        decrypt_token(encrypted, _settings("wrong-secret"))


def test_decrypt_no_secret_raises():
    from app.services.social.token_crypto import decrypt_token
    with pytest.raises(TokenCryptoError, match="not configured"):
        decrypt_token("v2:somegarbagedata", _settings(None))


def test_decrypt_tampered_raises():
    from app.services.social.token_crypto import encrypt_token, decrypt_token
    s = _settings()
    encrypted = encrypt_token("token", s)
    tampered = encrypted[:-4] + "XXXX"
    with pytest.raises(TokenCryptoError):
        decrypt_token(tampered, s)


def test_encrypt_returns_string():
    from app.services.social.token_crypto import encrypt_token
    result = encrypt_token("access_token_xyz", _settings())
    assert isinstance(result, str)
