"""Unit tests for platform_variation_service pure functions.
No database or AI calls required."""
import pytest


# ── extract_hashtags ──────────────────────────────────────────────────────────

def test_extract_hashtags_basic():
    from app.services.platform_variation_service import extract_hashtags
    assert extract_hashtags("Great post #summer #sale") == ["#summer", "#sale"]


def test_extract_hashtags_empty():
    from app.services.platform_variation_service import extract_hashtags
    assert extract_hashtags("No hashtags here") == []


def test_extract_hashtags_empty_string():
    from app.services.platform_variation_service import extract_hashtags
    assert extract_hashtags("") == []


def test_extract_hashtags_inline_and_trailing():
    from app.services.platform_variation_service import extract_hashtags
    result = extract_hashtags("#first content #second")
    assert "#first" in result
    assert "#second" in result


def test_extract_hashtags_with_numbers():
    from app.services.platform_variation_service import extract_hashtags
    assert "#top10" in extract_hashtags("Check #top10 list")


def test_extract_hashtags_no_partial_url():
    from app.services.platform_variation_service import extract_hashtags
    result = extract_hashtags("Visit http://example.com #link")
    assert "#link" in result
    assert len(result) == 1


# ── remove_hashtags ───────────────────────────────────────────────────────────

def test_remove_hashtags_removes_all():
    from app.services.platform_variation_service import remove_hashtags
    result = remove_hashtags("Great post #summer #sale")
    assert "#" not in result
    assert "Great post" in result


def test_remove_hashtags_no_hashtags_unchanged():
    from app.services.platform_variation_service import remove_hashtags
    assert remove_hashtags("Clean text") == "Clean text"


def test_remove_hashtags_empty_string():
    from app.services.platform_variation_service import remove_hashtags
    assert remove_hashtags("") == ""


def test_remove_hashtags_only_hashtags():
    from app.services.platform_variation_service import remove_hashtags
    result = remove_hashtags("#a #b #c")
    assert result.strip() == ""


def test_remove_hashtags_strips_whitespace():
    from app.services.platform_variation_service import remove_hashtags
    result = remove_hashtags("Text  #tag  ")
    assert result == result.strip()


# ── truncate_to_limit ─────────────────────────────────────────────────────────

def test_truncate_no_truncation_needed():
    from app.services.platform_variation_service import truncate_to_limit
    text = "Short text"
    assert truncate_to_limit(text, 100) == text


def test_truncate_exactly_at_limit():
    from app.services.platform_variation_service import truncate_to_limit
    text = "A" * 280
    assert truncate_to_limit(text, 280) == text


def test_truncate_over_limit_adds_suffix():
    from app.services.platform_variation_service import truncate_to_limit
    text = "word " * 100  # 500 chars
    result = truncate_to_limit(text, 20)
    assert len(result) <= 20
    assert result.endswith("...")


def test_truncate_custom_suffix():
    from app.services.platform_variation_service import truncate_to_limit
    text = "hello world this is a long string"
    result = truncate_to_limit(text, 15, suffix=" [more]")
    assert result.endswith(" [more]")
    assert len(result) <= 15


def test_truncate_respects_word_boundary():
    from app.services.platform_variation_service import truncate_to_limit
    text = "hello world foo bar"
    result = truncate_to_limit(text, 14)
    assert not result.startswith("hello wor")  # Should not cut mid-word


def test_truncate_single_long_word():
    from app.services.platform_variation_service import truncate_to_limit
    text = "superlongwordwithnospacesinitatall"
    result = truncate_to_limit(text, 10)
    assert len(result) <= 10


# ── PLATFORM_LIMITS ───────────────────────────────────────────────────────────

def test_platform_limits_has_expected_platforms():
    from app.services.platform_variation_service import PLATFORM_LIMITS
    expected = {"instagram", "twitter", "facebook", "linkedin", "tiktok", "youtube"}
    assert expected.issubset(set(PLATFORM_LIMITS.keys()))


def test_platform_limits_twitter_280():
    from app.services.platform_variation_service import PLATFORM_LIMITS
    assert PLATFORM_LIMITS["twitter"]["max_chars"] == 280


def test_platform_limits_instagram_30_hashtags():
    from app.services.platform_variation_service import PLATFORM_LIMITS
    assert PLATFORM_LIMITS["instagram"]["max_hashtags"] == 30


def test_platform_limits_all_have_required_keys():
    from app.services.platform_variation_service import PLATFORM_LIMITS
    required = {"max_chars", "max_hashtags", "hashtag_placement", "supports_links", "tone"}
    for platform, limits in PLATFORM_LIMITS.items():
        missing = required - set(limits.keys())
        assert not missing, f"{platform} missing keys: {missing}"
