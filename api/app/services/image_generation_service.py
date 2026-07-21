"""AI image prompt generation service.

Generates platform-specific, brand-populated image-generation prompts.
Each enabled social platform gets the right number of images, correct
dimensions, and visual roles for that platform.  Blog/pages context gets
a website-optimised set instead.

The result is run through the IMAGE_PROMPT_GEN LLM task and returned as
a formatted string the admin can read, copy, and paste into any image
generator (DALL-E, Midjourney, Firefly, etc.).

Dynamic data injected:
  brand_name        ← settings.brand_name
  brand_tagline     ← settings.brand_tagline
  voice             ← brand_persona.voice
  audience          ← brand_persona.audience
  values            ← brand_persona.values_text
  words_to_use      ← brand_persona.words_to_use
  words_to_avoid    ← brand_persona.words_to_avoid
  disclosure        ← settings.ai_disclosure_text
  content           ← AI-generated text (passed from frontend)
  topic             ← user's original prompt/title (passed from frontend)
  platforms_block   ← dynamically built from enabled platforms DB query
"""
from __future__ import annotations

import logging
from typing import Literal

from app.database import db_connection
from app.services.ai_router import AITaskType, get_model_config, generate_with_config

logger = logging.getLogger(__name__)

_DEFAULT_PRONOUNS = "he/him"

# ── Per-platform image specs ───────────────────────────────────────────────
# Each entry defines: image count, primary dimension, aspect ratio label,
# and the ordered visual roles for that platform's images.

