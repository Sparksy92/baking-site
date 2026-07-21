"""Unit tests for reply_service pure functions — no DB or AI needed."""
import pytest


# ── _build_reply_system_prompt ────────────────────────────────────────────────

def test_prompt_contains_platform_name():
    from app.services.reply_service import _build_reply_system_prompt
    prompt = _build_reply_system_prompt({}, "facebook")
    assert "FACEBOOK" in prompt


def test_prompt_facebook_tone():
    from app.services.reply_service import _build_reply_system_prompt
    prompt = _build_reply_system_prompt({}, "facebook")
    assert "friendly" in prompt.lower() or "conversational" in prompt.lower()


def test_prompt_instagram_tone():
    from app.services.reply_service import _build_reply_system_prompt
    prompt = _build_reply_system_prompt({}, "instagram")
    assert "warm" in prompt.lower() or "emoji" in prompt.lower()


def test_prompt_linkedin_tone():
    from app.services.reply_service import _build_reply_system_prompt
    prompt = _build_reply_system_prompt({}, "linkedin")
    assert "professional" in prompt.lower()


def test_prompt_unknown_platform_fallback():
    from app.services.reply_service import _build_reply_system_prompt
    prompt = _build_reply_system_prompt({}, "pinterest")
    assert "on-brand" in prompt


def test_prompt_includes_brand_voice():
    from app.services.reply_service import _build_reply_system_prompt
    persona = {"voice": "cheerful and bold"}
    prompt = _build_reply_system_prompt(persona, "instagram")
    assert "cheerful and bold" in prompt


def test_prompt_includes_values():
    from app.services.reply_service import _build_reply_system_prompt
    persona = {"values_text": "sustainability and inclusion"}
    prompt = _build_reply_system_prompt(persona, "facebook")
    assert "sustainability and inclusion" in prompt


def test_prompt_includes_words_to_use():
    from app.services.reply_service import _build_reply_system_prompt
    persona = {"words_to_use": "amazing, celebrate"}
    prompt = _build_reply_system_prompt(persona, "facebook")
    assert "amazing, celebrate" in prompt


def test_prompt_includes_words_to_avoid():
    from app.services.reply_service import _build_reply_system_prompt
    persona = {"words_to_avoid": "synergy, leverage"}
    prompt = _build_reply_system_prompt(persona, "linkedin")
    assert "synergy, leverage" in prompt


def test_prompt_empty_persona_no_error():
    from app.services.reply_service import _build_reply_system_prompt
    prompt = _build_reply_system_prompt({}, "instagram")
    assert isinstance(prompt, str)
    assert len(prompt) > 50


def test_prompt_partial_persona():
    from app.services.reply_service import _build_reply_system_prompt
    # Only voice, no other fields
    persona = {"voice": "fun"}
    prompt = _build_reply_system_prompt(persona, "instagram")
    assert "fun" in prompt
    assert "values_text" not in prompt
    assert "words_to_use" not in prompt


def test_prompt_has_character_limit_rule():
    from app.services.reply_service import _build_reply_system_prompt
    prompt = _build_reply_system_prompt({}, "facebook")
    assert "280" in prompt


def test_prompt_no_corporate_jargon_rule():
    from app.services.reply_service import _build_reply_system_prompt
    prompt = _build_reply_system_prompt({}, "facebook")
    assert "jargon" in prompt.lower()
