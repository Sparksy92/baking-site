import logging
from app.config import get_settings
from app.database import db_connection
from app.services.seo_service import research_trending_topics
from app.services.ai_router import AITaskType, get_model_config, generate_with_config

logger = logging.getLogger(__name__)


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
            "Write a short, engaging, professional 2-3 paragraph blog post. "
            "Output ONLY plain text with paragraphs separated by blank lines. "
            "No HTML, no markdown headings, no filler like 'Here is your post:'."
        ),
        "facebook": (
            "Write a conversational Facebook post of 2-4 sentences. "
            "Friendly, story-driven tone. Include a soft call-to-action. "
            "Output ONLY the post text, no labels or filler."
        ),
        "instagram": (
            "Write an Instagram caption: 1-2 punchy sentences followed by a line break, then 5-10 relevant hashtags. "
            "Emotive and visual-first. Output ONLY the caption and hashtags."
        ),
        "x": (
            "Write a single tweet under 280 characters. Bold and punchy. "
            "Maximum 2 hashtags. Output ONLY the tweet text."
        ),
        "linkedin": (
            "Write a professional LinkedIn post of 3-5 sentences with a thought-leadership angle. "
            "End with an open question or insight. Output ONLY the post text."
        ),
        "tiktok": (
            "Write a TikTok video caption: a hook in the first line, 1-2 follow-up sentences, and 3-5 hashtags. "
            "Energetic, trend-aware tone. Output ONLY the caption."
        ),
    }

    instruction = platform_instructions.get(platform, platform_instructions["blog"])

    return f"""You are an expert content creator for {brand_name} — "{brand_tagline}".{persona_block}

Platform: {platform.upper()}
{instruction}
"""


async def generate_blog_post(prompt: str) -> str:
    """Generate a blog post — uses BLOG_POST task type (best available model).

    Researches trending topics first and injects SEO context.
    """
    settings = get_settings()
    persona = await _get_active_persona()

    trend_context = await research_trending_topics(prompt)
    enriched_prompt = prompt
    if trend_context:
        enriched_prompt = (
            f"{prompt}\n\n"
            f"--- SEO CONTEXT (use this to make the post rank well in search) ---\n"
            f"{trend_context}"
        )

    system_prompt = _build_system_prompt(settings.brand_name, settings.brand_tagline, persona, "blog")
    config = await get_model_config(AITaskType.BLOG_POST)
    return await generate_with_config(enriched_prompt, system_prompt, config)


async def generate_social_post(prompt: str, platform: str, task_type: AITaskType = AITaskType.SOCIAL_CAPTION) -> str:
    """Generate a platform-native social post.

    task_type controls model selection:
      - SOCIAL_CAPTION  (default) — fast, cheap, mini model
      - PRODUCT_SOCIAL  — product drop captions
      - SOCIAL_REPLY    — reply to comments (best model, tone-critical)
    """
    settings = get_settings()
    persona = await _get_active_persona()

    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT prompt_template FROM social_platform_configs WHERE platform = ? AND enabled = TRUE",
            (platform,),
        )
        row = await cursor.fetchone()
        custom_template = row["prompt_template"] if row and row["prompt_template"] else None

    if custom_template:
        system_prompt = (
            f"You are an expert content creator for {settings.brand_name}.\n{custom_template}"
        )
    else:
        system_prompt = _build_system_prompt(settings.brand_name, settings.brand_tagline, persona, platform)

    config = await get_model_config(task_type)
    return await generate_with_config(prompt, system_prompt, config)

async def generate_social_drafts_for_page(page_id: int, title: str, content: str, image_url: str | None) -> int:
    """Generate social post drafts for all enabled platforms when a blog post is published.

    One draft per enabled platform is created in social_posts with status='draft'.
    If a platform has auto_publish=True, it is marked 'approved' immediately
    (Sprint 3 will handle the actual outbound API call).

    Returns the number of drafts created.
    """
    created = 0
    source_prompt = f"Title: {title}\n\n{content[:1200]}"

    try:
        async with db_connection() as db:
            cursor = await db.execute(
                "SELECT platform, brand_hashtag, auto_publish FROM social_platform_configs WHERE enabled = TRUE"
            )
            platforms = await cursor.fetchall()

        for row in platforms:
            platform = row["platform"]
            brand_hashtag = (row["brand_hashtag"] or "").strip()
            auto_publish = row["auto_publish"]

            try:
                content_text = await generate_social_post(source_prompt, platform)

                if brand_hashtag:
                    content_text = f"{content_text}\n\n{brand_hashtag}"

                initial_status = "approved" if auto_publish else "draft"

                async with db_connection() as db:
                    await db.execute(
                        """INSERT INTO social_posts
                           (page_id, platform, content, image_url, hashtags, status)
                           VALUES (?, ?, ?, ?, ?, ?)""",
                        (page_id, platform, content_text, image_url, brand_hashtag, initial_status),
                    )
                    await db.commit()

                created += 1
                logger.info(f"Created {initial_status} social draft for platform={platform} page_id={page_id}")

            except Exception as e:
                logger.error(f"Failed to generate social draft for {platform}: {e}")

    except Exception as e:
        logger.error(f"generate_social_drafts_for_page failed: {e}")

    return created