_PLATFORM_SPECS: dict[str, dict] = {
    "facebook": {
        "label": "Facebook",
        "count": 1,
        "dimension": "1080 × 1080 px (1:1 square) — also works as 1200 × 628 px (16:9) for link posts",
        "notes": "Facebook performs best with one strong, clean image per post. Leave the upper third clear for optional text overlay. Square format gets the most real estate in the feed on both desktop and mobile.",
        "roles": [
            "Scroll-stopping hero — bold visual that stops the thumb mid-scroll and creates immediate emotional connection with the brand message",
        ],
    },
    "instagram": {
        "label": "Instagram Feed (3-image carousel)",
        "count": 3,
        "dimension": "1080 × 1350 px (4:5 portrait) — maximum feed real estate on mobile",
        "notes": "Instagram carousels with 3–5 slides get 3× more reach than single posts. Use a consistent left-edge visual element so slides feel connected when swiped. Leave the lower quarter clear for caption-matching overlay text added later in Canva.",
        "roles": [
            "Slide 1 — Hero / scroll-stopper: bold, emotionally engaging opening image that makes people swipe to see more",
            "Slide 2 — Story / human connection: shows the real people, community, or transformation behind the message",
            "Slide 3 — Call-to-action closer: motivates the audience to take the next step — visit, contact, buy, or save",
        ],
    },
    "instagram_story": {
        "label": "Instagram Story / Reel Cover",
        "count": 1,
        "dimension": "1080 × 1920 px (9:16 vertical full-screen)",
        "notes": "Stories are full-screen and vertical. Keep the key subject centered and away from the top 250 px (UI overlay area) and bottom 350 px (reaction/reply bar). Strong contrast between subject and background is essential.",
        "roles": [
            "Vertical full-screen story image — immediate visual impact designed for full-screen mobile viewing, centered subject with clean zones at top and bottom for text/sticker overlays",
        ],
    },
    "linkedin": {
        "label": "LinkedIn",
        "count": 1,
        "dimension": "1200 × 627 px (16:9 landscape) — or 1080 × 1080 px (1:1) for feed posts",
        "notes": "LinkedIn audiences expect professional, credibility-first visuals. Avoid casual or overly playful imagery. Warm but authoritative. Show outcomes, workspaces, community, or expertise rather than abstract concepts.",
        "roles": [
            "Professional credibility image — communicates expertise, trust, results, or community leadership in a visually authoritative and human way",
        ],
    },
    "threads": {
        "label": "Threads",
        "count": 1,
        "dimension": "1080 × 1080 px (1:1 square) — also works as 1080 × 1350 px (4:5 portrait)",
        "notes": "Threads is text-first but images add significant reach. Keep it clean, authentic, and conversational — not overly polished. One clear subject, minimal props, real-feeling environment.",
        "roles": [
            "Authentic conversation-starter image — real, grounded, and human visual that complements the text and feels native to a discussion-first platform",
        ],
    },
    "tiktok": {
        "label": "TikTok (Video Cover / Thumbnail)",
        "count": 1,
        "dimension": "1080 × 1920 px (9:16 vertical) — this is a video cover/thumbnail concept",
        "notes": "TikTok is video-first. This prompt is for the video cover thumbnail shown in the profile grid and before playback. High-contrast, bold, with a clear subject. Treat it like a magazine cover — compelling at small size.",
        "roles": [
            "Video cover thumbnail — bold, high-contrast vertical image that works as a compelling still frame to make viewers click play",
        ],
    },
    "x": {
        "label": "X / Twitter",
        "count": 1,
        "dimension": "1200 × 675 px (16:9 landscape) — Twitter crops to 16:9 in feed",
        "notes": "X/Twitter images are cropped to 16:9 in the timeline. Keep the most important visual element centered. Clean and fast-reading — this audience scrolls quickly.",
        "roles": [
            "Timeline-stopping image — punchy, clear, and immediate visual that communicates the core message in under one second of viewing",
        ],
    },
    "youtube": {
        "label": "YouTube (Thumbnail)",
        "count": 1,
        "dimension": "1280 × 720 px (16:9) — standard YouTube thumbnail",
        "notes": "YouTube thumbnails must read clearly at small sizes in the suggestion sidebar. High contrast, one clear subject, expressive face or bold object if appropriate. Avoid busy backgrounds.",
        "roles": [
            "YouTube thumbnail — bold, high-contrast 16:9 image that communicates what the video is about at a glance, designed to drive click-through from the suggestions feed",
        ],
    },
    "blog": {
        "label": "Blog / Website",
        "count": 3,
        "dimension": "Various — see individual image specs below",
        "notes": "Blog and website images serve multiple technical roles. Each has a different dimension requirement and visual function.",
        "roles": [
            "Hero / featured image (1200 × 630 px, 16:9) — used as the blog post header, OG share image on Facebook/LinkedIn/WhatsApp, and homepage card thumbnail. Must read well at both large and small sizes. Leave the center-left area clean for text overlay if needed.",
            "In-content illustration (1200 × 800 px, 3:2) — placed inside the article body to break up text and reinforce a key point or section. More detailed than the hero — can tell a micro-story related to one section of the content.",
            "Pinterest / vertical share image (1000 × 1500 px, 2:3) — optimised for Pinterest and vertical social sharing. Strong top-third visual, clear bottom-third space for title text overlay added later in Canva.",
        ],
    },
    "pinterest": {
        "label": "Pinterest",
        "count": 1,
        "dimension": "1000 × 1500 px (2:3 vertical) — Pinterest's optimal pin size",
        "notes": "Pinterest is a visual search engine. Pins must have strong top-third imagery and clear bottom-third space for text overlay. Bright, clear, and inspirational. Avoid dark or busy backgrounds that reduce pin save rates.",
        "roles": [
            "Pinterest pin — tall vertical image with a compelling visual in the top two-thirds and clean negative space in the bottom third for title/CTA text overlay added in Canva or Adobe",
        ],
    },
}

# ── Brand + platform data loader ───────────────────────────────────────────

