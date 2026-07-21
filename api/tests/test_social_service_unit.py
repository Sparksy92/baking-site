"""Unit tests for social/service.py pure utility functions — no DB."""
import pytest
from datetime import datetime, timezone


# ── _loads_scopes ─────────────────────────────────────────────────────────────

def test_loads_scopes_json_list():
    from app.services.social.service import _loads_scopes
    result = _loads_scopes('["read:posts", "write:posts"]')
    assert result == ["read:posts", "write:posts"]


def test_loads_scopes_csv_fallback():
    from app.services.social.service import _loads_scopes
    result = _loads_scopes("read:posts, write:posts")
    assert result == ["read:posts", "write:posts"]


def test_loads_scopes_none_returns_empty():
    from app.services.social.service import _loads_scopes
    assert _loads_scopes(None) == []


def test_loads_scopes_empty_string_returns_empty():
    from app.services.social.service import _loads_scopes
    assert _loads_scopes("") == []


def test_loads_scopes_json_non_list_returns_empty():
    from app.services.social.service import _loads_scopes
    # JSON dict is not a list
    result = _loads_scopes('{"key": "value"}')
    assert result == []


def test_loads_scopes_invalid_json_falls_back_to_csv():
    from app.services.social.service import _loads_scopes
    result = _loads_scopes("scope1,scope2,scope3")
    assert result == ["scope1", "scope2", "scope3"]


# ── _loads_metadata ───────────────────────────────────────────────────────────

def test_loads_metadata_valid_json():
    from app.services.social.service import _loads_metadata
    result = _loads_metadata('{"page_id": "123", "ig_account_id": "456"}')
    assert result == {"page_id": "123", "ig_account_id": "456"}


def test_loads_metadata_none_returns_empty():
    from app.services.social.service import _loads_metadata
    assert _loads_metadata(None) == {}


def test_loads_metadata_empty_string_returns_empty():
    from app.services.social.service import _loads_metadata
    assert _loads_metadata("") == {}


def test_loads_metadata_invalid_json_returns_empty():
    from app.services.social.service import _loads_metadata
    assert _loads_metadata("{invalid json}") == {}


def test_loads_metadata_json_list_returns_empty():
    from app.services.social.service import _loads_metadata
    # Must be a dict, not a list
    assert _loads_metadata('["a", "b"]') == {}


# ── _loads_datetime ───────────────────────────────────────────────────────────

def test_loads_datetime_from_string():
    from app.services.social.service import _loads_datetime
    result = _loads_datetime("2024-01-15T10:30:00+00:00")
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_loads_datetime_from_z_suffix():
    from app.services.social.service import _loads_datetime
    result = _loads_datetime("2024-06-01T12:00:00Z")
    assert isinstance(result, datetime)


def test_loads_datetime_from_datetime_passthrough():
    from app.services.social.service import _loads_datetime
    dt = datetime(2024, 1, 1, tzinfo=timezone.utc)
    assert _loads_datetime(dt) is dt


def test_loads_datetime_none_returns_none():
    from app.services.social.service import _loads_datetime
    assert _loads_datetime(None) is None


def test_loads_datetime_invalid_string_returns_none():
    from app.services.social.service import _loads_datetime
    assert _loads_datetime("not-a-date") is None


def test_loads_datetime_empty_string_returns_none():
    from app.services.social.service import _loads_datetime
    assert _loads_datetime("") is None


# ── serialize_connection ──────────────────────────────────────────────────────

def test_serialize_connection_basic():
    from app.services.social.service import serialize_connection
    row = {
        "id": 1,
        "provider": "facebook",
        "account_type": "page",
        "display_name": "My Page",
        "external_account_id": "fb-123",
        "external_user_id": "user-456",
        "scopes": '["pages_manage_posts"]',
        "status": "connected",
        "last_error": None,
        "token_expires_at": None,
        "refresh_token_expires_at": None,
        "last_checked_at": None,
        "last_synced_at": None,
        "connected_by_user_id": None,
        "metadata": None,
        "created_at": None,
        "updated_at": None,
    }
    result = serialize_connection(row)
    assert result["id"] == 1
    assert result["provider"] == "facebook"
    assert result["scopes"] == ["pages_manage_posts"]
    assert result["metadata"] == {}


def test_serialize_connection_default_brand_id():
    from app.services.social.service import serialize_connection
    row = {
        "id": 2, "provider": "instagram", "account_type": "business",
        "display_name": None, "external_account_id": "ig-789",
        "external_user_id": None, "scopes": None, "status": "connected",
        "last_error": None, "token_expires_at": None,
        "refresh_token_expires_at": None, "last_checked_at": None,
        "last_synced_at": None, "connected_by_user_id": None,
        "metadata": None, "created_at": None, "updated_at": None,
    }
    result = serialize_connection(row)
    assert result["brand_id"] == "default"
    assert result["scopes"] == []
