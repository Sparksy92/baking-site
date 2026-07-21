import asyncio
import json
import logging
import re
from app.config import get_settings
from app.database import db_connection
from app.services.seo_service import research_trending_topics
from app.services.ai_router import AITaskType, get_model_config, generate_with_config, call_openai_vision, call_openai_vision_multi

logger = logging.getLogger(__name__)

_RE_FENCE_OPEN = re.compile(r'^```(?:json)?\s*', re.IGNORECASE)
_RE_FENCE_CLOSE = re.compile(r'```\s*$')


async def _get_product_links() -> list[dict]:
    """Fetch published products for internal link injection into blog posts.

    Returns a list of {name, slug, url} dicts (up to 20 most recent products).
    Returns empty list on any failure so blog generation never breaks.
    """
    try:
        settings = get_settings()
        base = settings.store_domain.rstrip("/")
        async with db_connection() as db:
            cursor = await db.execute(
                """SELECT name, slug FROM products
                   WHERE is_active = TRUE OR is_active IS NULL
                   ORDER BY created_at DESC LIMIT 20"""
            )
            rows = await cursor.fetchall()
            return [{"name": r["name"], "slug": r["slug"], "url": f"{base}/products/{r['slug']}"} for r in rows]
    except Exception as e:
        logger.warning(f"_get_product_links failed: {e}")
        return []


async def _get_brand_settings() -> tuple[str, str]:
    """Return (brand_name, brand_tagline) reading DB settings first, config.py as fallback."""
    cfg = get_settings()
    try:
        async with db_connection() as db:
            cursor = await db.execute(
                "SELECT key, value FROM settings WHERE key IN ('brand_name', 'brand_tagline')"
            )
            rows = await cursor.fetchall()
            db_vals = {r["key"]: r["value"] for r in rows if r["value"]}
        return (
            db_vals.get("brand_name") or cfg.brand_name,
            db_vals.get("brand_tagline") or cfg.brand_tagline,
        )
    except Exception as e:
        logger.warning(f"_get_brand_settings DB read failed, using config fallback: {e}")
        return cfg.brand_name, cfg.brand_tagline


async def _get_active_persona() -> dict:
    """Fetch the active brand persona from DB. Returns empty defaults if none set."""
    try:
        async with db_connection() as db:
            cursor = await db.execute(
                "SELECT * FROM brand_persona WHERE is_active = TRUE ORDER BY id DESC LIMIT 1"
            )
            row = await cursor.fetchone()
            if row:
                return dict(row)
    except Exception as e:
        logger.warning(f"Could not load brand persona: {e}")
    return {"voice": "", "audience": "", "values_text": "", "words_to_use": "", "words_to_avoid": ""}


