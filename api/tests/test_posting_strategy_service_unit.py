"""Unit tests for posting_strategy_service pure functions — no DB."""
import pytest


# ── _get_content_type_description ────────────────────────────────────────────

def test_content_type_description_known():
    from app.services.posting_strategy_service import _get_content_type_description
    assert "Teach" in _get_content_type_description("educational")
    assert "laugh" in _get_content_type_description("entertaining")
    assert "process" in _get_content_type_description("behind_scenes")
    assert "Sell" in _get_content_type_description("promotional")


def test_content_type_description_unknown_returns_fallback():
    from app.services.posting_strategy_service import _get_content_type_description
    result = _get_content_type_description("nonexistent_type")
    assert result == "Mixed content"


def test_content_type_description_all_known_types():
    from app.services.posting_strategy_service import _get_content_type_description
    known = ["educational", "entertaining", "behind_scenes", "promotional",
             "ugc", "community", "professional", "company_news"]
    for t in known:
        desc = _get_content_type_description(t)
        assert isinstance(desc, str) and len(desc) > 0
        assert desc != "Mixed content", f"{t} should have a specific description"


# ── _calculate_grade ──────────────────────────────────────────────────────────

def test_calculate_grade_a_plus():
    from app.services.posting_strategy_service import _calculate_grade
    result = _calculate_grade(actual=10, target=10, reply_rate=1.0)
    assert "A+" in result


def test_calculate_grade_a():
    from app.services.posting_strategy_service import _calculate_grade
    result = _calculate_grade(actual=8, target=10, reply_rate=0.8)
    assert result.startswith("A ")


def test_calculate_grade_b():
    from app.services.posting_strategy_service import _calculate_grade
    result = _calculate_grade(actual=5, target=10, reply_rate=0.5)
    assert result.startswith("B")


def test_calculate_grade_c():
    from app.services.posting_strategy_service import _calculate_grade
    result = _calculate_grade(actual=3, target=10, reply_rate=0.2)
    assert result.startswith("C")


def test_calculate_grade_d():
    from app.services.posting_strategy_service import _calculate_grade
    result = _calculate_grade(actual=1, target=10, reply_rate=0.1)
    assert result.startswith("D")


def test_calculate_grade_zero_target_no_crash():
    from app.services.posting_strategy_service import _calculate_grade
    result = _calculate_grade(actual=5, target=0, reply_rate=0.5)
    assert isinstance(result, str)


def test_calculate_grade_a_plus_requires_both_conditions():
    from app.services.posting_strategy_service import _calculate_grade
    # Good ratio but low reply rate — should not be A+
    result = _calculate_grade(actual=10, target=10, reply_rate=0.5)
    assert "A+" not in result


# ── _gary_vee_recommendations ─────────────────────────────────────────────────

def test_recommendations_low_volume():
    from app.services.posting_strategy_service import _gary_vee_recommendations
    recs = _gary_vee_recommendations(actual=2, target=10, reply_rate=0.9)
    combined = " ".join(recs)
    assert "less than half" in combined or "half" in combined


def test_recommendations_medium_volume():
    from app.services.posting_strategy_service import _gary_vee_recommendations
    recs = _gary_vee_recommendations(actual=7, target=10, reply_rate=0.9)
    combined = " ".join(recs)
    assert "push harder" in combined or "volume" in combined.lower()


def test_recommendations_low_reply_rate():
    from app.services.posting_strategy_service import _gary_vee_recommendations
    recs = _gary_vee_recommendations(actual=10, target=10, reply_rate=0.3)
    combined = " ".join(recs)
    assert "EVERY comment" in combined or "comment" in combined


def test_recommendations_medium_reply_rate():
    from app.services.posting_strategy_service import _gary_vee_recommendations
    recs = _gary_vee_recommendations(actual=10, target=10, reply_rate=0.6)
    combined = " ".join(recs)
    assert "90%" in combined or "aim" in combined


def test_recommendations_crushing_it():
    from app.services.posting_strategy_service import _gary_vee_recommendations
    recs = _gary_vee_recommendations(actual=10, target=10, reply_rate=1.0)
    combined = " ".join(recs)
    assert "crushing" in combined.lower()


def test_recommendations_returns_list():
    from app.services.posting_strategy_service import _gary_vee_recommendations
    recs = _gary_vee_recommendations(actual=5, target=10, reply_rate=0.5)
    assert isinstance(recs, list)
    assert len(recs) > 0


def test_recommendations_zero_target_no_crash():
    from app.services.posting_strategy_service import _gary_vee_recommendations
    recs = _gary_vee_recommendations(actual=5, target=0, reply_rate=0.5)
    assert isinstance(recs, list)