async def _load_brand_data(context: str = "social") -> dict:
    """Pull brand identity, persona, AI disclosure, and enabled platforms from DB."""
    data: dict = {
        "brand_name": "",
        "brand_tagline": "",
        "ai_disclosure_text": "AI Generated",
        "voice": "",
        "audience": "",
        "values_text": "",
        "words_to_use": "",
        "words_to_avoid": "",
        "brand_owner_pronouns": _DEFAULT_PRONOUNS,
        "cultural_identity": "",
        "enabled_platforms": [],
    }
    try:
        async with db_connection() as db:
            # Settings
            cur = await db.execute(
                "SELECT key, value FROM settings WHERE key IN ($1, $2, $3)",
                ("brand_name", "brand_tagline", "ai_disclosure_text"),
            )
            for row in await cur.fetchall():
                data[row["key"]] = row["value"] or ""

            # Brand persona
            cur2 = await db.execute(
                """SELECT voice, audience, values_text, words_to_use, words_to_avoid,
                          brand_owner_pronouns, cultural_identity
                   FROM brand_persona WHERE is_active = TRUE ORDER BY id DESC LIMIT 1"""
            )
            persona = await cur2.fetchone()
            if persona:
                for k in ("voice", "audience", "values_text", "words_to_use", "words_to_avoid",
                           "brand_owner_pronouns", "cultural_identity"):
                    data[k] = persona[k] or ""

            # Enabled platforms (skip for blog context — blog always uses its own spec)
            if context == "social":
                cur3 = await db.execute(
                    "SELECT platform FROM social_platform_configs WHERE enabled = TRUE ORDER BY platform"
                )
                data["enabled_platforms"] = [r["platform"] for r in await cur3.fetchall()]

    except Exception as exc:
        logger.warning(f"Could not load brand data for image prompt: {exc}")

    return data


# ── Platform block builder ─────────────────────────────────────────────────

def _build_platforms_block(platforms: list[str], context: str) -> str:
    """Build the per-platform image specification section of the prompt."""

    if context == "blog":
        target_platforms = ["blog"]
    else:
        # Always include instagram_story if instagram is enabled
        target_platforms = []
        for p in platforms:
            target_platforms.append(p)
            if p == "instagram":
                target_platforms.append("instagram_story")

    lines = []
    for p in target_platforms:
        lines.extend(_build_platform_image_block(p))
    return "\n".join(lines)


def _build_platform_image_block(p: str) -> list[str]:
    """Return the lines for a single platform's image specification block."""
    spec = _PLATFORM_SPECS.get(p)
    if not spec:
        return []
    count = spec["count"]
    plural = "images" if count > 1 else "image"
    lines = [
        f"\n{'═' * 60}",
        f"PLATFORM: {spec['label'].upper()} — {count} {plural.upper()}",
        f"Primary format: {spec['dimension']}",
        f"Platform notes: {spec['notes']}",
        f"{'═' * 60}\n",
    ]
    for i, role in enumerate(spec["roles"], 1):
        role_title = role.split(' — ')[0].strip()
        role_desc = role.split(' — ', 1)[1] if ' — ' in role else role
        lines += [
            f"### Image {i} of {count}: {role_title}",
            f"**Visual role:** {role_desc}",
            "",
            "**Image-generation prompt:**",
            "[Write the detailed prompt here — follow all requirements below]",
            "",
            "**Overlay copy suggestion** (added later in Canva/Adobe, under 8 words):",
            "[Short headline or CTA]",
            "",
            "**Filename suggestion** (lowercase, hyphens):",
            f"[brand-topic-{p}-0{i}.jpg]",
            "",
        ]
    return lines


def _count_total_images(platforms: list[str], context: str) -> int:
    """Return the total number of images that will be generated for this context."""
    if context == "blog":
        return _PLATFORM_SPECS["blog"]["count"]
    total = 0
    for p in platforms:
        spec = _PLATFORM_SPECS.get(p)
        if spec:
            total += spec["count"]
        if p == "instagram":
            total += _PLATFORM_SPECS["instagram_story"]["count"]
    return total


# ── Master prompt builder ──────────────────────────────────────────────────

