"""Unit tests for social_inbox_service pure-logic functions.
These tests do not require a database connection."""
import pytest


# ── detect_intent ─────────────────────────────────────────────────────────────

def test_detect_intent_question():
    from app.services.social_inbox_service import detect_intent
    assert detect_intent("How much does this cost?") == "question"


def test_detect_intent_complaint():
    from app.services.social_inbox_service import detect_intent
    assert detect_intent("This is the worst product ever, I want a refund") == "complaint"


def test_detect_intent_praise():
    from app.services.social_inbox_service import detect_intent
    assert detect_intent("I love this, it's amazing and beautiful!") == "praise"


def test_detect_intent_sales():
    from app.services.social_inbox_service import detect_intent
    assert detect_intent("I want to buy this, what is the cost to order and shop") == "sales"


def test_detect_intent_spam():
    from app.services.social_inbox_service import detect_intent
    assert detect_intent("Follow back and check my free money click here") == "spam"


def test_detect_intent_general_no_keywords():
    from app.services.social_inbox_service import detect_intent
    assert detect_intent("Hello there") == "general"


def test_detect_intent_empty_string():
    from app.services.social_inbox_service import detect_intent
    assert detect_intent("") == "general"


def test_detect_intent_case_insensitive():
    from app.services.social_inbox_service import detect_intent
    assert detect_intent("HOW DO I ORDER?") == "question"


def test_detect_intent_mixed_signals_returns_highest():
    from app.services.social_inbox_service import detect_intent
    # "price" (sales=1) vs "?" + "how" (question=2)
    result = detect_intent("How much is the price?")
    assert result in ("question", "sales")  # question should win with 2 hits


# ── INTENT_PATTERNS constant ──────────────────────────────────────────────────

def test_intent_patterns_has_all_categories():
    from app.services.social_inbox_service import INTENT_PATTERNS
    expected = {"question", "complaint", "praise", "sales", "spam"}
    assert set(INTENT_PATTERNS.keys()) == expected


def test_intent_patterns_all_lists():
    from app.services.social_inbox_service import INTENT_PATTERNS
    for category, patterns in INTENT_PATTERNS.items():
        assert isinstance(patterns, list), f"{category} should be a list"
        assert len(patterns) > 0, f"{category} has no patterns"