def _build_system_prompt(brand_name: str, brand_tagline: str, persona: dict, platform: str = "blog") -> str:
    persona_block = ""
    if persona.get("voice"):
        persona_block += f"\nBrand voice: {persona['voice']}"
    if persona.get("audience"):
        persona_block += f"\nTarget audience: {persona['audience']}"
    if persona.get("values_text"):
        persona_block += f"\nBrand values: {persona['values_text']}"
    if persona.get("words_to_use"):
        persona_block += f"\nWords/phrases to use: {persona['words_to_use']}"
    if persona.get("words_to_avoid"):
        persona_block += f"\nWords/phrases to NEVER use: {persona['words_to_avoid']}"

    platform_instructions = {
        "blog": (
            "You are writing a structured, long-form SEO blog article. "
            "Output ONLY valid JSON (no markdown fences, no commentary) with this exact shape:\n"
            '{"title": "...", "slug": "...", "meta_description": "...", "keywords": ["..."], "content_html": "..."}\n'
            "Rules:\n"
            "- title: compelling, keyword-rich, under 65 chars\n"
            "- slug: lowercase hyphenated URL slug derived from title\n"
            "- meta_description: 140-155 chars, includes primary keyword, written for click-through\n"
            "- keywords: array of 5-8 SEO keyword strings\n"
            "- content_html: full article as HTML. Must include: one <h2> per major section (3-5 sections), "
            "<p> tags for paragraphs, <strong> for key terms. Minimum 800 words. "
            "No <html>/<body>/<head> wrapper tags.\n"
            "- If product links are provided in the user prompt, naturally embed 1-3 of them as "
            '<a href="{url}">{name}</a> inline links where contextually relevant. '
            "Do NOT force them in. Only link products directly relevant to the article topic."
        ),
        "facebook": (
            "Write a conversational Facebook post of 2-4 sentences. "
            "Friendly, story-driven tone. Include a soft call-to-action. "
            "Do NOT include any hashtags — they are added separately. "
            "Output ONLY the post text, no labels or filler."
        ),
        "instagram": (
            "Write an Instagram caption: 1-2 punchy sentences followed by a line break, then 5-10 relevant hashtags. "
            "Emotive and visual-first. Output ONLY the caption and hashtags."
        ),
        "x": (
            "Write a single tweet under 280 characters. Bold and punchy. "
            "Do NOT include any hashtags — they are added separately. "
            "Output ONLY the tweet text."
        ),
        "linkedin": (
            "Write a professional LinkedIn post of 3-5 sentences with a thought-leadership angle. "
            "End with an open question or insight. "
            "Do NOT include any hashtags — they are added separately. "
            "Output ONLY the post text."
        ),
        "tiktok": (
            "Write a TikTok video caption: a hook in the first line, 1-2 follow-up sentences, and 3-5 hashtags. "
            "Energetic, trend-aware tone. Output ONLY the caption."
        ),
        "threads": (
            "Write a short, punchy Threads post of 1-3 sentences. Conversational and engaging. "
            "Do NOT include any hashtags — they are added separately. "
            "Output ONLY the post text."
        ),
    }

    instruction = platform_instructions.get(platform, platform_instructions["blog"])

    return f"""You are an expert content creator for {brand_name} — "{brand_tagline}".{persona_block}

Platform: {platform.upper()}
{instruction}
"""


def _slugify(text: str) -> str:
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', text.lower())).strip('-')


# Platforms where hashtags are stored separately and must NOT appear in the body
_HASHTAG_SEPARATE_PLATFORMS = {"facebook", "linkedin", "x", "twitter", "threads", "youtube", "pinterest"}


def _strip_tail_hashtags(body_lines: list[str], found: list[str]) -> tuple[list[str], list[str]]:
    """Strip trailing hashtag tokens from the last prose line."""
    if not body_lines:
        return body_lines, found
    words = body_lines[-1].split()
    tail_tags: list[str] = []
    for w in reversed(words):
        if w.startswith('#') and not tail_tags:
            tail_tags.insert(0, w)
        elif w.startswith('#') and tail_tags:
            tail_tags.insert(0, w)
        else:
            break
    if tail_tags:
        prose_words = words[:len(words) - len(tail_tags)]
        body_lines[-1] = ' '.join(prose_words).rstrip()
        found = tail_tags + found
    return body_lines, found


def _strip_inline_hashtags(content: str, platform: str) -> tuple[str, list[str]]:
    """Remove trailing #hashtag tokens from content body for platforms that
    store hashtags in a separate column.  Returns (clean_body, found_tags).

    Strategy: walk lines bottom-up, collecting any line whose tokens are ALL
    hashtags.  Then strip trailing hashtag tokens from the last prose line.
    This reliably handles both dedicated hashtag lines and inline trailing tags.
    """
    if platform not in _HASHTAG_SEPARATE_PLATFORMS:
        return content, []
    lines = content.strip().splitlines()
    body_lines: list[str] = []
    found: list[str] = []
    for line in reversed(lines):
        tokens = line.strip().split()
        if tokens and all(t.startswith('#') for t in tokens):
            found = tokens + found
        else:
            body_lines.insert(0, line)
    body_lines, found = _strip_tail_hashtags(body_lines, found)
    return '\n'.join(body_lines).strip(), found


