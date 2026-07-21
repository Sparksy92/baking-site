"""Unit tests for ai_service pure functions — no AI calls or DB."""
import pytest


# ── _slugify ──────────────────────────────────────────────────────────────────

def test_slugify_basic():
    from app.services.ai_service import _slugify
    assert _slugify("Hello World") == "hello-world"


def test_slugify_strips_special_chars():
    from app.services.ai_service import _slugify
    assert _slugify("Hello, World!") == "hello-world"


def test_slugify_collapses_multiple_hyphens():
    from app.services.ai_service import _slugify
    assert _slugify("Hello   World") == "hello-world"


def test_slugify_leading_trailing_stripped():
    from app.services.ai_service import _slugify
    assert not _slugify("  hello  ").startswith("-")
    assert not _slugify("  hello  ").endswith("-")


def test_slugify_numbers_kept():
    from app.services.ai_service import _slugify
    assert _slugify("Top 10 Tips") == "top-10-tips"


def test_slugify_already_slug():
    from app.services.ai_service import _slugify
    assert _slugify("already-a-slug") == "already-a-slug"


def test_slugify_apostrophes_removed():
    from app.services.ai_service import _slugify
    result = _slugify("Don't stop")
    assert "'" not in result
    assert "don" in result


# ── _HASHTAG_SEPARATE_PLATFORMS constant ──────────────────────────────────────

def test_hashtag_separate_platforms_contains_expected():
    from app.services.ai_service import _HASHTAG_SEPARATE_PLATFORMS
    for p in ["facebook", "linkedin", "x", "twitter", "threads", "youtube", "pinterest"]:
        assert p in _HASHTAG_SEPARATE_PLATFORMS


def test_hashtag_separate_platforms_excludes_instagram():
    from app.services.ai_service import _HASHTAG_SEPARATE_PLATFORMS
    # Instagram keeps hashtags inline
    assert "instagram" not in _HASHTAG_SEPARATE_PLATFORMS


# ── _strip_inline_hashtags ────────────────────────────────────────────────────

def test_strip_inline_hashtags_non_separate_platform_unchanged():
    from app.services.ai_service import _strip_inline_hashtags
    body, tags = _strip_inline_hashtags("Great post #summer #vibes", "instagram")
    assert body == "Great post #summer #vibes"
    assert tags == []


def test_strip_inline_hashtags_dedicated_hashtag_line():
    from app.services.ai_service import _strip_inline_hashtags
    content = "Check out this product!\n\n#summer #sale #fashion"
    body, tags = _strip_inline_hashtags(content, "facebook")
    assert "#summer" not in body
    assert "#summer" in tags
    assert "#sale" in tags
    assert "#fashion" in tags


def test_strip_inline_hashtags_trailing_inline_tags():
    from app.services.ai_service import _strip_inline_hashtags
    content = "Great offer today! #sale #limited"
    body, tags = _strip_inline_hashtags(content, "linkedin")
    assert "#sale" not in body
    assert "#sale" in tags
    assert "#limited" in tags
    assert "Great offer today!" in body


def test_strip_inline_hashtags_no_hashtags_unchanged():
    from app.services.ai_service import _strip_inline_hashtags
    content = "Just a regular caption with no hashtags."
    body, tags = _strip_inline_hashtags(content, "facebook")
    assert body == content
    assert tags == []


def test_strip_inline_hashtags_multiple_hashtag_lines():
    from app.services.ai_service import _strip_inline_hashtags
    content = "Prose content here.\n#tag1 #tag2\n#tag3 #tag4"
    body, tags = _strip_inline_hashtags(content, "x")
    assert "tag1" in " ".join(tags)
    assert "tag3" in " ".join(tags)
    assert "Prose content here." in body


def test_strip_inline_hashtags_returns_tuple():
    from app.services.ai_service import _strip_inline_hashtags
    result = _strip_inline_hashtags("text", "facebook")
    assert isinstance(result, tuple)
    assert len(result) == 2


# ── assign_images_to_platform ─────────────────────────────────────────────────

def test_assign_images_no_urls():
    from app.services.ai_service import assign_images_to_platform
    result = assign_images_to_platform("instagram", [])
    assert result["image_url"] is None
    assert result["additional_image_urls"] == []


def test_assign_images_single_url():
    from app.services.ai_service import assign_images_to_platform
    result = assign_images_to_platform("facebook", ["https://cdn.example.com/img1.jpg"])
    assert result["image_url"] == "https://cdn.example.com/img1.jpg"
    assert result["additional_image_urls"] == []