def _build_brand_context(brand: dict) -> dict:
    """Resolve all brand display values and computed blocks needed by the master prompt."""
    pronouns   = brand["brand_owner_pronouns"] or _DEFAULT_PRONOUNS
    cultural_id = brand["cultural_identity"] or ""
    pronoun_map = {
        "he/him":    ("man", "male"),
        "she/her":   ("woman", "female"),
        "they/them": ("person", "non-binary individual"),
    }
    gender_noun, gender_adj = pronoun_map.get(pronouns, ("person", "individual"))
    words_to_use   = brand["words_to_use"] or ""
    words_to_avoid = brand["words_to_avoid"] or ""
    tagline        = brand["brand_tagline"] or ""
    words_block    = ""
    if words_to_use:
        words_block += f"\nWords / phrases to USE: {words_to_use}"
    if words_to_avoid:
        words_block += f"\nWords / phrases to NEVER USE: {words_to_avoid}"
    return {
        "brand_name":   brand["brand_name"] or "[Brand Name not set — add in Settings]",
        "tagline":      tagline,
        "tagline_line": f'\nBrand tagline: "{tagline}"' if tagline else "",
        "voice":        brand["voice"] or "[Brand voice not set — add a Brand Persona in Settings]",
        "audience":     brand["audience"] or "[Target audience not set]",
        "values":       brand["values_text"] or "[Brand values not set]",
        "disclosure":   brand["ai_disclosure_text"] or "AI Generated",
        "pronouns":     pronouns,
        "cultural_id":  cultural_id,
        "cultural_line": f"\nCultural / Nation identity of the brand owner: {cultural_id} — use this for authentic representation of the main subject when showing the brand owner." if cultural_id else "",
        "gender_noun":  gender_noun,
        "gender_adj":   gender_adj,
        "words_block":  words_block,
    }


