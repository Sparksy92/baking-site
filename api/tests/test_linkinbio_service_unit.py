"""Unit tests for linkinbio_service pure functions — no database."""
import pytest
import string


# ── generate_slug ─────────────────────────────────────────────────────────────

def test_generate_slug_default_length():
    from app.services.linkinbio_service import generate_slug
    slug = generate_slug()
    assert len(slug) == 8


def test_generate_slug_custom_length():
    from app.services.linkinbio_service import generate_slug
    assert len(generate_slug(12)) == 12
    assert len(generate_slug(4)) == 4


def test_generate_slug_only_alphanumeric():
    from app.services.linkinbio_service import generate_slug
    allowed = set(string.ascii_lowercase + string.digits)
    for _ in range(20):
        slug = generate_slug()
        assert all(c in allowed for c in slug), f"Non-alphanumeric char in slug: {slug}"


def test_generate_slug_is_random():
    from app.services.linkinbio_service import generate_slug
    slugs = {generate_slug() for _ in range(50)}
    # With 36^8 possibilities, all 50 should be unique
    assert len(slugs) == 50


def test_generate_slug_length_one():
    from app.services.linkinbio_service import generate_slug
    assert len(generate_slug(1)) == 1
