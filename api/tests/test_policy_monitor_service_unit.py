"""Unit tests for policy_monitor_service pure functions.
No DB or network access required."""
import hashlib
import pytest


# ── _strip_html ───────────────────────────────────────────────────────────────

def test_strip_html_basic_tags():
    from app.services.policy_monitor_service import _strip_html
    result = _strip_html("<p>Hello <b>world</b></p>")
    assert result == "Hello world"


def test_strip_html_removes_scripts():
    from app.services.policy_monitor_service import _strip_html
    result = _strip_html("<script>alert('xss')</script><p>Clean</p>")
    assert "alert" not in result
    assert "Clean" in result


def test_strip_html_removes_styles():
    from app.services.policy_monitor_service import _strip_html
    result = _strip_html("<style>body{color:red}</style><p>Text</p>")
    assert "body{color" not in result
    assert "Text" in result


def test_strip_html_decodes_entities():
    from app.services.policy_monitor_service import _strip_html
    result = _strip_html("<p>Rights &amp; Obligations</p>")
    assert "&amp;" not in result
    assert "Rights & Obligations" in result


def test_strip_html_empty_string():
    from app.services.policy_monitor_service import _strip_html
    assert _strip_html("") == ""


def test_strip_html_none_like_empty():
    from app.services.policy_monitor_service import _strip_html
    assert _strip_html(None) == ""


def test_strip_html_normalizes_whitespace():
    from app.services.policy_monitor_service import _strip_html
    result = _strip_html("<p>Hello    world</p>")
    assert "  " not in result
    assert "Hello world" in result


def test_strip_html_multiline_script():
    from app.services.policy_monitor_service import _strip_html
    html = "<script>\nfunction f(){\n  return 1;\n}\n</script><p>OK</p>"
    result = _strip_html(html)
    assert "function" not in result
    assert "OK" in result


# ── _compute_hash ─────────────────────────────────────────────────────────────

def test_compute_hash_sha256():
    from app.services.policy_monitor_service import _compute_hash
    expected = hashlib.sha256("hello".encode("utf-8")).hexdigest()
    assert _compute_hash("hello") == expected


def test_compute_hash_deterministic():
    from app.services.policy_monitor_service import _compute_hash
    assert _compute_hash("policy text") == _compute_hash("policy text")


def test_compute_hash_different_inputs_differ():
    from app.services.policy_monitor_service import _compute_hash
    assert _compute_hash("v1 text") != _compute_hash("v2 text")


def test_compute_hash_empty_string():
    from app.services.policy_monitor_service import _compute_hash
    result = _compute_hash("")
    assert len(result) == 64  # SHA256 hex


# ── _extract_keywords ─────────────────────────────────────────────────────────

def test_extract_keywords_returns_set():
    from app.services.policy_monitor_service import _extract_keywords
    result = _extract_keywords("users must follow rules")
    assert isinstance(result, set)


def test_extract_keywords_min_4_chars():
    from app.services.policy_monitor_service import _extract_keywords
    result = _extract_keywords("Do not use bad spam bots here")
    # "Do", "not", "use", "bad" < 4 chars or filtered
    assert "spam" in result
    assert "bots" in result
    assert "here" in result


def test_extract_keywords_excludes_stop_words():
    from app.services.policy_monitor_service import _extract_keywords
    result = _extract_keywords("this will have been their content policy")
    # All of these are stop words
    assert "this" not in result
    assert "will" not in result
    assert "have" not in result
    assert "been" not in result
    assert "their" not in result
    assert "content" not in result
    assert "policy" not in result


def test_extract_keywords_case_insensitive():
    from app.services.policy_monitor_service import _extract_keywords
    result = _extract_keywords("PROHIBITED behavior")
    assert "prohibited" in result


def test_extract_keywords_empty_string():
    from app.services.policy_monitor_service import _extract_keywords
    assert _extract_keywords("") == set()


