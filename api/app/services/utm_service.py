"""UTM tracking utility.

Appends UTM parameters to any URL before it is posted to a social platform.
This gives full attribution in Google Analytics / Plausible for all
social-driven traffic.

Usage:
    url = tag_url("https://mystore.com/blog/my-post", "facebook", "blog-my-post")
    # → https://mystore.com/blog/my-post?utm_source=facebook&utm_medium=social&utm_campaign=blog-my-post&utm_content=organic
"""
from __future__ import annotations

from urllib.parse import urlencode, urlparse, urlunparse, parse_qs


def tag_url(
    url: str,
    platform: str,
    campaign: str,
    medium: str = "social",
    content: str = "organic",
) -> str:
    """Return url with UTM parameters appended.

    Existing query params are preserved. Existing utm_* params are overwritten.

    Args:
        url:      The destination URL (absolute)
        platform: Social platform name used as utm_source (e.g. 'facebook')
        campaign: Slug or identifier for the content piece (e.g. blog post slug)
        medium:   Default 'social'
        content:  Default 'organic' — use 'paid' for ad-boosted posts
    """
    if not url or not url.startswith("http"):
        return url

    parsed = urlparse(url)
    existing_params = parse_qs(parsed.query, keep_blank_values=True)

    utm_params = {
        "utm_source":   [_normalise(platform)],
        "utm_medium":   [medium],
        "utm_campaign": [_normalise(campaign)],
        "utm_content":  [content],
    }

    merged = {**existing_params, **utm_params}
    new_query = urlencode({k: v[0] for k, v in merged.items()})

    tagged = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        new_query,
        parsed.fragment,
    ))
    return tagged


def tag_content_links(content: str, platform: str, campaign: str) -> str:
    """Find bare https:// URLs in post content and tag them with UTM params.

    Only tags URLs that look like store links (contain the store domain).
    Hashtags and mentions are never modified.
    """
    import re
    from app.config import get_settings

    store_domain = get_settings().store_domain.rstrip("/")
    domain_host = urlparse(store_domain).netloc

    def _replace(match: re.Match) -> str:
        url = match.group(0)
        if domain_host in url:
            return tag_url(url, platform, campaign)
        return url

    return re.sub(r"https?://[^\s\"'<>]+", _replace, content)


def _normalise(value: str) -> str:
    """Lowercase and replace spaces/slashes with hyphens for clean UTM values."""
    return value.lower().replace(" ", "-").replace("/", "-").replace("_", "-")
