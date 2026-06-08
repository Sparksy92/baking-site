"""Platform Variation service - Per-platform content adaptation.

Automatically adapts content for each platform's requirements:
- Instagram: Hashtags in comments, max 30 hashtags
- X/Twitter: 280 chars, no hashtags in main text ideally
- LinkedIn: Professional tone, longer form OK
- TikTok: Casual, trend-aware
- Facebook: Community focused, link previews
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.database import db_connection
from app.services.ai_router import ai_generate

logger = logging.getLogger(__name__)


# Platform constraints
PLATFORM_LIMITS = {
    "instagram": {
        "max_chars": 2200,
        "max_hashtags": 30,
        "hashtag_placement": "caption",  # or "first_comment"
        "supports_links": False,
        "tone": "visual, inspiring, community-focused"
    },
    "twitter": {
        "max_chars": 280,
        "max_hashtags": 3,
        "hashtag_placement": "inline",
        "supports_links": True,
        "tone": "concise, witty, timely"
    },
    "facebook": {
        "max_chars": 63206,
        "max_hashtags": 10,
        "hashtag_placement": "inline",
        "supports_links": True,
        "tone": "community, storytelling, warm"
    },
    "linkedin": {
        "max_chars": 3000,
        "max_hashtags": 5,
        "hashtag_placement": "inline",
        "supports_links": True,
        "tone": "professional, insightful, educational"
    },
    "tiktok": {
        "max_chars": 2200,
        "max_hashtags": 10,
        "hashtag_placement": "caption",
        "supports_links": False,
        "tone": "casual, trendy, authentic"
    },
    "youtube": {
        "max_chars": 5000,
        "max_hashtags": 15,
        "hashtag_placement": "description",
        "supports_links": True,
        "tone": "informative, helpful, SEO-optimized"
    }
}


def extract_hashtags(content: str) -> list[str]:
    """Extract hashtags from content."""
    return re.findall(r'#\w+', content)


def remove_hashtags(content: str) -> str:
    """Remove hashtags from content."""
    return re.sub(r'\s*#\w+', '', content).strip()


def truncate_to_limit(content: str, limit: int, suffix: str = "...") -> str:
    """Truncate content to character limit."""
    if len(content) <= limit:
        return content
    return content[:limit - len(suffix)].rsplit(' ', 1)[0] + suffix


async def adapt_for_instagram(
    base_content: str,
    hashtags: list[str],
    image_url: str | None = None,
) -> dict:
    """Adapt content for Instagram.
    
    Strategy:
    - Keep caption under 125 chars for clean view (or full if needed)
    - Move excess hashtags to first comment
    - Emojis welcome
    """
    limits = PLATFORM_LIMITS["instagram"]
    
    # Clean content
    content_no_tags = remove_hashtags(base_content)
    
    # Limit hashtags
    selected_hashtags = hashtags[:limits["max_hashtags"]]
    hashtag_line = ' '.join(selected_hashtags)
    
    # Build caption
    full_caption = f"{content_no_tags}\n\n{hashtag_line}".strip()
    
    # If too long, truncate and put hashtags in comment
    if len(full_caption) > limits["max_chars"]:
        content_truncated = truncate_to_limit(content_no_tags, limits["max_chars"] - 50)
        caption = content_truncated
        first_comment = hashtag_line
    else:
        caption = full_caption
        first_comment = None
    
    return {
        "content": caption,
        "hashtags": selected_hashtags,
        "first_comment": first_comment,
        "character_count": len(caption),
        "needs_image": True,  # Instagram requires image
    }


async def adapt_for_twitter(
    base_content: str,
    hashtags: list[str],
    link_url: str | None = None,
) -> dict:
    """Adapt content for X/Twitter.
    
    Strategy:
    - Strict 280 char limit
    - 1-2 hashtags max
    - Link takes 23 chars (t.co)
    """
    limits = PLATFORM_LIMITS["twitter"]
    
    content_no_tags = remove_hashtags(base_content)
    
    # Reserve space for link if provided
    link_chars = 23 if link_url else 0  # t.co links are always 23 chars
    available_chars = limits["max_chars"] - link_chars - 20  # Buffer for hashtags
    
    # Truncate content
    content = truncate_to_limit(content_no_tags, available_chars)
    
    # Add 1-2 most relevant hashtags
    selected_hashtags = hashtags[:limits["max_hashtags"]]
    hashtag_line = ' '.join(selected_hashtags)
    
    # Build final
    final_content = content
    if selected_hashtags:
        final_content = f"{content} {hashtag_line}"
    if link_url:
        final_content = f"{final_content} {link_url}"
    
    return {
        "content": final_content,
        "hashtags": selected_hashtags,
        "character_count": len(final_content),
        "within_limit": len(final_content) <= limits["max_chars"],
    }


async def adapt_for_linkedin(
    base_content: str,
    hashtags: list[str],
) -> dict:
    """Adapt content for LinkedIn.
    
    Strategy:
    - Professional tone
    - 3-5 hashtags at end
    - Paragraph breaks for readability
    """
    limits = PLATFORM_LIMITS["linkedin"]
    
    content_no_tags = remove_hashtags(base_content)
    
    # LinkedIn allows longer form, keep most content
    content = content_no_tags[:limits["max_chars"] - 100]
    
    # Select professional hashtags (avoid overly casual ones)
    selected_hashtags = hashtags[:limits["max_hashtags"]]
    hashtag_line = ' '.join(selected_hashtags)
    
    final_content = f"{content}\n\n{hashtag_line}".strip()
    
    return {
        "content": final_content,
        "hashtags": selected_hashtags,
        "character_count": len(final_content),
    }


async def adapt_for_tiktok(
    base_content: str,
    hashtags: list[str],
) -> dict:
    """Adapt content for TikTok.
    
    Strategy:
    - Casual, trend-aware
    - 3-5 hashtags including trending
    - Hooks front-loaded
    """
    limits = PLATFORM_LIMITS["tiktok"]
    
    content_no_tags = remove_hashtags(base_content)
    
    # TikTok is casual - keep it punchy
    content = content_no_tags[:500]  # Shorter than limit for video focus
    
    # Add trending-friendly hashtags
    selected_hashtags = hashtags[:limits["max_hashtags"]]
    # Could add trending detection here
    hashtag_line = ' '.join(selected_hashtags)
    
    final_content = f"{content}\n\n{hashtag_line}".strip()
    
    return {
        "content": final_content,
        "hashtags": selected_hashtags,
        "character_count": len(final_content),
    }


async def generate_platform_variations(
    base_post_id: int,
    base_content: str,
    base_hashtags: list[str],
    image_url: str | None = None,
    platforms: list[str] | None = None,
) -> dict:
    """Generate adapted variations for multiple platforms."""
    platforms = platforms or ["instagram", "twitter", "facebook", "linkedin"]
    
    variations = {}
    
    for platform in platforms:
        try:
            if platform == "instagram":
                adapted = await adapt_for_instagram(base_content, base_hashtags, image_url)
            elif platform in ["twitter", "x"]:
                adapted = await adapt_for_twitter(base_content, base_hashtags)
            elif platform == "linkedin":
                adapted = await adapt_for_linkedin(base_content, base_hashtags)
            elif platform == "tiktok":
                adapted = await adapt_for_tiktok(base_content, base_hashtags)
            elif platform == "facebook":
                # Facebook can handle full content
                adapted = {
                    "content": base_content,
                    "hashtags": base_hashtags[:10],
                    "character_count": len(base_content),
                }
            else:
                continue
            
            # Save to database
            async with db_connection() as db:
                cursor = await db.execute(
                    """INSERT INTO platform_variations
                       (base_post_id, platform, adapted_content, adapted_hashtags,
                        character_count, media_urls, is_primary)
                       VALUES (?, ?, ?, ?, ?, ?, ?)
                       ON CONFLICT(base_post_id, platform)
                       DO UPDATE SET
                         adapted_content = excluded.adapted_content,
                         adapted_hashtags = excluded.adapted_hashtags,
                         character_count = excluded.character_count,
                         updated_at = CURRENT_TIMESTAMP
                       RETURNING id""",
                    (base_post_id, platform, adapted["content"],
                     json.dumps(adapted.get("hashtags", [])),
                     adapted["character_count"],
                     json.dumps([image_url] if image_url else []),
                     platform == "instagram")  # Make Instagram primary by default
                )
                row = await cursor.fetchone()
                await db.commit()
                
            variations[platform] = {
                "variation_id": row["id"],
                **adapted
            }
            
        except Exception as e:
            logger.error(f"Failed to adapt for {platform}: {e}")
            variations[platform] = {"error": str(e)}
    
    return {
        "base_post_id": base_post_id,
        "platforms": variations,
        "generated_count": len([v for v in variations.values() if "error" not in v])
    }


async def get_variation(variation_id: int) -> dict | None:
    """Get a specific platform variation."""
    async with db_connection() as db:
        cursor = await db.execute(
            "SELECT * FROM platform_variations WHERE id = ?",
            (variation_id,)
        )
        row = await cursor.fetchone()
        
    if not row:
        return None
        
    result = dict(row)
    result["adapted_hashtags"] = json.loads(result.get("adapted_hashtags") or "[]")
    result["media_urls"] = json.loads(result.get("media_urls") or "[]")
    return result


async def get_variations_for_post(base_post_id: int) -> list[dict]:
    """Get all platform variations for a base post."""
    async with db_connection() as db:
        cursor = await db.execute(
            """SELECT * FROM platform_variations 
               WHERE base_post_id = ?
               ORDER BY is_primary DESC, platform""",
            (base_post_id,)
        )
        rows = await cursor.fetchall()
        
    results = []
    for row in rows:
        result = dict(row)
        result["adapted_hashtags"] = json.loads(result.get("adapted_hashtags") or "[]")
        result["media_urls"] = json.loads(result.get("media_urls") or "[]")
        results.append(result)
        
    return results


async def approve_variation(variation_id: int) -> dict:
    """Mark a variation as approved for publishing."""
    async with db_connection() as db:
        await db.execute(
            """UPDATE platform_variations
               SET status = 'approved'
               WHERE id = ?""",
            (variation_id,)
        )
        await db.commit()
        
    return {"approved": True, "variation_id": variation_id}


async def ai_rewrite_for_platform(
    content: str,
    platform: str,
    tone_prompt: str | None = None,
) -> str:
    """Use AI to rewrite content for a specific platform's tone."""
    limits = PLATFORM_LIMITS.get(platform, {})
    tone = tone_prompt or limits.get("tone", "neutral")
    max_chars = limits.get("max_chars", 500)
    
    prompt = f"""Rewrite this content for {platform}.
    
Original: {content}

Requirements:
- Tone: {tone}
- Maximum {max_chars} characters
- Platform-appropriate style and formatting
- Keep the core message and call-to-action
- {'Include relevant hashtags' if platform != 'linkedin' else 'Minimal hashtags, professional'}

Provide only the rewritten text, no explanations."""

    try:
        rewritten = await ai_generate(prompt, max_tokens=500, temperature=0.7)
        return rewritten.strip()
    except Exception as e:
        logger.error(f"AI rewrite failed for {platform}: {e}")
        return content  # Fallback to original