async def generate_blog_post(prompt: str) -> dict:
    """Generate a fully-structured blog post with SEO fields.

    Returns a dict with keys: title, slug, meta_description, keywords, content_html.
    Researches trending topics first and injects SEO context into the prompt.
    """
    persona = await _get_active_persona()
    (brand_name, brand_tagline), trend_context, products = await asyncio.gather(
        _get_brand_settings(),
        research_trending_topics(prompt),
        _get_product_links(),
    )
    enriched_prompt = prompt
    if trend_context:
        enriched_prompt = (
            f"{prompt}\n\n"
            f"--- SEO CONTEXT (use this to rank well in search) ---\n"
            f"{trend_context}"
        )
    if products:
        product_lines = "\n".join(f'- {p["name"]}: {p["url"]}' for p in products)
        enriched_prompt = (
            f"{enriched_prompt}\n\n"
            f"--- BRAND PRODUCTS (embed 1-3 as contextual anchor links in content_html where relevant) ---\n"
            f"{product_lines}"
        )

    system_prompt = _build_system_prompt(brand_name, brand_tagline, persona, "blog")
    config = await get_model_config(AITaskType.BLOG_POST)
    raw = await generate_with_config(enriched_prompt, system_prompt, config)

    # Strip markdown fences if the model wraps output anyway
    cleaned = _RE_FENCE_OPEN.sub('', raw.strip())
    cleaned = _RE_FENCE_CLOSE.sub('', cleaned.strip())

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("generate_blog_post: model did not return valid JSON — wrapping as content_html")
        data = {"content_html": raw}

    title = data.get("title") or prompt[:80]
    slug = data.get("slug") or _slugify(title)
    meta_description = data.get("meta_description") or ""
    keywords = data.get("keywords") or []
    content_html = data.get("content_html") or raw

    return {
        "title": title,
        "slug": slug,
        "meta_description": meta_description,
        "keywords": keywords,
        "content_html": content_html,
    }


async def generate_image_metadata(image_bytes: bytes, mime_type: str) -> dict:
    """Use GPT-4o Vision to produce an SEO filename slug and alt text for an image.

    Returns a dict with keys:
      filename_slug — lowercase hyphenated, brand-prefixed, no extension
                      e.g. 'badasselder-resilience-hoodie-miitig-ceremony'
      alt_text      — descriptive sentence for screen readers and Google Image Search

    Falls back gracefully if OpenAI key is not configured.
    """
    settings = get_settings()
    api_key = settings.openai_api_key or settings.openrouter_api_key
    if not api_key:
        logger.warning("generate_image_metadata: no OPENAI_API_KEY or OPENROUTER_API_KEY set — skipping vision call")
        return {"filename_slug": "", "alt_text": ""}
    use_openrouter = not settings.openai_api_key and bool(settings.openrouter_api_key)

    brand_name, _ = await _get_brand_settings()
    prompt = (
        f"You are an SEO expert for {brand_name}, an Indigenous-owned Canadian clothing brand. "
        "Look at this image and respond ONLY with valid JSON (no markdown fences) in this exact shape:\n"
        '{"filename_slug": "...", "alt_text": "..."}\n'
        f"Rules:\n"
        f"- filename_slug: lowercase hyphenated slug, start with '{_slugify(brand_name)}', "
        "describe the subject (product, person, event, scene), max 8 words, no extension.\n"
        "- alt_text: one descriptive sentence (10-20 words) for screen readers and Google Image Search. "
        "Include brand name and describe what is shown accurately and respectfully.\n"
        "Output ONLY the JSON object."
    )

    try:
        raw = await call_openai_vision(image_bytes, mime_type, prompt, api_key, use_openrouter=use_openrouter)
        cleaned = re.sub(r'^```(?:json)?\s*', '', raw.strip(), flags=re.IGNORECASE)
        cleaned = re.sub(r'```\s*$', '', cleaned.strip())
        data = json.loads(cleaned)
        return {
            "filename_slug": _slugify(data.get("filename_slug") or ""),
            "alt_text": (data.get("alt_text") or "").strip(),
        }
    except Exception as e:
        logger.warning(f"generate_image_metadata failed: {e}")
        return {"filename_slug": "", "alt_text": ""}


# Platforms that support multiple images natively (carousel/album/slideshow)
_MULTI_IMAGE_PLATFORMS = {"instagram", "facebook", "linkedin", "threads", "tiktok", "x", "twitter"}
# Platforms that only use a single image
_SINGLE_IMAGE_PLATFORMS = {"youtube", "pinterest"}


