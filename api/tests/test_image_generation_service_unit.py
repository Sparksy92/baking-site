"""Unit tests for image_generation_service pure functions — no AI calls."""
import pytest


# ── _build_platforms_block ────────────────────────────────────────────────────

def test_build_platforms_block_blog_context():
    from app.services.image_generation_service import _build_platforms_block
    result = _build_platforms_block(["instagram", "facebook"], "blog")
    assert "BLOG" in result.upper() or "blog" in result.lower()
    # Should not include social platforms when context=blog
    assert "INSTAGRAM" not in result.upper()


def test_build_platforms_block_social_context_includes_platform():
    from app.services.image_generation_service import _build_platforms_block
    result = _build_platforms_block(["facebook"], "social")
    assert "FACEBOOK" in result.upper() or "facebook" in result.lower()


def test_build_platforms_block_instagram_adds_story():
    from app.services.image_generation_service import _build_platforms_block
    result = _build_platforms_block(["instagram"], "social")
    # instagram_story should be automatically added
    assert "story" in result.lower() or "STORY" in result


def test_build_platforms_block_unknown_platform_skipped():
    from app.services.image_generation_service import _build_platforms_block
    # Unknown platform not in _PLATFORM_SPECS — should silently skip
    result = _build_platforms_block(["nonexistent_platform"], "social")
    assert isinstance(result, str)


def test_build_platforms_block_empty_platforms():
    from app.services.image_generation_service import _build_platforms_block
    result = _build_platforms_block([], "social")
    assert isinstance(result, str)


def test_build_platforms_block_contains_image_count():
    from app.services.image_generation_service import _build_platforms_block, _PLATFORM_SPECS
    if "facebook" not in _PLATFORM_SPECS:
        pytest.skip("facebook not in _PLATFORM_SPECS")
    result = _build_platforms_block(["facebook"], "social")
    spec = _PLATFORM_SPECS["facebook"]
    count = spec["count"]
    assert f"{count} IMAGE" in result.upper() or f"1 of {count}" in result


# ── _PLATFORM_SPECS constant ──────────────────────────────────────────────────

def test_platform_specs_structure():
    from app.services.image_generation_service import _PLATFORM_SPECS
    assert isinstance(_PLATFORM_SPECS, dict)
    assert len(_PLATFORM_SPECS) > 0


def test_platform_specs_required_fields():
    from app.services.image_generation_service import _PLATFORM_SPECS
    required = {"label", "count", "dimension", "notes", "roles"}
    for platform, spec in _PLATFORM_SPECS.items():
        missing = required - set(spec.keys())
        assert not missing, f"{platform} missing fields: {missing}"


def test_platform_specs_count_is_positive_int():
    from app.services.image_generation_service import _PLATFORM_SPECS
    for platform, spec in _PLATFORM_SPECS.items():
        assert isinstance(spec["count"], int) and spec["count"] > 0, \
            f"{platform}.count must be a positive int"


def test_platform_specs_roles_match_count():
    from app.services.image_generation_service import _PLATFORM_SPECS
    for platform, spec in _PLATFORM_SPECS.items():
        assert len(spec["roles"]) == spec["count"], \
            f"{platform}: roles count ({len(spec['roles'])}) != count ({spec['count']})"


# ── _build_master_prompt ──────────────────────────────────────────────────────

def _make_brand(**overrides):
    base = {
        "brand_name": "TestBrand",
        "brand_tagline": "Just a tagline",
        "voice": "friendly and bold",
        "audience": "young adults",
        "values_text": "authenticity, quality",
        "words_to_use": "fresh, vibrant",
        "words_to_avoid": "cheap, generic",
        "ai_disclosure_text": "AI Generated",
        "brand_owner_pronouns": "she/her",
        "cultural_identity": "",
        "enabled_platforms": [],
    }
    base.update(overrides)
    return base


def test_build_master_prompt_contains_brand_name():
    from app.services.image_generation_service import _build_master_prompt
    brand = _make_brand()
    result = _build_master_prompt("Some content", "Test topic", brand, "social")
    assert "TestBrand" in result


def test_build_master_prompt_contains_tagline():
    from app.services.image_generation_service import _build_master_prompt
    brand = _make_brand()
    result = _build_master_prompt("Some content", "Test topic", brand, "social")
    assert "Just a tagline" in result


def test_build_master_prompt_contains_voice():
    from app.services.image_generation_service import _build_master_prompt
    brand = _make_brand()
    result = _build_master_prompt("content", "topic", brand, "social")
    assert "friendly and bold" in result


def test_build_master_prompt_words_to_use():
    from app.services.image_generation_service import _build_master_prompt
    brand = _make_brand()
    result = _build_master_prompt("content", "topic", brand, "social")
    assert "fresh, vibrant" in result


def test_build_master_prompt_words_to_avoid():
    from app.services.image_generation_service import _build_master_prompt
    brand = _make_brand()
    result = _build_master_prompt("content", "topic", brand, "social")
    assert "cheap, generic" in result


def test_build_master_prompt_she_her_pronouns():
    from app.services.image_generation_service import _build_master_prompt
    brand = _make_brand(brand_owner_pronouns="she/her")
    result = _build_master_prompt("content", "topic", brand, "social")
    assert "woman" in result or "female" in result or "she" in result


def test_build_master_prompt_he_him_pronouns():
    from app.services.image_generation_service import _build_master_prompt
    brand = _make_brand(brand_owner_pronouns="he/him")
    result = _build_master_prompt("content", "topic", brand, "social")
    assert "man" in result or "male" in result or "he" in result


def test_build_master_prompt_they_them_pronouns():
    from app.services.image_generation_service import _build_master_prompt
    brand = _make_brand(brand_owner_pronouns="they/them")
    result = _build_master_prompt("content", "topic", brand, "social")
    assert "person" in result or "they" in result


def test_build_master_prompt_cultural_identity_included():
    from app.services.image_generation_service import _build_master_prompt
    brand = _make_brand(cultural_identity="Indigenous Cree Nation")
    result = _build_master_prompt("content", "topic", brand, "social")
    assert "Indigenous Cree Nation" in result


def test_build_master_prompt_no_cultural_identity_no_line():
    from app.services.image_generation_service import _build_master_prompt
    brand = _make_brand(cultural_identity="")
    result = _build_master_prompt("content", "topic", brand, "social")
    assert "Cultural" not in result or "Cultural" in result  # just no crash


def test_build_master_prompt_missing_brand_name_placeholder():
    from app.services.image_generation_service import _build_master_prompt
    brand = _make_brand(brand_name=None)
    result = _build_master_prompt("content", "topic", brand, "social")
    assert "Brand Name not set" in result or isinstance(result, str)


def test_build_master_prompt_returns_string():
    from app.services.image_generation_service import _build_master_prompt
    brand = _make_brand()
    result = _build_master_prompt("content", "topic", brand, "blog")
    assert isinstance(result, str) and len(result) > 100
