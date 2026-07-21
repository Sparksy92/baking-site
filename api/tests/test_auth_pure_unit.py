"""Unit tests for auth.py pure functions — no DB or HTTP."""
import pytest
from unittest.mock import MagicMock
from datetime import datetime, timezone
import jwt as pyjwt


def _settings(secret="test-jwt-secret", algorithm="HS256", lifetime_hours=24):
    s = MagicMock()
    s.admin_jwt_secret = secret
    s.admin_jwt_algorithm = algorithm
    s.admin_jwt_lifetime_hours = lifetime_hours
    return s


# ── hash_password / verify_password ──────────────────────────────────────────

def test_hash_password_returns_string():
    from app.auth import hash_password
    result = hash_password("mypassword")
    assert isinstance(result, str) and len(result) > 0


def test_hash_password_not_plaintext():
    from app.auth import hash_password
    result = hash_password("mypassword")
    assert result != "mypassword"


def test_hash_password_different_hashes_each_call():
    from app.auth import hash_password
    h1 = hash_password("same_password")
    h2 = hash_password("same_password")
    assert h1 != h2  # bcrypt uses random salt


def test_verify_password_correct():
    from app.auth import hash_password, verify_password
    hashed = hash_password("correctpassword")
    assert verify_password("correctpassword", hashed) is True


def test_verify_password_wrong():
    from app.auth import hash_password, verify_password
    hashed = hash_password("correctpassword")
    assert verify_password("wrongpassword", hashed) is False


def test_verify_password_empty_fails():
    from app.auth import hash_password, verify_password
    hashed = hash_password("somepassword")
    assert verify_password("", hashed) is False


def test_verify_password_case_sensitive():
    from app.auth import hash_password, verify_password
    hashed = hash_password("Password123")
    assert verify_password("password123", hashed) is False


# ── create_access_token ───────────────────────────────────────────────────────

def test_create_access_token_returns_string():
    from app.auth import create_access_token
    s = _settings()
    result = create_access_token("admin@test.com", "admin", settings=s)
    assert isinstance(result, str) and len(result) > 0


def test_create_access_token_decodable():
    from app.auth import create_access_token
    s = _settings()
    token = create_access_token("admin@test.com", "admin", settings=s)
    payload = pyjwt.decode(token, s.admin_jwt_secret, algorithms=[s.admin_jwt_algorithm])
    assert payload["sub"] == "admin@test.com"
    assert payload["role"] == "admin"


def test_create_access_token_display_name():
    from app.auth import create_access_token
    s = _settings()
    token = create_access_token("admin@test.com", "admin", display_name="Alice", settings=s)
    payload = pyjwt.decode(token, s.admin_jwt_secret, algorithms=[s.admin_jwt_algorithm])
    assert payload["display_name"] == "Alice"


def test_create_access_token_default_display_name_is_username():
    from app.auth import create_access_token
    s = _settings()
    token = create_access_token("admin@test.com", "admin", settings=s)
    payload = pyjwt.decode(token, s.admin_jwt_secret, algorithms=[s.admin_jwt_algorithm])
    assert payload["display_name"] == "admin@test.com"


def test_create_access_token_permissions_field():
    from app.auth import create_access_token
    s = _settings()
    token = create_access_token("u", "admin", permissions="read_only", settings=s)
    payload = pyjwt.decode(token, s.admin_jwt_secret, algorithms=[s.admin_jwt_algorithm])
    assert payload["permissions"] == "read_only"


def test_create_access_token_has_exp_and_iat():
    from app.auth import create_access_token
    s = _settings()
    token = create_access_token("u", "admin", settings=s)
    payload = pyjwt.decode(token, s.admin_jwt_secret, algorithms=[s.admin_jwt_algorithm])
    assert "exp" in payload
    assert "iat" in payload


def test_create_access_token_exp_in_future():
    from app.auth import create_access_token
    s = _settings(lifetime_hours=1)
    token = create_access_token("u", "admin", settings=s)
    payload = pyjwt.decode(token, s.admin_jwt_secret, algorithms=[s.admin_jwt_algorithm])
    now = datetime.now(timezone.utc).timestamp()
    assert payload["exp"] > now


# ── decode_token ──────────────────────────────────────────────────────────────

def test_decode_token_valid():
    from app.auth import create_access_token, decode_token
    s = _settings()
    token = create_access_token("user@example.com", "staff", settings=s)
    payload = decode_token(token, settings=s)
    assert payload["sub"] == "user@example.com"
    assert payload["role"] == "staff"


def test_decode_token_wrong_secret_raises():
    from app.auth import create_access_token, decode_token
    s_good = _settings(secret="good-secret")
    s_bad = _settings(secret="bad-secret")
    token = create_access_token("u", "admin", settings=s_good)
    with pytest.raises(Exception):
        decode_token(token, settings=s_bad)


def test_decode_token_expired_raises():
    from app.auth import decode_token
    s = _settings()
    # Manually create an expired token
    payload = {
        "sub": "u",
        "role": "admin",
        "exp": datetime(2020, 1, 1, tzinfo=timezone.utc),
        "iat": datetime(2020, 1, 1, tzinfo=timezone.utc),
    }
    expired_token = pyjwt.encode(payload, s.admin_jwt_secret, algorithm=s.admin_jwt_algorithm)
    with pytest.raises(Exception):
        decode_token(expired_token, settings=s)


def test_decode_token_tampered_raises():
    from app.auth import create_access_token, decode_token
    s = _settings()
    token = create_access_token("u", "admin", settings=s)
    tampered = token[:-4] + "XXXX"
    with pytest.raises(Exception):
        decode_token(tampered, settings=s)