def assign_images_to_platform(platform: str, image_urls: list[str], max_images: int | None = None) -> dict:
    """Return image_url + additional_image_urls for a given platform.

    max_images: if provided (from social_platform_configs.max_images_per_post),
                this overrides the hardcoded platform sets. Allows admin-editable
                control over how many images each platform receives per draft.

    Falls back to hardcoded sets when max_images is not provided.
    """
    if not image_urls:
        return {"image_url": None, "additional_image_urls": []}

    if max_images is not None:
        # DB-configured limit — cap total images at max_images
        allowed = image_urls[:max(1, max_images)]
        return {"image_url": allowed[0], "additional_image_urls": allowed[1:]}

    # Fallback: hardcoded sets
    first = image_urls[0]
    rest = image_urls[1:3]  # max 3 total
    if platform in _MULTI_IMAGE_PLATFORMS and rest:
        return {"image_url": first, "additional_image_urls": rest}
    return {"image_url": first, "additional_image_urls": []}


async def describe_images_for_content(
    image_urls: list[str],
    extra_context: str = "",
) -> dict:
    """Run GPT-4o Vision on up to 3 uploaded images.

    Returns:
        description  — rich scene description of all images combined, for
                       injection into the social caption generation prompt
        ranked_urls  — same URLs reordered: index 0 = strongest single image
                       for broad use (community/warm), good default for
                       single-image platforms

    Falls back gracefully (returns original URL order + empty description)
    if vision is unavailable.
    """
    settings = get_settings()
    api_key = settings.openai_api_key or settings.openrouter_api_key
    if not api_key or not image_urls:
        return {"description": extra_context, "ranked_urls": image_urls}

    use_openrouter = not settings.openai_api_key and bool(settings.openrouter_api_key)
    brand_name, _ = await _get_brand_settings()
    n = len(image_urls[:3])
    context_line = f'\nExtra context from the brand owner: "{extra_context}"' if extra_context.strip() else ""

    prompt = (
        f"You are a social media content strategist for {brand_name}, an Indigenous-owned brand.\n"
        f"You are looking at {n} image(s) that will be used to create social media posts.\n"
        f"{context_line}\n\n"
        "Respond ONLY with valid JSON (no markdown fences) in this exact shape:\n"
        '{"description": "...", "ranked_order": [1, 2, 3]}\n\n'
        "Rules:\n"
        "- description: 3-5 sentences describing what is happening across all images — "
        "people, setting, mood, activity, objects, cultural elements. Be specific and vivid. "
        "This text will be given to an AI to write social media captions, so include "
        "everything relevant: who, what, where, emotion, story.\n"
        "- ranked_order: array of image numbers (1-indexed) ordered from BEST single image "
        "(most compelling, community-first, visually strongest) to least. "
        f"Only include numbers 1 through {n}.\n"
        "Output ONLY the JSON object."
    )

    try:
        raw = await call_openai_vision_multi(
            image_urls=image_urls[:3],
            prompt=prompt,
            api_key=api_key,
            max_tokens=600,
            use_openrouter=use_openrouter,
        )
        import json as _json
        cleaned = _RE_FENCE_OPEN.sub('', raw.strip())
        cleaned = _RE_FENCE_CLOSE.sub('', cleaned.strip())
        data = _json.loads(cleaned)
        description = (data.get("description") or "").strip()
        ranked_order = data.get("ranked_order") or list(range(1, n + 1))
        ranked_urls = _rank_image_urls(image_urls, ranked_order)
        if extra_context.strip() and description:
            description = f"{description}\n\nBrand owner context: {extra_context.strip()}"
        elif extra_context.strip():
            description = extra_context.strip()
        return {"description": description, "ranked_urls": ranked_urls}
    except Exception as exc:
        logger.warning(f"describe_images_for_content failed: {exc}")
        return {"description": extra_context, "ranked_urls": image_urls}


def _rank_image_urls(image_urls: list[str], ranked_order: list[int]) -> list[str]:
    """Convert 1-indexed ranked_order to a reordered URL list, appending any omitted URLs."""
    ranked_urls: list[str] = []
    for idx in ranked_order:
        if 1 <= idx <= len(image_urls):
            url = image_urls[idx - 1]
            if url not in ranked_urls:
                ranked_urls.append(url)
    for url in image_urls[:3]:
        if url not in ranked_urls:
            ranked_urls.append(url)
    return ranked_urls


