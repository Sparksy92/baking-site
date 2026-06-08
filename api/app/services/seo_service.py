"""SEO trend research service.

Before generating blog content, this service searches the web for trending topics
and top search results related to the prompt. The findings are injected into the
AI system prompt so the generated content targets real search traffic.

Providers (in order of preference):
  1. SerpAPI  — set SERP_API_KEY in .env for 100 free searches/month
  2. DuckDuckGo Instant Answer API — no key required, limited results
  3. Graceful fallback — returns empty context if both fail
"""
from __future__ import annotations

import logging
import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

DDGO_URL = "https://api.duckduckgo.com/"
SERP_URL = "https://serpapi.com/search"


async def research_trending_topics(prompt: str) -> str:
    """Return a formatted string of trending search context for the given prompt.

    This is injected into the AI system prompt to help generate SEO-targeted content.
    Returns an empty string on any failure so generation always continues.
    """
    settings = get_settings()

    if settings.serp_api_key:
        context = await _search_serpapi(prompt, settings.serp_api_key)
        if context:
            return context

    context = await _search_duckduckgo(prompt)
    if context:
        return context

    logger.info("SEO research returned no results — generating without trend context")
    return ""


async def _search_serpapi(query: str, api_key: str) -> str:
    """Query SerpAPI for Google search results and related questions."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                SERP_URL,
                params={
                    "q": query,
                    "api_key": api_key,
                    "num": 5,
                    "hl": "en",
                },
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()

        lines: list[str] = []

        organic = data.get("organic_results", [])[:5]
        if organic:
            lines.append("Top Google results for this topic:")
            for r in organic:
                title = r.get("title", "")
                snippet = r.get("snippet", "")
                if title:
                    lines.append(f"  - {title}: {snippet}")

        paa = data.get("related_questions", [])[:5]
        if paa:
            lines.append("People also ask:")
            for q in paa:
                lines.append(f"  - {q.get('question', '')}")

        related = data.get("related_searches", [])[:5]
        if related:
            lines.append("Related searches people use:")
            for s in related:
                lines.append(f"  - {s.get('query', '')}")

        return "\n".join(lines) if lines else ""

    except Exception as e:
        logger.warning(f"SerpAPI search failed: {e}")
        return ""


async def _search_duckduckgo(query: str) -> str:
    """Query DuckDuckGo Instant Answer API — no key required."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                DDGO_URL,
                params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
                timeout=8.0,
            )
            resp.raise_for_status()
            data = resp.json()

        lines: list[str] = []

        abstract = data.get("AbstractText", "")
        if abstract:
            lines.append(f"Topic summary: {abstract}")

        related = data.get("RelatedTopics", [])[:4]
        if related:
            lines.append("Related topics people search for:")
            for t in related:
                text = t.get("Text", "") if isinstance(t, dict) else ""
                if text:
                    lines.append(f"  - {text[:120]}")

        return "\n".join(lines) if lines else ""

    except Exception as e:
        logger.warning(f"DuckDuckGo search failed: {e}")
        return ""
