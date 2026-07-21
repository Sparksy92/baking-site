"""Unit tests for small pure functions across miscellaneous services."""
import pytest


# ── url_compliance_service.normalize_url ──────────────────────────────────────

def test_normalize_url_adds_https():
    from app.services.url_compliance_service import normalize_url
    assert normalize_url("example.com/path") == "https://example.com/path"


def test_normalize_url_already_https():
    from app.services.url_compliance_service import normalize_url
    assert normalize_url("https://example.com/path") == "https://example.com/path"


def test_normalize_url_already_http():
    from app.services.url_compliance_service import normalize_url
    assert normalize_url("http://example.com/path") == "http://example.com/path"


def test_normalize_url_lowercase():
    from app.services.url_compliance_service import normalize_url
    assert normalize_url("https://Example.COM/Path") == "https://example.com/path"


def test_normalize_url_strips_trailing_slash():
    from app.services.url_compliance_service import normalize_url
    assert normalize_url("https://example.com/path/") == "https://example.com/path"


def test_normalize_url_no_double_slash_strip():
    from app.services.url_compliance_service import normalize_url
    result = normalize_url("https://example.com")
    assert result == "https://example.com"


# ── content_library_service.calculate_balance_score ──────────────────────────

def test_balance_score_perfect_mix():
    from app.services.content_library_service import calculate_balance_score
    mix = {
        "educational": {"target_pct": 40, "delta": 0},
        "entertaining": {"target_pct": 30, "delta": 0},
        "promotional": {"target_pct": 30, "delta": 0},
    }
    score = calculate_balance_score(mix)
    assert score == 100.0


def test_balance_score_empty_mix():
    from app.services.content_library_service import calculate_balance_score
    assert calculate_balance_score({}) == 0


def test_balance_score_zero_target_ignored():
    from app.services.content_library_service import calculate_balance_score
    # Categories with target_pct=0 are excluded from scoring
    mix = {
        "other": {"target_pct": 0, "delta": 50},
        "educational": {"target_pct": 40, "delta": 0},
    }
    score = calculate_balance_score(mix)
    assert score == 100.0


def test_balance_score_large_deviation_lowers_score():
    from app.services.content_library_service import calculate_balance_score
    mix = {
        "educational": {"target_pct": 40, "delta": 20},  # 20% off target
        "entertaining": {"target_pct": 60, "delta": 0},
    }
    score_bad = calculate_balance_score(mix)
    mix_good = {
        "educational": {"target_pct": 40, "delta": 0},
        "entertaining": {"target_pct": 60, "delta": 0},
    }
    score_good = calculate_balance_score(mix_good)
    assert score_bad < score_good


def test_balance_score_returns_float():
    from app.services.content_library_service import calculate_balance_score
    mix = {"cat": {"target_pct": 50, "delta": 5}}
    result = calculate_balance_score(mix)
    assert isinstance(result, float)


# ── hashtag_service.extract_hashtags ─────────────────────────────────────────

def test_extract_hashtags_basic():
    from app.services.hashtag_service import extract_hashtags
    result = extract_hashtags("Love this #summer #sale")
    assert "#summer" in result
    assert "#sale" in result


def test_extract_hashtags_lowercased():
    from app.services.hashtag_service import extract_hashtags
    result = extract_hashtags("Check #Summer out")
    assert "#summer" in result
    assert "#Summer" not in result


def test_extract_hashtags_no_hashtags():
    from app.services.hashtag_service import extract_hashtags
    assert extract_hashtags("No hashtags here") == []


def test_extract_hashtags_empty_string():
    from app.services.hashtag_service import extract_hashtags
    assert extract_hashtags("") == []


def test_extract_hashtags_only_hashtags():
    from app.services.hashtag_service import extract_hashtags
    result = extract_hashtags("#one #two #three")
    assert result == ["#one", "#two", "#three"]


def test_extract_hashtags_returns_list():
    from app.services.hashtag_service import extract_hashtags
    assert isinstance(extract_hashtags("hello #world"), list)


# ── order_service._generate_order_number ─────────────────────────────────────

def test_generate_order_number_format():
    from app.services.order_service import _generate_order_number
    result = _generate_order_number("ELD")
    assert result.startswith("ELD-")
    suffix = result[4:]
    assert len(suffix) == 6


def test_generate_order_number_uppercase_alphanum():
    from app.services.order_service import _generate_order_number
    import string
    result = _generate_order_number("ELD")
    suffix = result[4:]
    valid_chars = set(string.ascii_uppercase + string.digits)
    assert all(c in valid_chars for c in suffix)


def test_generate_order_number_unique():
    from app.services.order_service import _generate_order_number
    nums = {_generate_order_number("TST") for _ in range(20)}
    # With 36^6 ≈ 2 billion combinations, 20 draws should always be unique
    assert len(nums) == 20


def test_generate_order_number_custom_prefix():
    from app.services.order_service import _generate_order_number
    assert _generate_order_number("MYSTORE").startswith("MYSTORE-")


# ── influencer_service.generate_tracking_code ────────────────────────────────

def test_generate_tracking_code_format():
    from app.services.influencer_service import generate_tracking_code
    code = generate_tracking_code()
    assert isinstance(code, str)
    assert len(code) > 0


def test_generate_tracking_code_unique():
    from app.services.influencer_service import generate_tracking_code
    codes = {generate_tracking_code() for _ in range(20)}
    assert len(codes) == 20


# ── social/oauth_state.hash_state ────────────────────────────────────────────

def test_hash_state_deterministic():
    from app.services.social.oauth_state import hash_state
    assert hash_state("abc123") == hash_state("abc123")


def test_hash_state_different_inputs():
    from app.services.social.oauth_state import hash_state
    assert hash_state("abc") != hash_state("xyz")


def test_hash_state_returns_string():
    from app.services.social.oauth_state import hash_state
    result = hash_state("test-state")
    assert isinstance(result, str) and len(result) > 0


def test_hash_state_hex_chars():
    from app.services.social.oauth_state import hash_state
    result = hash_state("something")
    assert all(c in "0123456789abcdef" for c in result)