def _build_custom_template_prompt(brand_name: str, brand_tagline: str, persona: dict, template: str) -> str:
    """Build system prompt from a custom per-platform template, injecting the persona block."""
    persona_block = ""
    if persona.get("voice"):
        persona_block += f"\nBrand voice: {persona['voice']}"
    if persona.get("audience"):
        persona_block += f"\nTarget audience: {persona['audience']}"
    if persona.get("values_text"):
        persona_block += f"\nBrand values: {persona['values_text']}"
    if persona.get("words_to_use"):
        persona_block += f"\nWords/phrases to use: {persona['words_to_use']}"
    if persona.get("words_to_avoid"):
        persona_block += f"\nWords/phrases to NEVER use: {persona['words_to_avoid']}"
    return f"You are an expert content creator for {brand_name} — \"{brand_tagline}\".{persona_block}\n\n{template}"


_CONTENT_TYPE_DIRECTIVES: dict[str, str] = {
    "educational":   "Content type: EDUCATIONAL — teach something valuable (how-to, tips, insights, statistics). Prioritise value over promotion.",
    "entertaining":  "Content type: ENTERTAINING — make the audience laugh or feel good (relatable story, humour, surprise). No hard sell.",
    "behind_scenes": "Content type: BEHIND THE SCENES — show the real humans, process, or origin story behind the brand. Authentic and personal.",
    "promotional":   "Content type: PROMOTIONAL — it is okay to sell here. Highlight a product, offer, or CTA clearly. Keep it to one post.",
    "community":     "Content type: COMMUNITY — spark conversation. Ask a question, run a poll, or invite the audience to share their story.",
    "professional":  "Content type: PROFESSIONAL — share a business insight, industry perspective, or thought-leadership angle.",
    "ugc":           "Content type: UGC / SOCIAL PROOF — celebrate customer stories, reshare testimonials, or spotlight community members.",
    "company_news":  "Content type: COMPANY NEWS — announce a milestone, new hire, or brand update in an authentic, human tone.",
}

_ALWAYS_SKIP_DISCLOSURE = {"x", "pinterest"}


async def _build_social_system_prompt(
    platform: str, strategy_content_type: str | None
) -> str:
    """Resolve brand/persona and build the system prompt for social generation."""
    (brand_name, brand_tagline), persona = await asyncio.gather(
        _get_brand_settings(),
        _get_active_persona(),
    )
    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT prompt_template FROM social_platform_configs WHERE platform = ? AND enabled = TRUE",
            (platform,),
        )
        row = await cursor.fetchone()
        custom_template = row["prompt_template"] if row and row["prompt_template"] else None
    if custom_template:
        system_prompt = _build_custom_template_prompt(brand_name, brand_tagline, persona, custom_template)
    else:
        system_prompt = _build_system_prompt(brand_name, brand_tagline, persona, platform)
    if strategy_content_type:
        directive = _CONTENT_TYPE_DIRECTIVES.get(
            strategy_content_type,
            f"Content type: {strategy_content_type.upper()} — write in this style.",
        )
        system_prompt = f"{system_prompt}\n\nSTRATEGY DIRECTIVE: {directive}"
    return system_prompt


async def _enrich_prompt_with_trends(prompt: str, enrich: bool) -> str:
    """Optionally append trending context to the prompt."""
    if not enrich:
        return prompt
    trend_context = await research_trending_topics(prompt)
    if not trend_context:
        return prompt
    return (
        f"{prompt}\n\n"
        f"--- TRENDING CONTEXT (use this to make the post timely and relevant) ---\n"
        f"{trend_context}"
    )


async def _append_ai_disclosure(content: str, platform: str) -> str:
    """Append the AI disclosure footer if configured and platform is not in the skip list."""
    try:
        async with db_connection() as _disc_db:
            _disc_cur = await _disc_db.execute(
                "SELECT value FROM settings WHERE key = ?", ("ai_disclosure_text",)
            )
            _disc_row = await _disc_cur.fetchone()
            _disc_text = (_disc_row["value"].strip() if _disc_row and _disc_row["value"] else "").strip()

            _skip_cur = await _disc_db.execute(
                "SELECT value FROM settings WHERE key = ?", ("ai_disclosure_skip_platforms",)
            )
            _skip_row = await _skip_cur.fetchone()
            _skip_platforms = {p.strip().lower() for p in (_skip_row["value"] or "").split(",") if p.strip()} if _skip_row else set()

        _skip_platforms |= _ALWAYS_SKIP_DISCLOSURE
        if _disc_text and platform.lower() not in _skip_platforms and _disc_text not in content:
            return f"{content}\n\n{_disc_text}"
    except Exception as _disc_exc:
        logger.debug(f"AI disclosure append skipped: {_disc_exc}")
    return content


