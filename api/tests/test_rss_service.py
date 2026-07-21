"""Tests for RSS auto-publish service and admin API.

Covers: feed CRUD, item fetching+parsing, GUID deduplication,
daily rate limiting, check-all, stats, delete.

External HTTP calls to real feed URLs are avoided — we test the
parsing helpers directly and mock httpx for integration paths.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch, MagicMock
from xml.etree import ElementTree as ET


# ── Helpers ───────────────────────────────────────────────────────────────────

RSS_XML = """<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Blog</title>
    <link>https://example.com</link>
    <item>
      <title>First Post</title>
      <link>https://example.com/first-post</link>
      <guid>https://example.com/first-post</guid>
      <pubDate>Mon, 01 Jan 2025 12:00:00 +0000</pubDate>
      <description>This is the first post description.</description>
    </item>
    <item>
      <title>Second Post</title>
      <link>https://example.com/second-post</link>
      <guid>https://example.com/second-post</guid>
      <pubDate>Tue, 02 Jan 2025 12:00:00 +0000</pubDate>
      <description>Second post description.</description>
    </item>
  </channel>
</rss>"""

ATOM_XML = """<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Atom Feed</title>
  <entry>
    <title>Atom Entry One</title>
    <link href="https://example.com/atom-one"/>
    <id>https://example.com/atom-one</id>
    <published>2025-01-01T12:00:00Z</published>
    <summary>Summary of atom entry one.</summary>
  </entry>
  <entry>
    <title>Atom Entry Two</title>
    <link href="https://example.com/atom-two"/>
    <id>https://example.com/atom-two</id>
    <updated>2025-01-02T12:00:00Z</updated>
  </entry>
