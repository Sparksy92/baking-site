"""Unit tests for new AI image utility functions added 2026-06-18.

Covers:
- assign_images_to_platform  — multi-image, single-image, max_images override, empty list
- describe_images_for_content — no API key fallback, successful vision parse,
  ranked reordering, markdown-fence stripping, exception graceful fallback,
  extra_context injection
"""
import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

pytestmark = pytest.mark.asyncio


# ── assign_images_to_platform ─────────────────────────────────────────────────

class TestAssignImagesToPlatform:
    def setup_method(self):
        from app.services.ai_service import assign_images_to_platform
        self.fn = assign_images_to_platform

    def test_empty_list_returns_none(self):
        result = self.fn("instagram", [])
        assert result == {"image_url": None, "additional_image_urls": []}

    def test_multi_image_platform_gets_rest(self):
        urls = ["a.jpg", "b.jpg", "c.jpg", "d.jpg"]
        result = self.fn("instagram", urls)
        assert result["image_url"] == "a.jpg"
        assert result["additional_image_urls"] == ["b.jpg", "c.jpg"]  # capped at 3 total

    def test_single_image_platform_gets_no_extras(self):
        urls = ["a.jpg", "b.jpg", "c.jpg"]
        result = self.fn("youtube", urls)
        assert result["image_url"] == "a.jpg"
        assert result["additional_image_urls"] == []

    def test_pinterest_gets_no_extras(self):
        result = self.fn("pinterest", ["a.jpg", "b.jpg"])
        assert result["additional_image_urls"] == []

    def test_single_url_multi_platform_no_extras(self):
        result = self.fn("facebook", ["a.jpg"])
        assert result["image_url"] == "a.jpg"
        assert result["additional_image_urls"] == []

    def test_max_images_override_caps_total(self):
        urls = ["a.jpg", "b.jpg", "c.jpg"]
        result = self.fn("instagram", urls, max_images=2)
        assert result["image_url"] == "a.jpg"
        assert result["additional_image_urls"] == ["b.jpg"]

    def test_max_images_zero_treated_as_one(self):
        urls = ["a.jpg", "b.jpg"]
        result = self.fn("instagram", urls, max_images=0)
        assert result["image_url"] == "a.jpg"
        assert result["additional_image_urls"] == []

    def test_max_images_one_returns_no_extras(self):
        urls = ["a.jpg", "b.jpg", "c.jpg"]
        result = self.fn("linkedin", urls, max_images=1)
        assert result["image_url"] == "a.jpg"
        assert result["additional_image_urls"] == []

    def test_max_images_override_beats_hardcoded_single(self):
        urls = ["a.jpg", "b.jpg", "c.jpg"]
        result = self.fn("youtube", urls, max_images=3)
        assert result["image_url"] == "a.jpg"
        assert result["additional_image_urls"] == ["b.jpg", "c.jpg"]

    def test_threads_is_multi_image_platform(self):
        urls = ["a.jpg", "b.jpg"]
        result = self.fn("threads", urls)
        assert result["additional_image_urls"] == ["b.jpg"]

    def test_tiktok_is_multi_image_platform(self):
        urls = ["a.jpg", "b.jpg", "c.jpg"]
        result = self.fn("tiktok", urls)
        assert result["additional_image_urls"] == ["b.jpg", "c.jpg"]

    def test_x_is_multi_image_platform(self):
        result = self.fn("x", ["a.jpg", "b.jpg"])
        assert result["additional_image_urls"] == ["b.jpg"]

    def test_unknown_platform_treated_as_single(self):
        result = self.fn("mastodon", ["a.jpg", "b.jpg"])
        assert result["additional_image_urls"] == []


# ── describe_images_for_content ───────────────────────────────────────────────

