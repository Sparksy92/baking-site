import logging
import httpx
from app.config import get_settings
from app.database import db_connection

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
    """Generate a blog post from a prompt using the configured AI provider."""
    settings = get_settings()
    persona = await _get_active_persona()
    system_prompt = _build_system_prompt(settings.brand_name, settings.brand_tagline, persona, "blog")

    if settings.openai_api_key:
        return await _generate_with_openai(prompt, settings.openai_api_key, system_prompt)
    elif settings.gemini_api_key:
        return await _generate_with_gemini(prompt, settings.gemini_api_key, system_prompt)
    else:
        raise ValueError("No AI provider configured. Please set OPENAI_API_KEY or GEMINI_API_KEY in your environment.")


async def generate_social_post(prompt: str, platform: str) -> str:
    """Generate a platform-native social post from a blog post prompt/content."""
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

    if settings.openai_api_key:
        return await _generate_with_openai(prompt, settings.openai_api_key, system_prompt)
    elif settings.gemini_api_key:
        return await _generate_with_gemini(prompt, settings.gemini_api_key, system_prompt)
    else:
        raise ValueError("No AI provider configured. Please set OPENAI_API_KEY or GEMINI_API_KEY in your environment.")

async def _generate_with_openai(prompt: str, api_key: str, system_prompt: str) -> str:
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 500
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload, timeout=30.0)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"].strip()


async def _generate_with_gemini(prompt: str, api_key: str, system_prompt: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": system_prompt + "\n\nUser Prompt: " + prompt}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 500
        }
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload, timeout=30.0)
        response.raise_for_status()
        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