</feed>"""


async def _create_feed(admin_client: AsyncClient, **overrides) -> dict:
    payload = {
        "name": "Test Feed",
        "url": "https://example.com/feed.xml",
        "platform": "instagram",
        "content_template": "📰 {title}\n\n{url}",
        "auto_publish": False,
        "max_posts_per_day": 5,
        **overrides,
    }
    resp = await admin_client.post("/api/admin/rss/feeds", json=payload)
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


# ── Parser unit tests — no DB, no network ────────────────────────────────────

def test_parse_rss_item_extracts_fields():
    from app.services.rss_service import parse_rss_item
    root = ET.fromstring(RSS_XML)
    channel = root.find("channel")
    item = channel.findall("item")[0]
    parsed = parse_rss_item(item)
    assert parsed is not None
    assert parsed["title"] == "First Post"
    assert parsed["url"] == "https://example.com/first-post"
    assert parsed["guid"] == "https://example.com/first-post"
    assert "description" in parsed


def test_parse_rss_item_returns_none_without_title_or_link():
    from app.services.rss_service import parse_rss_item
    item = ET.fromstring("<item><description>no title or link</description></item>")
    assert parse_rss_item(item) is None


def test_parse_atom_entry_extracts_fields():
    from app.services.rss_service import parse_atom_entry
    root = ET.fromstring(ATOM_XML)
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    entries = root.findall("atom:entry", ns)
    parsed = parse_atom_entry(entries[0])
    assert parsed is not None
    assert parsed["title"] == "Atom Entry One"
    assert parsed["url"] == "https://example.com/atom-one"
    assert parsed["guid"] == "https://example.com/atom-one"


def test_parse_atom_entry_falls_back_to_updated():
    from app.services.rss_service import parse_atom_entry
    root = ET.fromstring(ATOM_XML)
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    entries = root.findall("atom:entry", ns)
    # Second entry has no <published>, only <updated>
    parsed = parse_atom_entry(entries[1])
    assert parsed is not None
    assert parsed["published_at"] is not None


def test_parse_rss_description_truncated_at_300_chars():
    from app.services.rss_service import parse_rss_item
    long_desc = "x" * 400
    xml = f"<item><title>T</title><link>https://a.com</link><description>{long_desc}</description></item>"
    item = ET.fromstring(xml)
    parsed = parse_rss_item(item)
    assert len(parsed["description"]) <= 300


# ── Feed CRUD API tests ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_rss_feed(admin_client: AsyncClient):
    data = await _create_feed(admin_client)
    assert "id" in data
    assert data["id"] > 0
    assert data["created"] is True


@pytest.mark.asyncio
async def test_list_rss_feeds(admin_client: AsyncClient):
    await _create_feed(admin_client, name="Feed Alpha")
    await _create_feed(admin_client, name="Feed Beta")
    resp = await admin_client.get("/api/admin/rss/feeds")
    assert resp.status_code == 200
    data = resp.json()
    assert "feeds" in data
    names = [f["name"] for f in data["feeds"]]
    assert "Feed Alpha" in names
    assert "Feed Beta" in names


@pytest.mark.asyncio
async def test_get_rss_feed_by_id(admin_client: AsyncClient):
    created = await _create_feed(admin_client, name="Get By ID")
    resp = await admin_client.get(f"/api/admin/rss/feeds/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Get By ID"


@pytest.mark.asyncio
async def test_get_nonexistent_feed_returns_404(admin_client: AsyncClient):
    resp = await admin_client.get("/api/admin/rss/feeds/999999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_patch_feed_auto_publish(admin_client: AsyncClient):
    created = await _create_feed(admin_client, auto_publish=False)
    resp = await admin_client.patch(
        f"/api/admin/rss/feeds/{created['id']}",
        json={"auto_publish": True},
    )
    assert resp.status_code == 200
    assert resp.json()["updated"] is True


@pytest.mark.asyncio
async def test_patch_feed_max_posts_per_day(admin_client: AsyncClient):
    created = await _create_feed(admin_client, max_posts_per_day=3)
    resp = await admin_client.patch(
        f"/api/admin/rss/feeds/{created['id']}",
        json={"max_posts_per_day": 10},
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_patch_feed_no_fields_returns_400(admin_client: AsyncClient):
    created = await _create_feed(admin_client)
    resp = await admin_client.patch(f"/api/admin/rss/feeds/{created['id']}", json={})
    assert resp.status_code in (400, 422)


@pytest.mark.asyncio
async def test_delete_rss_feed(admin_client: AsyncClient):
    created = await _create_feed(admin_client, name="To Delete")
    feed_id = created["id"]
    resp = await admin_client.delete(f"/api/admin/rss/feeds/{feed_id}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True
    resp2 = await admin_client.get(f"/api/admin/rss/feeds/{feed_id}")
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_feed_returns_404(admin_client: AsyncClient):
    resp = await admin_client.delete("/api/admin/rss/feeds/999999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_rss_feeds_require_auth(client: AsyncClient):
    for method, path in [
        ("GET", "/api/admin/rss/feeds"),
        ("POST", "/api/admin/rss/feeds"),
        ("DELETE", "/api/admin/rss/feeds/1"),
    ]:
        resp = await getattr(client, method.lower())(path)
        assert resp.status_code == 401


# ── Feed stats ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_feed_stats(admin_client: AsyncClient):
    created = await _create_feed(admin_client, name="Stats Feed")
    resp = await admin_client.get(f"/api/admin/rss/feeds/{created['id']}/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "feed" in data
    assert "total_items_posted" in data
    assert "recent_items" in data
    assert data["total_items_posted"] == 0


@pytest.mark.asyncio
async def test_get_stats_nonexistent_returns_404(admin_client: AsyncClient):
    resp = await admin_client.get("/api/admin/rss/feeds/999999/stats")
    assert resp.status_code == 404


# ── Service-level: fetch_feed + GUID dedup ───────────────────────────────────

@pytest.mark.asyncio
async def test_fetch_feed_parses_rss(client):
    from app.services.rss_service import fetch_feed
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.content = RSS_XML.encode()

    with patch("app.services.rss_service.httpx.AsyncClient") as MockClient:
        mock_http = AsyncMock()
        mock_http.get = AsyncMock(return_value=mock_response)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        items = await fetch_feed("https://example.com/feed.xml")

    assert len(items) == 2
    assert items[0]["title"] == "First Post"
    assert items[1]["title"] == "Second Post"


@pytest.mark.asyncio
async def test_fetch_feed_parses_atom(client):
    from app.services.rss_service import fetch_feed
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.content = ATOM_XML.encode()

    with patch("app.services.rss_service.httpx.AsyncClient") as MockClient:
        mock_http = AsyncMock()
        mock_http.get = AsyncMock(return_value=mock_response)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        items = await fetch_feed("https://example.com/atom.xml")

    assert len(items) == 2
    assert items[0]["title"] == "Atom Entry One"


@pytest.mark.asyncio
async def test_fetch_feed_returns_empty_on_network_error(client):
    from app.services.rss_service import fetch_feed
    with patch("app.services.rss_service.httpx.AsyncClient") as MockClient:
        mock_http = AsyncMock()
        mock_http.get = AsyncMock(side_effect=Exception("connection refused"))
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        items = await fetch_feed("https://broken.example.com/feed.xml")

    assert items == []


@pytest.mark.asyncio
async def test_check_feed_deduplicates_guids(admin_client: AsyncClient, client):
    """Checking the same feed twice should not create duplicate posts."""
    from app.services.rss_service import check_feed, create_feed

    feed = await create_feed(
        name="Dedup Feed",
        url="https://example.com/dedup.xml",
        platform="facebook",
        auto_publish=False,
        max_posts_per_day=10,
    )
    feed_id = feed["id"]

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.content = RSS_XML.encode()

    with patch("app.services.rss_service.httpx.AsyncClient") as MockClient:
        mock_http = AsyncMock()
        mock_http.get = AsyncMock(return_value=mock_response)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        result1 = await check_feed(feed_id)
        result2 = await check_feed(feed_id)

    assert result1["posts_created"] == 2
    assert result2["posts_created"] == 0  # GUIDs already known


@pytest.mark.asyncio
async def test_check_feed_respects_rate_limit(client):
    """Feed with max_posts_per_day=1 should stop after 1 post."""
    from app.services.rss_service import create_feed, check_feed

    feed = await create_feed(
        name="Rate Limited",
        url="https://example.com/limited.xml",
        platform="instagram",
        max_posts_per_day=1,
        auto_publish=False,
    )
    feed_id = feed["id"]

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.content = RSS_XML.encode()

    with patch("app.services.rss_service.httpx.AsyncClient") as MockClient:
        mock_http = AsyncMock()
        mock_http.get = AsyncMock(return_value=mock_response)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await check_feed(feed_id)

    assert result["posts_created"] == 1


@pytest.mark.asyncio
async def test_check_feed_creates_correct_status_for_auto_publish(client):
    """auto_publish=True should create 'approved' posts; False → 'scheduled'."""
    from app.services.rss_service import create_feed, check_feed
    from app.database import db_connection

    for auto_publish, expected_status in [(False, "scheduled"), (True, "approved")]:
        feed = await create_feed(
            name=f"AutoPublish={auto_publish}",
            url=f"https://example.com/feed-{auto_publish}.xml",
            platform="linkedin",
            max_posts_per_day=5,
            auto_publish=auto_publish,
        )
        feed_id = feed["id"]

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        # Use unique GUIDs per iteration to avoid dedup
        xml = RSS_XML.replace("first-post", f"post-{auto_publish}-1").replace(
            "second-post", f"post-{auto_publish}-2"
        )
        mock_response.content = xml.encode()

        with patch("app.services.rss_service.httpx.AsyncClient") as MockClient:
            mock_http = AsyncMock()
            mock_http.get = AsyncMock(return_value=mock_response)
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_http)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await check_feed(feed_id)

        assert result["posts_created"] >= 1
        post_id = result["posts"][0]["post_id"]

        async with db_connection() as db:
            cur = await db.execute("SELECT status FROM social_posts WHERE id = ?", (post_id,))
            row = await cur.fetchone()

        assert row["status"] == expected_status, f"Expected {expected_status} for auto_publish={auto_publish}"


@pytest.mark.asyncio
async def test_check_all_feeds_runs_without_error(admin_client: AsyncClient):
    resp = await admin_client.post("/api/admin/rss/check-all")
    assert resp.status_code == 200
    data = resp.json()
    assert "feeds_checked" in data
    assert "total_posts_created" in data


# ── UTM tagging on RSS posts ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_rss_post_content_contains_utm_params(client):
    """RSS-created social posts must have UTM-tagged URLs for revenue attribution."""
    from app.services.rss_service import create_feed, check_feed
    from app.database import db_connection

    feed = await create_feed(
        name="UTM Test Feed",
        url="https://example.com/utm-test.xml",
        platform="instagram",
        content_template="📰 {title}\n\n{url}",
        max_posts_per_day=5,
        auto_publish=False,
    )
    feed_id = feed["id"]

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.content = RSS_XML.encode()

    with patch("app.services.rss_service.httpx.AsyncClient") as MockClient:
        mock_http = AsyncMock()
        mock_http.get = AsyncMock(return_value=mock_response)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await check_feed(feed_id)

    assert result["posts_created"] >= 1
    post_id = result["posts"][0]["post_id"]

    async with db_connection() as db:
        cur = await db.execute("SELECT content FROM social_posts WHERE id = ?", (post_id,))
        row = await cur.fetchone()

    content = row["content"]
    assert "utm_source=instagram" in content
    assert "utm_medium=social" in content
    assert "utm_campaign=rss-" in content


def test_utm_tag_url_basic():
    """tag_url should append utm_source, utm_medium, utm_campaign."""
    from app.services.utm_service import tag_url
    result = tag_url("https://example.com/blog/post-one", "facebook", "rss-post-one")
    assert "utm_source=facebook" in result
    assert "utm_medium=social" in result
    assert "utm_campaign=rss-post-one" in result


def test_utm_tag_url_preserves_existing_params():
    """tag_url must not drop existing non-UTM query params."""
    from app.services.utm_service import tag_url
    result = tag_url("https://example.com/post?ref=newsletter", "instagram", "test")
    assert "ref=newsletter" in result
    assert "utm_source=instagram" in result


def test_utm_tag_url_skips_non_http():
    """tag_url should return the URL unchanged if it doesn't start with http."""
    from app.services.utm_service import tag_url
    result = tag_url("", "instagram", "test")
    assert result == ""
    result2 = tag_url("mailto:info@example.com", "instagram", "test")
    assert "utm_source" not in result2