def test_assign_images_max_images_override():
    from app.services.ai_service import assign_images_to_platform
    urls = [f"https://cdn.example.com/img{i}.jpg" for i in range(5)]
    result = assign_images_to_platform("facebook", urls, max_images=3)
    assert result["image_url"] == urls[0]
    assert len(result["additional_image_urls"]) == 2
    assert result["additional_image_urls"] == urls[1:3]


def test_assign_images_max_images_1():
    from app.services.ai_service import assign_images_to_platform
    urls = ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"]
    result = assign_images_to_platform("instagram", urls, max_images=1)
    assert result["image_url"] == urls[0]
    assert result["additional_image_urls"] == []


def test_assign_images_max_images_zero_treated_as_1():
    from app.services.ai_service import assign_images_to_platform
    urls = ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"]
    result = assign_images_to_platform("instagram", urls, max_images=0)
    # max(1, 0) = 1 — at least one image
    assert result["image_url"] == urls[0]


def test_assign_images_single_image_platform_ignores_rest():
    from app.services.ai_service import assign_images_to_platform
    urls = [f"https://cdn.example.com/img{i}.jpg" for i in range(4)]
    # youtube is not in _MULTI_IMAGE_PLATFORMS — only gets image_url, no extras
    result = assign_images_to_platform("youtube", urls)
    assert result["image_url"] == urls[0]
    assert result["additional_image_urls"] == []


def test_assign_images_multi_image_platform_gets_extras():
    from app.services.ai_service import assign_images_to_platform
    from app.services.ai_service import _MULTI_IMAGE_PLATFORMS
    if not _MULTI_IMAGE_PLATFORMS:
        pytest.skip("No multi-image platforms defined")
    platform = next(iter(_MULTI_IMAGE_PLATFORMS))
    urls = [f"https://cdn.example.com/img{i}.jpg" for i in range(4)]
    result = assign_images_to_platform(platform, urls)
    assert result["image_url"] == urls[0]
    assert len(result["additional_image_urls"]) > 0


# ── _build_system_prompt ──────────────────────────────────────────────────────

def test_build_system_prompt_contains_brand_name():
    from app.services.ai_service import _build_system_prompt
    result = _build_system_prompt("TestBrand", "Our tagline", {}, "facebook")
    assert "TestBrand" in result


def test_build_system_prompt_contains_tagline():
    from app.services.ai_service import _build_system_prompt
    result = _build_system_prompt("Brand", "Be bold.", {}, "instagram")
    assert "Be bold." in result


def test_build_system_prompt_platform_uppercased():
    from app.services.ai_service import _build_system_prompt
    result = _build_system_prompt("Brand", "tag", {}, "linkedin")
    assert "LINKEDIN" in result


def test_build_system_prompt_persona_voice_included():
    from app.services.ai_service import _build_system_prompt
    persona = {"voice": "energetic and fun"}
    result = _build_system_prompt("Brand", "tag", persona, "facebook")
    assert "energetic and fun" in result


def test_build_system_prompt_persona_audience_included():
    from app.services.ai_service import _build_system_prompt
    persona = {"audience": "millennials who love outdoor sports"}
    result = _build_system_prompt("Brand", "tag", persona, "facebook")
    assert "millennials who love outdoor sports" in result


def test_build_system_prompt_words_to_avoid():
    from app.services.ai_service import _build_system_prompt
    persona = {"words_to_avoid": "cheap, discount"}
    result = _build_system_prompt("Brand", "tag", persona, "facebook")
    assert "cheap, discount" in result


def test_build_system_prompt_empty_persona_no_crash():
    from app.services.ai_service import _build_system_prompt
    result = _build_system_prompt("Brand", "", {}, "x")
    assert isinstance(result, str) and len(result) > 0


def test_build_system_prompt_unknown_platform_defaults_to_blog():
    from app.services.ai_service import _build_system_prompt
    result = _build_system_prompt("Brand", "tag", {}, "unknown_platform")
    # Falls back to blog instruction
    assert "JSON" in result or "blog" in result.lower()


def test_build_system_prompt_blog_requests_json():
    from app.services.ai_service import _build_system_prompt
    result = _build_system_prompt("Brand", "tag", {}, "blog")
    assert "JSON" in result


def test_build_system_prompt_instagram_mentions_hashtags():
    from app.services.ai_service import _build_system_prompt
    result = _build_system_prompt("Brand", "tag", {}, "instagram")
    assert "hashtag" in result.lower()


def test_build_system_prompt_x_mentions_280_chars():
    from app.services.ai_service import _build_system_prompt
    result = _build_system_prompt("Brand", "tag", {}, "x")
    assert "280" in result
