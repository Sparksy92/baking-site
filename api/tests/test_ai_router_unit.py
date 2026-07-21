"""Unit tests for ai_router pure-logic functions and constants.
No network or DB calls needed."""
import pytest
from unittest.mock import MagicMock


# ── AITaskType enum ───────────────────────────────────────────────────────────

def test_ai_task_type_values():
    from app.services.ai_router import AITaskType
    assert AITaskType.BLOG_POST == "blog_post"
    assert AITaskType.SOCIAL_CAPTION == "social_caption"
    assert AITaskType.SOCIAL_REPLY == "social_reply"
    assert AITaskType.HASHTAG_GEN == "hashtag_gen"
    assert AITaskType.MODERATION == "moderation"


def test_ai_task_type_is_str():
    from app.services.ai_router import AITaskType
    # All values should be usable as strings
    for task in AITaskType:
        assert isinstance(task.value, str)


# ── ModelConfig dataclass ─────────────────────────────────────────────────────

def test_model_config_fields():
    from app.services.ai_router import ModelConfig
    cfg = ModelConfig(
        provider="openai",
        model="gpt-4o-mini",
        temperature=0.7,
        max_tokens=500,
        task_type="blog_post",
    )
    assert cfg.provider == "openai"
    assert cfg.temperature == 0.7
    assert cfg.max_tokens == 500


# ── PROVIDER_LABELS ───────────────────────────────────────────────────────────

def test_provider_labels_has_all_providers():
    from app.services.ai_router import PROVIDER_LABELS
    assert "openrouter" in PROVIDER_LABELS
    assert "openai" in PROVIDER_LABELS
    assert "anthropic" in PROVIDER_LABELS
    assert "gemini" in PROVIDER_LABELS


def test_provider_labels_are_strings():
    from app.services.ai_router import PROVIDER_LABELS
    for key, label in PROVIDER_LABELS.items():
        assert isinstance(label, str) and len(label) > 0


# ── TASK_LABELS ───────────────────────────────────────────────────────────────

def test_task_labels_covers_all_task_types():
    from app.services.ai_router import TASK_LABELS, AITaskType
    for task in AITaskType:
        assert task in TASK_LABELS, f"Missing label for {task}"


def test_task_labels_non_empty():
    from app.services.ai_router import TASK_LABELS
    for task, label in TASK_LABELS.items():
        assert isinstance(label, str) and len(label) > 0


# ── _DEFAULTS ─────────────────────────────────────────────────────────────────

def test_defaults_covers_all_task_types():
    from app.services.ai_router import _DEFAULTS, AITaskType
    for task in AITaskType:
        assert task in _DEFAULTS, f"Missing default config for {task}"


def test_defaults_tuple_length():
    from app.services.ai_router import _DEFAULTS
    for task, values in _DEFAULTS.items():
        assert len(values) == 6, f"{task}: expected 6-tuple (or_model, oai_model, anthropic_model, gemini_model, temp, max_tokens)"


def test_defaults_temperature_range():
    from app.services.ai_router import _DEFAULTS
    for task, values in _DEFAULTS.items():
        temp = values[4]
        assert 0.0 <= temp <= 1.0, f"{task}: temperature {temp} out of range"


def test_defaults_max_tokens_positive():
    from app.services.ai_router import _DEFAULTS
    for task, values in _DEFAULTS.items():
        max_tok = values[5]
        assert max_tok > 0, f"{task}: max_tokens must be positive"


# ── _available_providers ──────────────────────────────────────────────────────

def test_available_providers_all_keys_set():
    from app.services.ai_router import _available_providers
    s = MagicMock()
    s.openrouter_api_key = "or_key"
    s.openai_api_key = "oai_key"
    s.anthropic_api_key = "ant_key"
    s.gemini_api_key = "gem_key"
    result = _available_providers(s)
    assert result == ["openrouter", "openai", "anthropic", "gemini"]


def test_available_providers_only_openai():
    from app.services.ai_router import _available_providers
    s = MagicMock()
    s.openrouter_api_key = None
    s.openai_api_key = "oai_key"
    s.anthropic_api_key = None
    s.gemini_api_key = None
    result = _available_providers(s)
    assert result == ["openai"]


def test_available_providers_none_configured():
    from app.services.ai_router import _available_providers
    s = MagicMock()
    s.openrouter_api_key = None
    s.openai_api_key = None
    s.anthropic_api_key = None
    s.gemini_api_key = None
    result = _available_providers(s)
    assert result == []


def test_available_providers_priority_order():
    from app.services.ai_router import _available_providers
    s = MagicMock()
    s.openrouter_api_key = "key"
    s.openai_api_key = "key"
    s.anthropic_api_key = None
    s.gemini_api_key = "key"
    result = _available_providers(s)
    # openrouter must come before openai, openai before gemini
    assert result.index("openrouter") < result.index("openai")
    assert result.index("openai") < result.index("gemini")
    assert "anthropic" not in result