async def generate_social_post(
    prompt: str,
    platform: str,
    task_type: AITaskType = AITaskType.SOCIAL_CAPTION,
    enrich_with_trends: bool = True,
    strategy_content_type: str | None = None,
) -> str:
    """Generate a platform-native social post.

    task_type controls model selection:
      - SOCIAL_CAPTION  (default) — fast, cheap, mini model
      - PRODUCT_SOCIAL  — product drop captions
      - SOCIAL_REPLY    — reply to comments (best model, tone-critical)

    enrich_with_trends: if True, calls research_trending_topics() and injects
    live internet context into the prompt before generation.

    strategy_content_type: Gary Vee content category (educational / community /
    promotional / entertaining / behind_scenes / professional / ugc).
    When provided, a directive is appended to the system prompt so the AI
    writes the correct type of content to restore the mix balance.
    Callers should get this value from pick_content_type_for_platform().
    """
    system_prompt = await _build_social_system_prompt(platform, strategy_content_type)
    enriched_prompt = await _enrich_prompt_with_trends(prompt, enrich_with_trends)
    config = await get_model_config(task_type)
    raw_content = await generate_with_config(enriched_prompt, system_prompt, config)
    clean_content, _inline_tags = _strip_inline_hashtags(raw_content, platform)
    return await _append_ai_disclosure(clean_content, platform)

# Per-platform hashtag best-practice caps (independent of user's max_hashtags setting)
_PLATFORM_HASHTAG_CAPS: dict[str, int] = {
    "facebook":  2,
    "x":         2,
    "twitter":   2,
    "linkedin":  5,
    "instagram": 15,
    "tiktok":    5,
    "threads":   5,
    "youtube":   5,
    "pinterest": 0,
}


async def generate_hashtags_with_ai(content: str, platform: str, max_hashtags: int = 5, banned: set[str] | None = None) -> list[str]:
    """Generate contextual hashtags using AI/LLM.

    Uses a lightweight model to analyze content and suggest relevant, trending hashtags.
    Respects platform-specific limits and banned word list.
    """
    settings = get_settings()
    banned = banned or set()

    # Never exceed the platform best-practice cap, regardless of user setting
    platform_cap = _PLATFORM_HASHTAG_CAPS.get(platform.lower(), max_hashtags)
    if platform_cap == 0:
        return []  # Pinterest — keywords in prose only
    effective_max = min(max_hashtags, platform_cap)

    system_prompt = f"""You are a social media hashtag expert for {settings.brand_name}.
Generate {effective_max} relevant, specific hashtags for this {platform} post.
Rules:
- Use camelCase for multi-word tags (e.g., #NativeFashion not #nativefashion)
- Avoid generic tags like #love #instagood #photooftheday
- Focus on niche, community-specific tags that drive engagement
- Include location-based tags if relevant
- Never use: {', '.join(banned) if banned else 'none'}
- Return EXACTLY {effective_max} hashtags or fewer — never more
Return ONLY a JSON array of strings, nothing else. Example: ["#TagOne", "#TagTwo"]"""

    prompt = f"Platform: {platform}\nContent: {content[:800]}\n\nGenerate up to {effective_max} hashtags:"

    try:
        config = await get_model_config(AITaskType.SOCIAL_CAPTION)  # Fast, cheap model
        result = await generate_with_config(prompt, system_prompt, config)

        # Parse JSON response
        import json
        hashtags = json.loads(result.strip())

        # Validate and clean
        if isinstance(hashtags, list):
            cleaned = []
            for tag in hashtags:
                tag_str = str(tag).strip()
                if not tag_str.startswith('#'):
                    tag_str = f'#{tag_str}'
                # Remove any that contain banned words
                if not any(banned_word in tag_str.lower() for banned_word in banned):
                    cleaned.append(tag_str)
            return cleaned[:effective_max]
    except Exception as e:
        logger.warning(f"AI hashtag generation failed, falling back to rule-based: {e}")

    return []  # Return empty on failure - caller should fall back


