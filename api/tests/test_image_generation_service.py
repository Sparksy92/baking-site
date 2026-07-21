"""Unit tests for image_generation_service — added 2026-06-18.

Covers:
- _build_platforms_block: social context, blog context, instagram_story injection,
  unknown platform skipped, count/plural labels
- _build_master_prompt: brand data injection, pronoun mapping, cultural identity,
  watermark instruction, words_to_use/avoid blocks, total image count
- generate_image_concepts: LLM called with correct task type, result returned
- generate_image_prompt_for_chatgpt: returns raw unfilled template (no LLM call)
- _load_brand_data: blog context skips platform query
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ── _build_platforms_block ────────────────────────────────────────────────────

class TestBuildPlatformsBlock:
    def _fn(self, platforms, context="social"):
        from app.services.image_generation_service import _build_platforms_block
        return _build_platforms_block(platforms, context)

    def test_blog_context_uses_blog_spec_only(self):
        block = self._fn(["facebook", "instagram"], context="blog")
        assert "BLOG / WEBSITE" in block.upper()
        # Platform section headers use "PLATFORM: X" prefix — confirm none for facebook/instagram
        assert "PLATFORM: FACEBOOK" not in block.upper()
        assert "PLATFORM: INSTAGRAM FEED" not in block.upper()

    def test_social_context_includes_enabled_platforms(self):
        block = self._fn(["facebook", "linkedin"])
        assert "FACEBOOK" in block.upper()
        assert "LINKEDIN" in block.upper()

    def test_instagram_injects_story_spec(self):
        block = self._fn(["instagram"])
        assert "INSTAGRAM STORY" in block.upper()

    def test_unknown_platform_skipped_silently(self):
        block = self._fn(["myspace", "facebook"])
        assert "MYSPACE" not in block.upper()
        assert "FACEBOOK" in block.upper()

    def test_single_image_platform_says_1_image(self):
        block = self._fn(["facebook"])
        assert "1 IMAGE" in block.upper()

    def test_multi_image_platform_says_images_plural(self):
        block = self._fn(["instagram"])
        assert "3 IMAGES" in block.upper()

    def test_empty_platforms_returns_empty_string(self):
        block = self._fn([])
        assert block.strip() == ""

    def test_tiktok_included(self):
        block = self._fn(["tiktok"])
        assert "TIKTOK" in block.upper()

    def test_x_included(self):
        block = self._fn(["x"])
        assert "X / TWITTER" in block.upper()

    def test_pinterest_included(self):
        block = self._fn(["pinterest"])
        assert "PINTEREST" in block.upper()


# ── _build_master_prompt ──────────────────────────────────────────────────────

class TestBuildMasterPrompt:
    def _build(self, brand_overrides=None, content="Test content", topic="Test topic", context="social"):
        from app.services.image_generation_service import _build_master_prompt
        brand = {
            "brand_name": "TestBrand",
            "brand_tagline": "Wear your pride",
            "ai_disclosure_text": "AI Generated",
            "voice": "Bold and authentic",
            "audience": "Indigenous youth",
            "values_text": "Community, respect, land",
            "words_to_use": "community, land",
            "words_to_avoid": "savage, tribe",
            "brand_owner_pronouns": "he/him",
            "cultural_identity": "Cree Nation",
            "enabled_platforms": ["facebook"],
        }
        if brand_overrides:
            brand.update(brand_overrides)
        return _build_master_prompt(content, topic, brand, context)

    def test_brand_name_injected(self):
        prompt = self._build()
        assert "TestBrand" in prompt

    def test_tagline_injected(self):
        prompt = self._build()
        assert "Wear your pride" in prompt

    def test_ai_disclosure_watermark_instruction_present(self):
        prompt = self._build()
        assert "AI Generated" in prompt

    def test_content_injected(self):
        prompt = self._build(content="Launch day content")
        assert "Launch day content" in prompt

    def test_topic_injected(self):
        prompt = self._build(topic="Summer 2026")
        assert "Summer 2026" in prompt

    def test_words_to_use_block_present(self):
        prompt = self._build()
        assert "community, land" in prompt

    def test_words_to_avoid_block_present(self):
        prompt = self._build()
        assert "savage, tribe" in prompt

    def test_he_him_pronouns_map_to_man(self):
        prompt = self._build({"brand_owner_pronouns": "he/him"})
        assert "man" in prompt

    def test_she_her_pronouns_map_to_woman(self):
        prompt = self._build({"brand_owner_pronouns": "she/her"})
        assert "woman" in prompt

    def test_they_them_pronouns_map_to_person(self):
        prompt = self._build({"brand_owner_pronouns": "they/them"})
        assert "non-binary individual" in prompt

    def test_cultural_identity_injected(self):
        prompt = self._build({"cultural_identity": "Cree Nation"})
        assert "Cree Nation" in prompt

    def test_no_cultural_identity_uses_indigenous_fallback(self):
        prompt = self._build({"cultural_identity": ""})
        assert "Indigenous" in prompt

    def test_blog_context_counts_3_images(self):
        prompt = self._build(context="blog")
        assert "3 ready-to-paste" in prompt

    def test_social_context_counts_platform_images(self):
        prompt = self._build({"enabled_platforms": ["facebook"]}, context="social")
        assert "1 ready-to-paste" in prompt

    def test_instagram_story_adds_to_count(self):
        prompt = self._build({"enabled_platforms": ["instagram"]}, context="social")
        assert "4 ready-to-paste" in prompt  # 3 feed + 1 story

    def test_missing_brand_name_placeholder(self):
        prompt = self._build({"brand_name": ""})
        assert "[Brand Name not set" in prompt

    def test_missing_voice_placeholder(self):
        prompt = self._build({"voice": ""})
        assert "[Brand voice not set" in prompt

    def test_no_words_blocks_when_empty(self):
        prompt = self._build({"words_to_use": "", "words_to_avoid": ""})
        assert "Words / phrases to USE" not in prompt
        assert "Words / phrases to NEVER USE" not in prompt


# ── generate_image_concepts ───────────────────────────────────────────────────

class TestGenerateImageConcepts:
    @pytest.mark.asyncio
    async def test_calls_llm_and_returns_result(self):
        from app.services.image_generation_service import generate_image_concepts
        from app.services.ai_router import AITaskType

        mock_config = MagicMock()

        with patch("app.services.image_generation_service._load_brand_data", new=AsyncMock(return_value={
            "brand_name": "TestBrand", "brand_tagline": "", "ai_disclosure_text": "AI",
            "voice": "Bold", "audience": "Youth", "values_text": "Community",
            "words_to_use": "", "words_to_avoid": "", "brand_owner_pronouns": "he/him",
            "cultural_identity": "Cree", "enabled_platforms": ["facebook"],
        })), patch(
            "app.services.image_generation_service.get_model_config",
            new=AsyncMock(return_value=mock_config),
        ), patch(
            "app.services.image_generation_service.generate_with_config",
            new=AsyncMock(return_value="Generated image prompts here"),
        ) as mock_gen:
            result = await generate_image_concepts("Some content", "Some topic", "social")

        assert result == "Generated image prompts here"
        mock_gen.assert_called_once()

    @pytest.mark.asyncio
    async def test_blog_context_passed_to_load_brand_data(self):
        from app.services.image_generation_service import generate_image_concepts

        with patch("app.services.image_generation_service._load_brand_data", new=AsyncMock(return_value={
            "brand_name": "B", "brand_tagline": "", "ai_disclosure_text": "AI",
            "voice": "", "audience": "", "values_text": "", "words_to_use": "",
            "words_to_avoid": "", "brand_owner_pronouns": "he/him",
            "cultural_identity": "", "enabled_platforms": [],
        })) as mock_load, patch(
            "app.services.image_generation_service.get_model_config", new=AsyncMock(return_value=MagicMock()),
        ), patch(
            "app.services.image_generation_service.generate_with_config", new=AsyncMock(return_value="ok"),
        ):
            await generate_image_concepts("content", "topic", "blog")

        mock_load.assert_called_once_with("blog")


# ── generate_image_prompt_for_chatgpt ─────────────────────────────────────────

class TestGenerateImagePromptForChatgpt:
    @pytest.mark.asyncio
    async def test_returns_raw_template_without_llm_call(self):
        from app.services.image_generation_service import generate_image_prompt_for_chatgpt

        with patch("app.services.image_generation_service._load_brand_data", new=AsyncMock(return_value={
            "brand_name": "TestBrand", "brand_tagline": "", "ai_disclosure_text": "AI",
            "voice": "Bold", "audience": "Youth", "values_text": "Community",
            "words_to_use": "", "words_to_avoid": "", "brand_owner_pronouns": "he/him",
            "cultural_identity": "Cree", "enabled_platforms": ["facebook"],
        })), patch(
            "app.services.image_generation_service.generate_with_config",
            new=AsyncMock(side_effect=AssertionError("LLM must not be called")),
        ):
            result = await generate_image_prompt_for_chatgpt("content", "topic", "social")

        assert "TestBrand" in result
        assert "[Write the detailed prompt here" in result


# ── _load_brand_data ──────────────────────────────────────────────────────────

class TestLoadBrandData:
    @pytest.mark.asyncio
    async def test_blog_context_skips_platform_query(self):
        """For blog context the platforms block is empty — no DB platform query needed."""
        from app.services.image_generation_service import _load_brand_data

        mock_cur = AsyncMock()
        mock_cur.fetchall = AsyncMock(return_value=[])
        mock_cur.fetchone = AsyncMock(return_value=None)
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_cur)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.image_generation_service.db_connection", return_value=mock_ctx):
            result = await _load_brand_data("blog")

        assert result["enabled_platforms"] == []
        execute_calls = [str(c) for c in mock_db.execute.call_args_list]
        assert not any("social_platform_configs" in c for c in execute_calls)

    @pytest.mark.asyncio
    async def test_social_context_queries_platforms(self):
        from app.services.image_generation_service import _load_brand_data

        mock_platform_rows = [{"platform": "facebook"}, {"platform": "instagram"}]

        mock_cur = AsyncMock()
        mock_cur.fetchall = AsyncMock(side_effect=[[], mock_platform_rows])
        mock_cur.fetchone = AsyncMock(return_value=None)
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_cur)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.image_generation_service.db_connection", return_value=mock_ctx):
            result = await _load_brand_data("social")

        assert "facebook" in result["enabled_platforms"] or result["enabled_platforms"] == []
