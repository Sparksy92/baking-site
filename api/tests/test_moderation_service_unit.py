"""Unit tests for moderation_service pure-logic functions.
Tests _check_rule_match without a database."""
import pytest


def _rule(rule_type, condition, pattern, action="hide"):
    return {
        "id": 1,
        "name": "test-rule",
        "rule_type": rule_type,
        "condition": condition,
        "pattern": pattern,
        "action": action,
        "is_active": True,
    }


# ── keyword rules ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_keyword_contains_match():
    from app.services.moderation_service import _check_rule_match
    matched, reason = await _check_rule_match(
        _rule("keyword", "contains", "spam"), "This is spam text", "user1"
    )
    assert matched is True
    assert "spam" in reason.lower()


@pytest.mark.asyncio
async def test_keyword_contains_no_match():
    from app.services.moderation_service import _check_rule_match
    matched, _ = await _check_rule_match(
        _rule("keyword", "contains", "badword"), "This is clean text", "user1"
    )
    assert matched is False


@pytest.mark.asyncio
async def test_keyword_contains_case_insensitive():
    from app.services.moderation_service import _check_rule_match
    matched, _ = await _check_rule_match(
        _rule("keyword", "contains", "SPAM"), "this is spam", "user1"
    )
    assert matched is True


@pytest.mark.asyncio
async def test_keyword_regex_match():
    from app.services.moderation_service import _check_rule_match
    matched, reason = await _check_rule_match(
        _rule("keyword", "regex", r"https?://\S+"), "Check this http://evil.com link", "user1"
    )
    assert matched is True


@pytest.mark.asyncio
async def test_keyword_regex_no_match():
    from app.services.moderation_service import _check_rule_match
    matched, _ = await _check_rule_match(
        _rule("keyword", "regex", r"^\d{16}$"), "This is normal text", "user1"
    )
    assert matched is False


@pytest.mark.asyncio
async def test_keyword_invalid_regex_does_not_raise():
    from app.services.moderation_service import _check_rule_match
    matched, _ = await _check_rule_match(
        _rule("keyword", "regex", r"[invalid(regex"), "some text", "user1"
    )
    assert matched is False


# ── spam rules ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_spam_regex_match():
    from app.services.moderation_service import _check_rule_match
    matched, reason = await _check_rule_match(
        _rule("spam", "regex", r"(.)\1{5,}"), "aaaaaaaaaa spam", "user1"
    )
    assert matched is True
    assert "spam" in reason.lower()


@pytest.mark.asyncio
async def test_spam_regex_no_match():
    from app.services.moderation_service import _check_rule_match
    matched, _ = await _check_rule_match(
        _rule("spam", "regex", r"(.)\1{5,}"), "normal comment here", "user1"
    )
    assert matched is False


# ── user_block rules ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_user_block_match():
    from app.services.moderation_service import _check_rule_match
    matched, reason = await _check_rule_match(
        _rule("user_block", "user_in_list", "spammer1, badactor2"), "hello", "spammer1"
    )
    assert matched is True
    assert "spammer1" in reason.lower()


@pytest.mark.asyncio
async def test_user_block_case_insensitive():
    from app.services.moderation_service import _check_rule_match
    matched, _ = await _check_rule_match(
        _rule("user_block", "user_in_list", "Spammer1"), "hello", "SPAMMER1"
    )
    assert matched is True


@pytest.mark.asyncio
async def test_user_block_no_match():
    from app.services.moderation_service import _check_rule_match
    matched, _ = await _check_rule_match(
        _rule("user_block", "user_in_list", "spammer1, badactor"), "hello", "gooduser"
    )
    assert matched is False


# ── unknown rule type ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_unknown_rule_type_returns_no_match():
    from app.services.moderation_service import _check_rule_match
    matched, reason = await _check_rule_match(
        _rule("unknown_type", "contains", "test"), "test text", "user1"
    )
    assert matched is False
    assert reason == ""


# ── sentiment rule (passive) ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sentiment_rule_does_not_match_passively():
    from app.services.moderation_service import _check_rule_match
    matched, _ = await _check_rule_match(
        _rule("sentiment", "lt", "-0.5"), "terrible awful worst", "user1"
    )
    assert matched is False