# ── _classify_severity ────────────────────────────────────────────────────────

def test_classify_severity_critical_keyword_in_added():
    from app.services.policy_monitor_service import _classify_severity
    severity, reason = _classify_severity("account will be prohibited", "")
    assert severity == "critical"
    assert "prohibited" in reason.lower()


def test_classify_severity_critical_keyword_in_removed_is_warning():
    from app.services.policy_monitor_service import _classify_severity
    severity, reason = _classify_severity("", "account suspended for violations")
    assert severity == "warning"
    assert "relaxed" in reason.lower() or "removed" in reason.lower()


def test_classify_severity_warning_keyword_in_added():
    from app.services.policy_monitor_service import _classify_severity
    severity, reason = _classify_severity("usage should not exceed limits", "")
    assert severity == "warning"


def test_classify_severity_no_keywords_is_info():
    from app.services.policy_monitor_service import _classify_severity
    severity, reason = _classify_severity("minor clarification added", "old text removed")
    assert severity == "info"
    assert "minor" in reason.lower()


def test_classify_severity_empty_texts():
    from app.services.policy_monitor_service import _classify_severity
    severity, reason = _classify_severity("", "")
    assert severity == "info"


def test_classify_severity_enforcement_is_critical():
    from app.services.policy_monitor_service import _classify_severity
    severity, _ = _classify_severity("enforcement of these rules", "")
    assert severity == "critical"


def test_classify_severity_fine_is_critical():
    from app.services.policy_monitor_service import _classify_severity
    severity, reason = _classify_severity("may result in a fine", "")
    # "fine" is a critical keyword, "may result in" is also a warning keyword
    # critical takes precedence
    assert severity == "critical"


# ── _generate_diff_html ───────────────────────────────────────────────────────

def test_generate_diff_html_returns_string():
    from app.services.policy_monitor_service import _generate_diff_html
    result = _generate_diff_html("old text", "new text")
    assert isinstance(result, str)
    assert len(result) > 0


def test_generate_diff_html_contains_table():
    from app.services.policy_monitor_service import _generate_diff_html
    result = _generate_diff_html("old", "new")
    assert "<table" in result.lower()


def test_generate_diff_html_contains_version_labels():
    from app.services.policy_monitor_service import _generate_diff_html
    result = _generate_diff_html("old", "new")
    assert "Previous Version" in result
    assert "Current Version" in result


def test_generate_diff_html_empty_inputs():
    from app.services.policy_monitor_service import _generate_diff_html
    result = _generate_diff_html("", "")
    assert isinstance(result, str)


def test_generate_diff_html_identical_texts():
    from app.services.policy_monitor_service import _generate_diff_html
    result = _generate_diff_html("same", "same")
    assert isinstance(result, str)


# ── Constants ─────────────────────────────────────────────────────────────────

def test_critical_keywords_list():
    from app.services.policy_monitor_service import CRITICAL_KEYWORDS
    assert isinstance(CRITICAL_KEYWORDS, list)
    assert len(CRITICAL_KEYWORDS) > 0
    assert "prohibited" in CRITICAL_KEYWORDS


def test_warning_keywords_list():
    from app.services.policy_monitor_service import WARNING_KEYWORDS
    assert isinstance(WARNING_KEYWORDS, list)
    assert len(WARNING_KEYWORDS) > 0


# ── PolicyDiff dataclass ──────────────────────────────────────────────────────

def test_policy_diff_fields():
    from app.services.policy_monitor_service import PolicyDiff
    diff = PolicyDiff(
        has_changes=True,
        change_summary="New rules added",
        added_keywords=["enforcement"],
        removed_keywords=[],
        severity="critical",
        severity_reason="Critical keyword detected",
        diff_html="<table>...</table>",
    )
    assert diff.has_changes is True
    assert diff.severity == "critical"
    assert "enforcement" in diff.added_keywords
