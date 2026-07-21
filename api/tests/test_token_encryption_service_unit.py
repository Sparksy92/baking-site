"""Unit tests for token_encryption_service encrypt/decrypt — no DB."""
import pytest
from unittest.mock import MagicMock, patch


def _mock_settings(secret="test-secret-32-bytes-long-enough!!"):
    s = MagicMock()
    s.token_encryption_secret = secret
    return s


# ── _derive_key_with_salt ─────────────────────────────────────────────────────

def test_derive_key_returns_bytes():
    from app.services.token_encryption_service import _derive_key_with_salt
    key = _derive_key_with_salt("secret", b"saltsaltsalt1234")
    assert isinstance(key, bytes) and len(key) > 0


def test_derive_key_deterministic():
    from app.services.token_encryption_service import _derive_key_with_salt
    k1 = _derive_key_with_salt("secret", b"salt1234567890ab")
    k2 = _derive_key_with_salt("secret", b"salt1234567890ab")
    assert k1 == k2


def test_derive_key_different_salts_differ():
    from app.services.token_encryption_service import _derive_key_with_salt
    k1 = _derive_key_with_salt("secret", b"salt1234567890ab")
    k2 = _derive_key_with_salt("secret", b"different_salt_x")
    assert k1 != k2


def test_derive_key_different_secrets_differ():
    from app.services.token_encryption_service import _derive_key_with_salt
    salt = b"samesaltsamesalt"
    k1 = _derive_key_with_salt("secret_a", salt)
    k2 = _derive_key_with_salt("secret_b", salt)
    assert k1 != k2


# ── encrypt_token / decrypt_token round-trip ──────────────────────────────────

def test_encrypt_decrypt_roundtrip(monkeypatch):
    from app.services.token_encryption_service import encrypt_token, decrypt_token
    monkeypatch.setattr("app.services.token_encryption_service.get_settings",
                        lambda: _mock_settings())
    plaintext = "EAAB_some_meta_access_token_abc123"
    encrypted = encrypt_token(plaintext)
    assert encrypted != plaintext
    assert decrypt_token(encrypted) == plaintext


def test_encrypt_empty_returns_empty(monkeypatch):
    from app.services.token_encryption_service import encrypt_token
    monkeypatch.setattr("app.services.token_encryption_service.get_settings",
                        lambda: _mock_settings())
    assert encrypt_token("") == ""


def test_decrypt_empty_returns_empty(monkeypatch):
    from app.services.token_encryption_service import decrypt_token
    monkeypatch.setattr("app.services.token_encryption_service.get_settings",
                        lambda: _mock_settings())
    assert decrypt_token("") == ""


def test_encrypt_output_has_v2_prefix(monkeypatch):
    from app.services.token_encryption_service import encrypt_token
    monkeypatch.setattr("app.services.token_encryption_service.get_settings",
                        lambda: _mock_settings())
    result = encrypt_token("some_token")
    assert result.startswith("v2:")


def test_encrypt_produces_unique_ciphertext_each_call(monkeypatch):
    from app.services.token_encryption_service import encrypt_token
    monkeypatch.setattr("app.services.token_encryption_service.get_settings",
                        lambda: _mock_settings())
    # Random salt → different ciphertext every time
    e1 = encrypt_token("same_plaintext")
    e2 = encrypt_token("same_plaintext")
    assert e1 != e2


def test_encrypt_long_token(monkeypatch):
    from app.services.token_encryption_service import encrypt_token, decrypt_token
    monkeypatch.setattr("app.services.token_encryption_service.get_settings",
                        lambda: _mock_settings())
    long_token = "x" * 500
    encrypted = encrypt_token(long_token)
    assert decrypt_token(encrypted) == long_token


def test_decrypt_wrong_secret_raises(monkeypatch):
    from app.services.token_encryption_service import encrypt_token, decrypt_token
    monkeypatch.setattr("app.services.token_encryption_service.get_settings",
                        lambda: _mock_settings("correct-secret-xx"))
    encrypted = encrypt_token("my_token")

    monkeypatch.setattr("app.services.token_encryption_service.get_settings",
                        lambda: _mock_settings("wrong-secret-yyyy"))
    with pytest.raises(Exception):
        decrypt_token(encrypted)


def test_decrypt_no_secret_raises(monkeypatch):
    from app.services.token_encryption_service import decrypt_token
    s = MagicMock()
    s.token_encryption_secret = None
    monkeypatch.setattr("app.services.token_encryption_service.get_settings", lambda: s)
    with pytest.raises(Exception):
        decrypt_token("v2:somegarbagedata")


def test_encrypt_returns_string(monkeypatch):
    from app.services.token_encryption_service import encrypt_token
    monkeypatch.setattr("app.services.token_encryption_service.get_settings",
                        lambda: _mock_settings())
    result = encrypt_token("token_value")
    assert isinstance(result, str)


def test_decrypt_tampered_ciphertext_raises(monkeypatch):
    from app.services.token_encryption_service import encrypt_token, decrypt_token
    monkeypatch.setattr("app.services.token_encryption_service.get_settings",
                        lambda: _mock_settings())
    encrypted = encrypt_token("sensitive_token")
    # Tamper with the ciphertext by flipping bytes at the end
    tampered = encrypted[:-4] + "XXXX"
    with pytest.raises(Exception):
        decrypt_token(tampered)