class TestDescribeImagesForContent:
    """Tests describe_images_for_content — all external API calls are mocked."""

    async def test_no_api_key_returns_fallback(self):
        from app.services.ai_service import describe_images_for_content

        with patch("app.services.ai_service.get_settings") as mock_settings:
            s = MagicMock()
            s.openai_api_key = None
            s.openrouter_api_key = None
            mock_settings.return_value = s

            result = await describe_images_for_content(
                ["http://example.com/a.jpg"],
                extra_context="summer sale",
            )

        assert result["description"] == "summer sale"
        assert result["ranked_urls"] == ["http://example.com/a.jpg"]

    async def test_empty_urls_returns_fallback(self):
        from app.services.ai_service import describe_images_for_content

        with patch("app.services.ai_service.get_settings") as mock_settings:
            s = MagicMock()
            s.openai_api_key = "sk-test"
            mock_settings.return_value = s

            result = await describe_images_for_content([])

        assert result == {"description": "", "ranked_urls": []}

    async def test_successful_vision_returns_description_and_ranked_urls(self):
        from app.services.ai_service import describe_images_for_content

        vision_response = json.dumps({
            "description": "A vibrant powwow with dancers in regalia.",
            "ranked_order": [2, 1, 3],
        })
        urls = ["a.jpg", "b.jpg", "c.jpg"]

        with patch("app.services.ai_service.get_settings") as mock_settings, \
             patch("app.services.ai_service._get_brand_settings", new=AsyncMock(return_value=("TestBrand", {}))), \
             patch("app.services.ai_service.call_openai_vision_multi", new=AsyncMock(return_value=vision_response)):
            s = MagicMock()
            s.openai_api_key = "sk-test"
            s.openrouter_api_key = None
            mock_settings.return_value = s

            result = await describe_images_for_content(urls, extra_context="")

        assert result["description"] == "A vibrant powwow with dancers in regalia."
        assert result["ranked_urls"][0] == "b.jpg"  # index 2 → second url
        assert result["ranked_urls"][1] == "a.jpg"

    async def test_ranked_order_reorders_urls_correctly(self):
        from app.services.ai_service import describe_images_for_content

        vision_response = json.dumps({
            "description": "desc",
            "ranked_order": [3, 1, 2],
        })
        urls = ["first.jpg", "second.jpg", "third.jpg"]

        with patch("app.services.ai_service.get_settings") as mock_settings, \
             patch("app.services.ai_service._get_brand_settings", new=AsyncMock(return_value=("Brand", {}))), \
             patch("app.services.ai_service.call_openai_vision_multi", new=AsyncMock(return_value=vision_response)):
            s = MagicMock()
            s.openai_api_key = "sk-test"
            s.openrouter_api_key = None
            mock_settings.return_value = s

            result = await describe_images_for_content(urls)

        assert result["ranked_urls"] == ["third.jpg", "first.jpg", "second.jpg"]

    async def test_extra_context_appended_to_description(self):
        from app.services.ai_service import describe_images_for_content

        vision_response = json.dumps({
            "description": "People at market.",
            "ranked_order": [1],
        })

        with patch("app.services.ai_service.get_settings") as mock_settings, \
             patch("app.services.ai_service._get_brand_settings", new=AsyncMock(return_value=("Brand", {}))), \
             patch("app.services.ai_service.call_openai_vision_multi", new=AsyncMock(return_value=vision_response)):
            s = MagicMock()
            s.openai_api_key = "sk-test"
            s.openrouter_api_key = None
            mock_settings.return_value = s

            result = await describe_images_for_content(["img.jpg"], extra_context="mention summer sale")

        assert "Brand owner context: mention summer sale" in result["description"]
        assert "People at market." in result["description"]

    async def test_markdown_fence_stripped_from_response(self):
        from app.services.ai_service import describe_images_for_content

        raw = '```json\n{"description": "clean", "ranked_order": [1]}\n```'

        with patch("app.services.ai_service.get_settings") as mock_settings, \
             patch("app.services.ai_service._get_brand_settings", new=AsyncMock(return_value=("Brand", {}))), \
             patch("app.services.ai_service.call_openai_vision_multi", new=AsyncMock(return_value=raw)):
            s = MagicMock()
            s.openai_api_key = "sk-test"
            s.openrouter_api_key = None
            mock_settings.return_value = s

            result = await describe_images_for_content(["img.jpg"])

        assert result["description"] == "clean"

    async def test_vision_exception_returns_graceful_fallback(self):
        from app.services.ai_service import describe_images_for_content

        with patch("app.services.ai_service.get_settings") as mock_settings, \
             patch("app.services.ai_service._get_brand_settings", new=AsyncMock(return_value=("Brand", {}))), \
             patch("app.services.ai_service.call_openai_vision_multi", new=AsyncMock(side_effect=RuntimeError("API down"))):
            s = MagicMock()
            s.openai_api_key = "sk-test"
            s.openrouter_api_key = None
            mock_settings.return_value = s

            result = await describe_images_for_content(["img.jpg"], extra_context="ctx")

        assert result["description"] == "ctx"
        assert result["ranked_urls"] == ["img.jpg"]

    async def test_invalid_json_returns_graceful_fallback(self):
        from app.services.ai_service import describe_images_for_content

        with patch("app.services.ai_service.get_settings") as mock_settings, \
             patch("app.services.ai_service._get_brand_settings", new=AsyncMock(return_value=("Brand", {}))), \
             patch("app.services.ai_service.call_openai_vision_multi", new=AsyncMock(return_value="not json at all")):
            s = MagicMock()
            s.openai_api_key = "sk-test"
            s.openrouter_api_key = None
            mock_settings.return_value = s

            result = await describe_images_for_content(["img.jpg"], extra_context="fallback ctx")

        assert result["ranked_urls"] == ["img.jpg"]

    async def test_uses_openrouter_when_no_openai_key(self):
        from app.services.ai_service import describe_images_for_content

        vision_response = json.dumps({"description": "desc", "ranked_order": [1]})

        with patch("app.services.ai_service.get_settings") as mock_settings, \
             patch("app.services.ai_service._get_brand_settings", new=AsyncMock(return_value=("Brand", {}))), \
             patch("app.services.ai_service.call_openai_vision_multi", new=AsyncMock(return_value=vision_response)) as mock_call:
            s = MagicMock()
            s.openai_api_key = None
            s.openrouter_api_key = "or-test"
            mock_settings.return_value = s

            await describe_images_for_content(["img.jpg"])

        call_kwargs = mock_call.call_args.kwargs
        assert call_kwargs.get("use_openrouter") is True

    async def test_caps_at_three_images(self):
        from app.services.ai_service import describe_images_for_content

        vision_response = json.dumps({"description": "desc", "ranked_order": [1, 2, 3]})
        urls = ["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg"]

        with patch("app.services.ai_service.get_settings") as mock_settings, \
             patch("app.services.ai_service._get_brand_settings", new=AsyncMock(return_value=("Brand", {}))), \
             patch("app.services.ai_service.call_openai_vision_multi", new=AsyncMock(return_value=vision_response)) as mock_call:
            s = MagicMock()
            s.openai_api_key = "sk-test"
            s.openrouter_api_key = None
            mock_settings.return_value = s

            await describe_images_for_content(urls)

        passed_urls = mock_call.call_args.kwargs.get("image_urls") or mock_call.call_args.args[0]
        assert len(passed_urls) == 3
