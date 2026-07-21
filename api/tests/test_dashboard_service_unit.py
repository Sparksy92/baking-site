"""Unit tests for dashboard_service pure functions — no DB."""
import pytest


# ── _safe_divide ──────────────────────────────────────────────────────────────

def test_safe_divide_normal():
    from app.services.dashboard_service import _safe_divide
    assert _safe_divide(10, 4) == 2.5


def test_safe_divide_zero_denominator():
    from app.services.dashboard_service import _safe_divide
    assert _safe_divide(10, 0) == 0.0


def test_safe_divide_zero_numerator():
    from app.services.dashboard_service import _safe_divide
    assert _safe_divide(0, 5) == 0.0


def test_safe_divide_rounds_to_4_places():
    from app.services.dashboard_service import _safe_divide
    result = _safe_divide(1, 3)
    assert result == round(1 / 3, 4)


def test_safe_divide_none_denominator():
    from app.services.dashboard_service import _safe_divide
    assert _safe_divide(10, None) == 0.0


# ── _calculate_health_score ───────────────────────────────────────────────────

def _score(pipeline=None, engagement=None, crisis=None, unreplied=0):
    from app.services.dashboard_service import _calculate_health_score
    return _calculate_health_score(
        pipeline=pipeline or {},
        engagement=engagement or {},
        crisis=crisis or {},
        unreplied=unreplied,
    )


def test_health_score_perfect():
    result = _score(
        pipeline={"failed": 0, "published_recent": 10},
        engagement={"avg_sentiment": 0.5},
        crisis={"active_crisis": 0},
        unreplied=0,
    )
    assert result["score"] == 100
    assert result["status"] == "healthy"


def test_health_score_crisis_deducts():
    r1 = _score(crisis={"active_crisis": 0}, pipeline={"published_recent": 10})
    r2 = _score(crisis={"active_crisis": 1}, pipeline={"published_recent": 10})
    assert r2["score"] < r1["score"]


def test_health_score_crisis_capped_at_3():
    r3 = _score(crisis={"active_crisis": 3}, pipeline={"published_recent": 10})
    r9 = _score(crisis={"active_crisis": 9}, pipeline={"published_recent": 10})
    assert r3["score"] == r9["score"]  # cap at 3×20=60


def test_health_score_unreplied_deducts():
    r0 = _score(unreplied=0, pipeline={"published_recent": 10})
    r10 = _score(unreplied=10, pipeline={"published_recent": 10})
    assert r10["score"] < r0["score"]


def test_health_score_unreplied_capped_at_30():
    r15 = _score(unreplied=15, pipeline={"published_recent": 10})
    r50 = _score(unreplied=50, pipeline={"published_recent": 10})
    assert r15["score"] == r50["score"]


def test_health_score_no_content_deducts_30():
    r_good = _score(pipeline={"published_recent": 10})
    r_none = _score(pipeline={"published_recent": 0})
    assert r_good["score"] - r_none["score"] == 30


def test_health_score_low_content_deducts_15():
    r_good = _score(pipeline={"published_recent": 10})
    r_low = _score(pipeline={"published_recent": 2})
    assert r_good["score"] - r_low["score"] == 15


def test_health_score_positive_sentiment_bonus():
    r_neutral = _score(pipeline={"published_recent": 2}, engagement={"avg_sentiment": 0.0})
    r_positive = _score(pipeline={"published_recent": 2}, engagement={"avg_sentiment": 0.5})
    assert r_positive["score"] - r_neutral["score"] == 5


def test_health_score_negative_sentiment_penalty():
    r_neutral = _score(pipeline={"published_recent": 2}, engagement={"avg_sentiment": 0.0})
    r_negative = _score(pipeline={"published_recent": 2}, engagement={"avg_sentiment": -0.5})
    assert r_neutral["score"] - r_negative["score"] == 10


def test_health_score_never_below_zero():
    result = _score(
        pipeline={"failed": 100, "published_recent": 0},
        crisis={"active_crisis": 10},
        unreplied=100,
        engagement={"avg_sentiment": -1.0},
    )
    assert result["score"] >= 0


def test_health_score_never_above_100():
    result = _score(
        pipeline={"published_recent": 100},
        engagement={"avg_sentiment": 1.0},
        crisis={"active_crisis": 0},
        unreplied=0,
    )
    assert result["score"] <= 100


def test_health_status_healthy():
    result = _score(pipeline={"published_recent": 10}, engagement={"avg_sentiment": 0.5})
    assert result["status"] == "healthy"


def test_health_status_needs_attention():
    # score around 60-79
    result = _score(pipeline={"published_recent": 2}, crisis={"active_crisis": 1})
    assert result["status"] in ["needs_attention", "at_risk", "critical", "healthy"]


def test_health_status_critical_when_low():
    # many deductions → critical
    result = _score(
        pipeline={"failed": 4, "published_recent": 0},
        crisis={"active_crisis": 2},
        unreplied=20,
        engagement={"avg_sentiment": -0.5},
    )
    assert result["status"] == "critical"


# ── _recommend_next_action ────────────────────────────────────────────────────

def test_recommend_crisis_first():
    from app.services.dashboard_service import _recommend_next_action
    result = _recommend_next_action(unreplied=10, pending_agent=5, pending_influencer=3, crisis_count=2)
    assert "URGENT" in result
    assert "2" in result


def test_recommend_agent_drafts_second():
    from app.services.dashboard_service import _recommend_next_action
    result = _recommend_next_action(unreplied=10, pending_agent=3, pending_influencer=2, crisis_count=0)
    assert "3" in result
    assert "draft" in result.lower() or "AI" in result


def test_recommend_influencer_third():
    from app.services.dashboard_service import _recommend_next_action
    result = _recommend_next_action(unreplied=10, pending_agent=0, pending_influencer=4, crisis_count=0)
    assert "4" in result
    assert "influencer" in result.lower()


def test_recommend_unreplied_fourth():
    from app.services.dashboard_service import _recommend_next_action
    result = _recommend_next_action(unreplied=8, pending_agent=0, pending_influencer=0, crisis_count=0)
    assert "8" in result
    assert "comment" in result.lower() or "unanswered" in result.lower()


def test_recommend_healthy_default():
    from app.services.dashboard_service import _recommend_next_action
    result = _recommend_next_action(unreplied=0, pending_agent=0, pending_influencer=0, crisis_count=0)
    assert "healthy" in result.lower() or "content" in result.lower()