def _extract_inline_images(content_html: str | None) -> list[str]:
    """Extract image URLs from <img> tags in HTML content."""
    if not content_html:
        return []
    import re
    # Find all img src URLs - handles both single and double quotes
    urls = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', content_html, re.IGNORECASE)
    # Filter out data URIs and empty strings
    return [url for url in urls if url and not url.startswith('data:')]


async def generate_social_drafts_for_page(page_id: int, title: str, content: str, image_url: str | None, content_html: str | None = None) -> int:
    """Generate social post drafts for all enabled platforms when a blog post is published.

    One draft per enabled platform is created in social_posts with status='draft'.
    If a platform has auto_publish=True, it is marked 'approved' immediately
    (Sprint 3 will handle the actual outbound API call).

    Args:
        content_html: Full HTML content to extract inline images from

    Returns the number of drafts created.
    """
    created = 0
    source_prompt = f"Title: {title}\n\n{content[:1200]}"

    # Extract inline images from HTML content
    inline_images = _extract_inline_images(content_html)
    additional_image_urls = json.dumps(inline_images) if inline_images else None

    try:
        async with db_connection() as db:
            cursor = await db.execute(
                "SELECT platform, brand_hashtag, banned_hashtags, max_hashtags, hashtag_mode, auto_publish "
                "FROM social_platform_configs WHERE enabled = TRUE"
            )
            platforms = await cursor.fetchall()

        VIDEO_ONLY_PLATFORMS = {"youtube", "tiktok"}

        for row in platforms:
            platform = row["platform"]
            brand_hashtag = (row["brand_hashtag"] or "").strip()
            banned_hashtags = {t.strip().lower() for t in (row["banned_hashtags"] or "").split("\n") if t.strip()}
            max_hashtags = row["max_hashtags"] or 5
            hashtag_mode = row["hashtag_mode"] or "auto"
            auto_publish = row["auto_publish"]

            # Skip video-only platforms when the source content has no video
            if platform in VIDEO_ONLY_PLATFORMS and not image_url:
                logger.info(f"Skipping {platform} draft — no video attached to page_id={page_id}")
                continue

            try:
                from app.services.posting_strategy_service import pick_content_type_for_platform
                try:
                    strategy_ctype = await pick_content_type_for_platform(platform)
                except Exception as _e:
                    logger.warning(f"pick_content_type_for_platform failed for {platform}: {_e}")
                    strategy_ctype = "educational"

                content_text = await generate_social_post(
                    source_prompt, platform,
                    enrich_with_trends=False,
                    strategy_content_type=strategy_ctype,
                )

                # Generate AI hashtags for this platform unless hashtags are disabled
                hashtags_list: list[str] = []
                if hashtag_mode != "none":
                    hashtags_list = await generate_hashtags_with_ai(
                        content_text, platform, max_hashtags, banned_hashtags
                    )
                    # Prepend brand hashtag if configured and not already present
                    if brand_hashtag:
                        tag = brand_hashtag if brand_hashtag.startswith("#") else f"#{brand_hashtag}"
                        if tag not in hashtags_list:
                            hashtags_list = [tag] + hashtags_list[:max_hashtags - 1]

                hashtags_json = json.dumps(hashtags_list) if hashtags_list else None

                initial_status = "approved" if auto_publish else "draft"

                async with db_connection() as db:
                    await db.execute(
                        """INSERT INTO social_posts
                           (page_id, platform, content, image_url, additional_image_urls,
                            hashtags, status, strategy_content_type)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                        (page_id, platform, content_text, image_url, additional_image_urls,
                         hashtags_json, initial_status, strategy_ctype),
                    )
                    await db.commit()

                created += 1
                logger.info(
                    f"Created {initial_status} social draft for platform={platform} "
                    f"page_id={page_id} strategy_content_type={strategy_ctype} hashtags={len(hashtags_list)}"
                )

            except Exception as e:
                logger.error(f"Failed to generate social draft for {platform}: {e}")

    except Exception as e:
        logger.error(f"generate_social_drafts_for_page failed: {e}")

    return created


