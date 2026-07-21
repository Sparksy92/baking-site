"""Unit tests for rss_service pure parsing functions — no network/DB."""
import pytest
from xml.etree import ElementTree as ET


# ── parse_rss_item ────────────────────────────────────────────────────────────

def _rss_item(title="Test Post", link="https://example.com/post",
              pub_date=None, description=None, guid=None) -> ET.Element:
    el = ET.Element("item")
    t = ET.SubElement(el, "title"); t.text = title
    l = ET.SubElement(el, "link"); l.text = link
    if guid is not None:
        g = ET.SubElement(el, "guid"); g.text = guid
    if pub_date is not None:
        p = ET.SubElement(el, "pubDate"); p.text = pub_date
    if description is not None:
        d = ET.SubElement(el, "description"); d.text = description
    return el


def test_parse_rss_item_basic():
    from app.services.rss_service import parse_rss_item
    item = _rss_item()
    result = parse_rss_item(item)
    assert result is not None
    assert result["title"] == "Test Post"
    assert result["url"] == "https://example.com/post"


def test_parse_rss_item_missing_title_returns_none():
    from app.services.rss_service import parse_rss_item
    el = ET.Element("item")
    link = ET.SubElement(el, "link"); link.text = "https://example.com"
    assert parse_rss_item(el) is None


def test_parse_rss_item_missing_link_returns_none():
    from app.services.rss_service import parse_rss_item
    el = ET.Element("item")
    title = ET.SubElement(el, "title"); title.text = "Title"
    assert parse_rss_item(el) is None


def test_parse_rss_item_guid_used_when_present():
    from app.services.rss_service import parse_rss_item
    item = _rss_item(guid="unique-guid-123")
    result = parse_rss_item(item)
    assert result["guid"] == "unique-guid-123"


def test_parse_rss_item_guid_falls_back_to_link():
    from app.services.rss_service import parse_rss_item
    item = _rss_item()  # no guid
    result = parse_rss_item(item)
    assert result["guid"] == "https://example.com/post"


def test_parse_rss_item_pub_date():
    from app.services.rss_service import parse_rss_item
    item = _rss_item(pub_date="Mon, 01 Jan 2024 12:00:00 GMT")
    result = parse_rss_item(item)
    assert result["published_at"] == "Mon, 01 Jan 2024 12:00:00 GMT"


def test_parse_rss_item_pub_date_none_when_missing():
    from app.services.rss_service import parse_rss_item
    item = _rss_item()
    result = parse_rss_item(item)
    assert result["published_at"] is None


def test_parse_rss_item_description_truncated_at_300():
    from app.services.rss_service import parse_rss_item
    long_desc = "x" * 500
    item = _rss_item(description=long_desc)
    result = parse_rss_item(item)
    assert len(result["description"]) == 300


def test_parse_rss_item_short_description_preserved():
    from app.services.rss_service import parse_rss_item
    item = _rss_item(description="Short description")
    result = parse_rss_item(item)
    assert result["description"] == "Short description"


def test_parse_rss_item_empty_description():
    from app.services.rss_service import parse_rss_item
    item = _rss_item(description="")
    result = parse_rss_item(item)
    assert result["description"] == ""


# ── parse_atom_entry ──────────────────────────────────────────────────────────

NS = "http://www.w3.org/2005/Atom"

def _atom_entry(title="Atom Post", link_href="https://example.com/atom",
                entry_id=None, published=None, summary=None) -> ET.Element:
    el = ET.Element(f"{{{NS}}}entry")
    t = ET.SubElement(el, f"{{{NS}}}title"); t.text = title
    l = ET.SubElement(el, f"{{{NS}}}link"); l.set("href", link_href)
    if entry_id is not None:
        i = ET.SubElement(el, f"{{{NS}}}id"); i.text = entry_id
    if published is not None:
        p = ET.SubElement(el, f"{{{NS}}}published"); p.text = published
    if summary is not None:
        s = ET.SubElement(el, f"{{{NS}}}summary"); s.text = summary
    return el


def test_parse_atom_entry_basic():
    from app.services.rss_service import parse_atom_entry
    entry = _atom_entry()
    result = parse_atom_entry(entry)
    assert result is not None
    assert result["title"] == "Atom Post"
    assert result["url"] == "https://example.com/atom"


def test_parse_atom_entry_missing_title_returns_none():
    from app.services.rss_service import parse_atom_entry
    el = ET.Element(f"{{{NS}}}entry")
    link = ET.SubElement(el, f"{{{NS}}}link"); link.set("href", "https://example.com")
    assert parse_atom_entry(el) is None


def test_parse_atom_entry_id_used_as_guid():
    from app.services.rss_service import parse_atom_entry
    entry = _atom_entry(entry_id="urn:uuid:abc-123")
    result = parse_atom_entry(entry)
    assert result["guid"] == "urn:uuid:abc-123"


def test_parse_atom_entry_link_as_guid_fallback():
    from app.services.rss_service import parse_atom_entry
    entry = _atom_entry()  # no id
    result = parse_atom_entry(entry)
    assert result["guid"] == "https://example.com/atom"


def test_parse_atom_entry_published_at():
    from app.services.rss_service import parse_atom_entry
    entry = _atom_entry(published="2024-01-01T12:00:00Z")
    result = parse_atom_entry(entry)
    assert result["published_at"] == "2024-01-01T12:00:00Z"


def test_parse_atom_entry_published_at_none_when_missing():
    from app.services.rss_service import parse_atom_entry
    entry = _atom_entry()
    result = parse_atom_entry(entry)
    assert result["published_at"] is None


def test_parse_atom_entry_summary_truncated():
    from app.services.rss_service import parse_atom_entry
    entry = _atom_entry(summary="y" * 500)
    result = parse_atom_entry(entry)
    assert len(result["description"]) == 300


def test_parse_atom_entry_no_summary_empty_string():
    from app.services.rss_service import parse_atom_entry
    entry = _atom_entry()
    result = parse_atom_entry(entry)
    assert result["description"] == ""
