"""Unit tests for token_refresh_service and image_compliance_service pure functions."""
import pytest


# ── token_refresh_service._extract_app_id_from_token ─────────────────────────

def test_extract_app_id_with_pipe():
    from app.services.token_refresh_service import _extract_app_id_from_token
    result = _extract_app_id_from_token("APP123|rest-of-token-data")
    assert result == "APP123"


def test_extract_app_id_no_pipe_returns_empty():
    from app.services.token_refresh_service import _extract_app_id_from_token
    result = _extract_app_id_from_token("tokenwithoutseparator")
    assert result == ""


def test_extract_app_id_multiple_pipes_uses_first():
    from app.services.token_refresh_service import _extract_app_id_from_token
    result = _extract_app_id_from_token("APP123|middle|end")
    assert result == "APP123"


def test_extract_app_id_empty_prefix():
    from app.services.token_refresh_service import _extract_app_id_from_token
    result = _extract_app_id_from_token("|rest-of-token")
    assert result == ""


def test_extract_app_id_typical_meta_token():
    from app.services.token_refresh_service import _extract_app_id_from_token
    result = _extract_app_id_from_token("1234567890|AbCdEfGhIjKlMnOpQrStUvWxYz")
    assert result == "1234567890"


# ── image_compliance_service._extract_urls ────────────────────────────────────

def test_extract_urls_basic_https():
    from app.services.image_compliance_service import _extract_urls
    text = "Check https://example.com/page for more info"
    result = _extract_urls(text)
    assert "https://example.com/page" in result


def test_extract_urls_basic_http():
    from app.services.image_compliance_service import _extract_urls
    text = "Visit http://example.com now"
    result = _extract_urls(text)
    assert "http://example.com" in result


def test_extract_urls_no_urls():
    from app.services.image_compliance_service import _extract_urls
    result = _extract_urls("No links in this text at all")
    assert result == []


def test_extract_urls_www_without_protocol():
    from app.services.image_compliance_service import _extract_urls
    text = "Visit www.example.com for details"
    result = _extract_urls(text)
    assert any("example.com" in u for u in result)


def test_extract_urls_multiple_urls():
    from app.services.image_compliance_service import _extract_urls
    text = "See https://example.com and https://other.org for details"
    result = _extract_urls(text)
    assert len(result) == 2


def test_extract_urls_deduplicates():
    from app.services.image_compliance_service import _extract_urls
    text = "See https://example.com and https://example.com again"
    result = _extract_urls(text)
    assert result.count("https://example.com") == 1


def test_extract_urls_returns_list():
    from app.services.image_compliance_service import _extract_urls
    assert isinstance(_extract_urls("text"), list)


def test_extract_urls_empty_string():
    from app.services.image_compliance_service import _extract_urls
    assert _extract_urls("") == []


# ── image_compliance_service._generate_recommendations ───────────────────────

def test_generate_recommendations_critical():
    from app.services.image_compliance_service import _generate_recommendations
    recs = _generate_recommendations(health_score=60, top_issues=[])
    combined = " ".join(recs)
    assert "Critical" in combined or "critical" in combined


def test_generate_recommendations_good():
    from app.services.image_compliance_service import _generate_recommendations
    recs = _generate_recommendations(health_score=80, top_issues=[])
    combined = " ".join(recs)
    assert "Good" in combined or "good" in combined or "progress" in combined


def test_generate_recommendations_excellent():
    from app.services.image_compliance_service import _generate_recommendations
    recs = _generate_recommendations(health_score=97, top_issues=[])
    combined = " ".join(recs)
    assert "Excellent" in combined or "excellent" in combined


def test_generate_recommendations_top_issue_included():
    from app.services.image_compliance_service import _generate_recommendations
    top_issues = [{"category": "watermark_detected", "count": 5}]
    recs = _generate_recommendations(health_score=70, top_issues=top_issues)
    combined = " ".join(recs)
    assert "watermark_detected" in combined


def test_generate_recommendations_no_issues_no_top_issue_rec():
    from app.services.image_compliance_service import _generate_recommendations
    recs = _generate_recommendations(health_score=90, top_issues=[])
    combined = " ".join(recs)
    assert "Top issue" not in combined


def test_generate_recommendations_returns_list():
    from app.services.image_compliance_service import _generate_recommendations
    result = _generate_recommendations(50, [])
    assert isinstance(result, list)