def _build_master_prompt(content: str, topic: str, brand: dict, context: str) -> str:
    """Assemble the full prompt with brand data + platform-specific image specs."""
    ctx = _build_brand_context(brand)
    brand_name    = ctx["brand_name"]
    tagline_line  = ctx["tagline_line"]
    voice         = ctx["voice"]
    audience      = ctx["audience"]
    values        = ctx["values"]
    disclosure    = ctx["disclosure"]
    pronouns      = ctx["pronouns"]
    cultural_id   = ctx["cultural_id"]
    cultural_line = ctx["cultural_line"]
    gender_noun   = ctx["gender_noun"]
    gender_adj    = ctx["gender_adj"]
    words_block   = ctx["words_block"]

    platforms = brand.get("enabled_platforms", [])
    platforms_block = _build_platforms_block(platforms, context)

    context_label = "blog post / website page" if context == "blog" else "social media post / campaign"

    total_images = _count_total_images(platforms, context)

    return f"""You are a senior brand strategist, creative director, social-media visual strategist, and expert AI image-prompt engineer.

Your job is to write {total_images} ready-to-paste image-generation prompts for a {context_label}.
Each prompt is tailored to the exact platform, image count, dimensions, and visual role defined below.
Do not generate images. Write the prompts only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BRAND IDENTITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Brand name: {brand_name}{tagline_line}

Brand personality and voice:
{voice}{words_block}

Brand values:
{values}

Target audience:
{audience}

Brand visual direction:
- Authentic, grounded, Indigenous-led visual storytelling
- Real people, real settings, real community — not stock-photo generic
- Warm but confident colour palette reflecting the brand
- Photorealistic commercial quality unless otherwise noted

Brand owner representation:
- The brand owner is a {gender_noun} ({pronouns}){cultural_line}
- When showing the brand owner or a primary subject, use a {gender_adj} person of {cultural_id or 'Indigenous'} descent
- Authentic, respectful representation only — no stereotypes, no tokenism, no fake cultural symbols
- People shown must reflect the actual target audience and real-world settings
- Community-first imagery at all times

NEGATIVE SPACE INSTRUCTION (critical — read carefully):
- Do NOT add any fades, gradients, blurs, or artificial lightening to create text space
- Instead, compose the scene so that a naturally open area exists in the specified zone
  (e.g. clear sky, clean wall, floor, tabletop, open background) where text can be added later
- The image must look complete and intentional WITHOUT any overlay — the open zone is
  achieved through natural composition, not post-processing effects
- Specify in each prompt: "compose so the [top/bottom] [fraction] contains a naturally
  uncluttered area of [sky / wall / floor / background] suitable for text overlay"

WATERMARK INSTRUCTION (critical — must be clearly visible):
- End every image-generation prompt with this exact line:
  "In the bottom-right corner add a small dark semi-transparent rounded rectangle pill
   containing white text reading: {disclosure}  — the pill must have enough contrast
   to be readable on both light and dark backgrounds."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTENT TO SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Topic: {topic}

Content:
{content}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UNIVERSAL REQUIREMENTS FOR ALL PROMPTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Every image must be specific to this brand, audience, and content — no generic stock photo concepts
- All images must feel like one visual campaign: consistent lighting mood, colour palette, and realism level
- No text, logos, fake brand marks, watermarks, or readable words inside any generated image
- No distorted hands, duplicate limbs, warped faces, or unreadable details
- Keep important subjects away from edges so images can be safely cropped per platform
- Include people only where they genuinely strengthen the message
- Reserve clean negative space as specified per platform for text overlays added later in Canva or Adobe
- Photorealistic, high-end commercial quality as the default
- Every prompt must end with the watermark pill instruction described in Brand Visual Direction above

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CAMPAIGN VISUAL DIRECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before writing any prompts, write 4–5 bullet points explaining:
- The overall visual style and mood for this campaign
- The colour/lighting direction that ties all images together
- The recurring visual motifs, settings, or textures
- How the images connect across platforms as one campaign
- Where consistent text overlay zones are planned

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMAGE PROMPTS — BY PLATFORM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each image below, replace [Write the detailed prompt here — follow all requirements below]
with a complete, ready-to-paste image-generation prompt that includes:
  • Subject and action
  • Setting and environment
  • Audience relevance
  • Brand mood and emotional tone
  • Lighting style and camera/composition direction
  • Colour palette and materials or textures
  • Where negative space is reserved for text overlay
  • Style and quality level
  • What must be avoided
  • The watermark line at the end
{platforms_block}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL QUALITY CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before finishing, confirm:
- Every prompt is platform-specific (correct dimensions, visual role, and format noted)
- No two prompts show the same subject, setting, or composition
- All prompts feel like one recognizable campaign
- Every prompt ends with the dark-pill watermark instruction
- No artificial fades or gradients for text space — natural composition only
- No prompt relies on text inside the image to make sense"""


# ── Public entry points ────────────────────────────────────────────────────

async def generate_image_concepts(content: str, topic: str, context: str = "social") -> str:
    """Run the platform-aware brief through the IMAGE_PROMPT_GEN LLM task.

    context = "social" → uses enabled platforms from DB
    context = "blog"   → uses blog/website image specs instead
    """
    brand = await _load_brand_data(context)
    user_prompt = _build_master_prompt(content, topic, brand, context)

    system = (
        "You are an expert creative director and AI image-prompt engineer. "
        "Follow the platform specifications and brand requirements exactly. "
        "Fill in every [Write the detailed prompt here] placeholder with a complete, "
        "ready-to-paste image-generation prompt. "
        "Output only the completed brief — no extra commentary before or after."
    )

    config = await get_model_config(AITaskType.IMAGE_PROMPT_GEN)
    result = await generate_with_config(user_prompt, system, config)
    return result


async def generate_image_prompt_for_chatgpt(content: str, topic: str, context: str = "social") -> str:
    """Return the raw unfilled template for manual inspection or copy-paste.

    Useful for debugging — shows exactly what gets sent to the LLM.
    """
    brand = await _load_brand_data(context)
    return _build_master_prompt(content, topic, brand, context)
