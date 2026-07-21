"""Unit tests for utm_service pure functions — no network or DB."""
import pytest
from urllib.parse import urlparse, parse_qs


# ── _normalise ────────────────────────────────────────────────────────────────

def test_normalise_lowercase():
    from app.services.utm_service import _normalise
    assert _normalise("Facebook") == "facebook"


def test_normalise_spaces_to_hyphens():
    from app.services.utm_service import _normalise
    assert _normalise("my campaign") == "my-campaign"


def test_normalise_slashes_to_hyphens():
    from app.services.utm_service import _normalise
    assert _normalise("blog/my-post") == "blog-my-post"


def test_normalise_underscores_to_hyphens():
    from app.services.utm_service import _normalise
    assert _normalise("summer_sale") == "summer-sale"


def test_normalise_already_clean():
    from app.services.utm_service import _normalise
    assert _normalise("instagram") == "instagram"


def test_normalise_mixed():
    from app.services.utm_service import _normalise
    assert _normalise("My Blog/Post Title") == "my-blog-post-title"


# ── tag_url ───────────────────────────────────────────────────────────────────

def test_tag_url_adds_utm_params():
    from app.services.utm_service import tag_url
    result = tag_url("https://store.example.com/product", "facebook", "summer-sale")
    parsed = urlparse(result)
    params = parse_qs(parsed.query)
    assert params["utm_source"] == ["facebook"]
    assert params["utm_medium"] == ["social"]
    assert params["utm_campaign"] == ["summer-sale"]
    assert params["utm_content"] == ["organic"]


def test_tag_url_normalises_platform():
    from app.services.utm_service import tag_url
    result = tag_url("https://store.example.com/p", "Facebook", "my campaign")
    params = parse_qs(urlparse(result).query)
    assert params["utm_source"] == ["facebook"]
    assert params["utm_campaign"] == ["my-campaign"]


def test_tag_url_preserves_existing_query_params():
    from app.services.utm_service import tag_url
    result = tag_url("https://store.example.com/p?color=red&size=M", "instagram", "promo")
    params = parse_qs(urlparse(result).query)
    assert params["color"] == ["red"]
    assert params["size"] == ["M"]
    assert "utm_source" in params


def test_tag_url_overwrites_existing_utm():
    from app.services.utm_service import tag_url
    result = tag_url(
        "https://store.example.com/p?utm_source=old&utm_campaign=old",
        "tiktok", "new-campaign"
    )
    params = parse_qs(urlparse(result).query)
    assert params["utm_source"] == ["tiktok"]
    assert params["utm_campaign"] == ["new-campaign"]


def test_tag_url_custom_medium_and_content():
    from app.services.utm_service import tag_url
    result = tag_url("https://store.example.com/p", "facebook", "ad-1", medium="cpc", content="paid")
    params = parse_qs(urlparse(result).query)
    assert params["utm_medium"] == ["cpc"]
    assert params["utm_content"] == ["paid"]


def test_tag_url_non_http_returns_unchanged():
    from app.services.utm_service import tag_url
    assert tag_url("/relative/path", "facebook", "test") == "/relative/path"


def test_tag_url_empty_returns_unchanged():
    from app.services.utm_service import tag_url
    assert tag_url("", "facebook", "test") == ""


def test_tag_url_preserves_fragment():
    from app.services.utm_service import tag_url
    result = tag_url("https://store.example.com/page#section", "linkedin", "blog")
    assert "#section" in result


def test_tag_url_preserves_path():
    from app.services.utm_service import tag_url
    result = tag_url("https://store.example.com/collections/sale", "instagram", "sale")
    assert "/collections/sale" in result


def test_tag_url_scheme_preserved():
    from app.services.utm_service import tag_url
    result = tag_url("https://store.example.com/p", "x", "post")
    assert result.startswith("https://")


# ── tag_content_links ─────────────────────────────────────────────────────────

def test_tag_content_links_tags_store_links(monkeypatch):
    from app.services.utm_service import tag_content_links
    from unittest.mock import MagicMock

    mock_settings = MagicMock()
    mock_settings.store_domain = "https://mystore.com"

    monkeypatch.setattr("app.config.get_settings", lambda: mock_settings)

    content = "Check out this product https://mystore.com/products/shirt #summer"
    result = tag_content_links(content, "instagram", "shirt-promo")

    assert "utm_source=instagram" in result
    assert "utm_campaign=shirt-promo" in result


def test_tag_content_links_does_not_tag_external_links(monkeypatch):
    from app.services.utm_service import tag_content_links
    from unittest.mock import MagicMock

    mock_settings = MagicMock()
    mock_settings.store_domain = "https://mystore.com"

    monkeypatch.setattr("app.config.get_settings", lambda: mock_settings)

    content = "Read more at https://othersite.com/article"
    result = tag_content_links(content, "facebook", "blog")

    assert "utm_source" not in result
    assert "https://othersite.com/article" in result


def test_tag_content_links_no_urls_unchanged(monkeypatch):
    from app.services.utm_service import tag_content_links
    from unittest.mock import MagicMock

    mock_settings = MagicMock()
    mock_settings.store_domain = "https://mystore.com"

    monkeypatch.setattr("app.config.get_settings", lambda: mock_settings)

    content = "Just a regular caption with #hashtag and @mention"
    result = tag_content_links(content, "instagram", "general")
    assert result == content


def test_tag_content_links_multiple_store_links(monkeypatch):
    from app.services.utm_service import tag_content_links
    from unittest.mock import MagicMock

    mock_settings = MagicMock()
    mock_settings.store_domain = "https://mystore.com"
    monkeypatch.setattr("app.config.get_settings", lambda: mock_settings)

    content = "Buy at https://mystore.com/a and https://mystore.com/b"
    result = tag_content_links(content, "facebook", "multi")

    assert result.count("utm_source=facebook") == 2
