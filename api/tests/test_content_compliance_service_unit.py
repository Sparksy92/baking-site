"""Unit tests for content_compliance_service pure functions.
Tests _rule_based_check, dataclasses, and POLICY_PATTERNS — no DB or AI."""
import pytest


# ── ComplianceIssue dataclass ─────────────────────────────────────────────────

def test_compliance_issue_fields():
    from app.services.content_compliance_service import ComplianceIssue
    issue = ComplianceIssue(
        severity="critical",
        category="hate_speech",
        policy_reference="instagram_hate_speech",
        description="Detected hate speech",
        excerpt="...bad content...",
        suggested_fix="Remove flagged text",
        auto_fixable=False,
    )
    assert issue.severity == "critical"
    assert issue.auto_fixable is False


# ── ComplianceCheckResult dataclass ───────────────────────────────────────────

def test_compliance_check_result_defaults():
    from app.services.content_compliance_service import ComplianceCheckResult
    result = ComplianceCheckResult(
        content_id=None,
        platform="instagram",
        status="clean",
        overall_severity="clean",
    )
    assert result.issues == []
    assert result.can_auto_fix is False
    assert result.fix_attempts == 0
    assert result.max_fix_attempts == 2


# ── POLICY_PATTERNS structure ─────────────────────────────────────────────────

def test_policy_patterns_has_required_categories():
    from app.services.content_compliance_service import POLICY_PATTERNS
    assert "hate_speech" in POLICY_PATTERNS
    assert "harassment" in POLICY_PATTERNS
    assert "violence" in POLICY_PATTERNS


def test_policy_patterns_all_have_required_keys():
    from app.services.content_compliance_service import POLICY_PATTERNS
    for cat, cfg in POLICY_PATTERNS.items():
        assert "patterns" in cfg, f"{cat} missing 'patterns'"
        assert "severity" in cfg, f"{cat} missing 'severity'"
        assert "platforms" in cfg, f"{cat} missing 'platforms'"
        assert isinstance(cfg["patterns"], list)


# ── _rule_based_check — clean content ────────────────────────────────────────

def test_rule_based_check_clean_content_no_issues():
    from app.services.content_compliance_service import _rule_based_check
    issues = _rule_based_check("Check out our summer sale! #deals", "instagram")
    assert issues == []


def test_rule_based_check_empty_content():
    from app.services.content_compliance_service import _rule_based_check
    issues = _rule_based_check("", "instagram")
    assert issues == []


def test_rule_based_check_platform_not_in_config_skips():
    from app.services.content_compliance_service import _rule_based_check
    # "unknown_platform" won't match any platform in config — should return no issues
    issues = _rule_based_check("hate kill", "unknown_platform")
    assert issues == []


# ── _rule_based_check — hate speech ──────────────────────────────────────────

def test_rule_based_check_detects_hate_speech():
    from app.services.content_compliance_service import _rule_based_check
    issues = _rule_based_check("I am filled with hatred for this group", "instagram")
    cats = [i.category for i in issues]
    assert "hate_speech" in cats


def test_rule_based_check_hate_speech_is_critical():
    from app.services.content_compliance_service import _rule_based_check
    issues = _rule_based_check("death to all", "facebook")
    hs = [i for i in issues if i.category == "hate_speech"]
    assert all(i.severity == "critical" for i in hs)


def test_rule_based_check_hate_speech_not_auto_fixable():
    from app.services.content_compliance_service import _rule_based_check
    issues = _rule_based_check("death to enemies", "instagram")
    hs = [i for i in issues if i.category == "hate_speech"]
    assert all(i.auto_fixable is False for i in hs)


# ── _rule_based_check — false positive protection ────────────────────────────

def test_rule_based_check_false_positive_class_not_flagged():
    from app.services.content_compliance_service import _rule_based_check
    issues = _rule_based_check("This yoga class is amazing!", "instagram")
    # "class" should not trigger profanity
    assert not any(i.category == "profanity" for i in issues)


def test_rule_based_check_false_positive_analysis_not_flagged():
    from app.services.content_compliance_service import _rule_based_check
    issues = _rule_based_check("Our data analysis shows great results", "linkedin")
    assert not any(i.category == "profanity" for i in issues)


def test_rule_based_check_false_positive_grass_not_flagged():
    from app.services.content_compliance_service import _rule_based_check
    issues = _rule_based_check("The grass is always greener", "instagram")
    assert not any(i.category == "profanity" for i in issues)


# ── _rule_based_check — misinformation ───────────────────────────────────────

def test_rule_based_check_detects_health_misinformation():
    from app.services.content_compliance_service import _rule_based_check
    issues = _rule_based_check("This miracle cure cures cancer naturally!", "facebook")
    cats = [i.category for i in issues]
    assert "misinformation_health" in cats


def test_rule_based_check_vaccine_misinformation():
    from app.services.content_compliance_service import _rule_based_check
    issues = _rule_based_check("Vaccines cause autism and harm children", "facebook")
    assert any(i.category == "misinformation_health" for i in issues)


# ── _rule_based_check — issue metadata ───────────────────────────────────────

def test_rule_based_check_issue_has_excerpt():
    from app.services.content_compliance_service import _rule_based_check
    issues = _rule_based_check("I have hatred in my heart today", "instagram")
    for issue in issues:
        assert len(issue.excerpt) > 0


def test_rule_based_check_issue_has_policy_reference():
    from app.services.content_compliance_service import _rule_based_check
    issues = _rule_based_check("death to all", "facebook")
    for issue in issues:
        assert "facebook" in issue.policy_reference


def test_rule_based_check_issue_has_suggested_fix():
    from app.services.content_compliance_service import _rule_based_check
    issues = _rule_based_check("hatred and death to enemies", "instagram")
    for issue in issues:
        assert issue.suggested_fix != ""


# ── _rule_based_check — violence ──────────────────────────────────────────────

def test_rule_based_check_detects_violence():
    from app.services.content_compliance_service import _rule_based_check
    issues = _rule_based_check("I want to beat up and punch someone", "instagram")
    assert any(i.category == "violence" for i in issues)


def test_rule_based_check_figurative_fight_not_flagged():
    from app.services.content_compliance_service import _rule_based_check
    issues = _rule_based_check("We fight for equality every day", "instagram")
    # "fight for" should not trigger the violence pattern (pattern is "fight someone/him/her/them/you")
    assert not any(i.category == "violence" for i in issues)
