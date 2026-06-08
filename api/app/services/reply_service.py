"""AI reply generation service.

Generates on-brand reply drafts to social media comments/messages.
Uses the best available model (SOCIAL_REPLY task type) and brand persona.

Admin reviews the draft in the outbox UI, then approves to send.
The actual reply publishing to Meta goes through the platform API.

Workflow:
  1. Webhook receives comment → social_engagement_events row created
  2. Admin sees it in "Engagement" tab of social admin
  3. Click "Generate reply" → AI drafts response using persona
  4. Admin edits if needed, clicks "Send reply" → API call to platform
"""
from __future__ import annotations

import logging

from app.services.ai_router import AITaskType, get_model_config, generate_with_config
from app.database import db_connection

logger = logging.getLogger(__name__)


async def generate_reply_draft(
    original_comment: str,
    commenter_name: str,
    platform: str,
    post_context: str | None = None,
) -> str:
    """Generate a reply draft to a social media comment.

    Uses brand persona + SOCIAL_REPLY task type (best model for tone-critical replies).

    Args:
        original_comment: The comment text we're replying to
        commenter_name: Display name of the commenter (for personalization)
        platform: 'facebook' | 'instagram' | 'linkedin' — affects tone
        post_context: Optional original post content for context

    Returns:
        Reply draft text ready for admin review
    """
    persona = await _get_active_persona()

    system_prompt = _build_reply_system_prompt(persona, platform)

    user_prompt = f"""Original comment from {commenter_name}:
\"{original_comment}\"
"""
    if post_context:
        user_prompt += f"\nContext (our original post): {post_context[:500]}"

    user_prompt += "\n\nDraft a warm, on-brand reply. Keep it under 2 sentences if possible."

    config = await get_model_config(AITaskType.SOCIAL_REPLY)
    reply = await generate_with_config(user_prompt, system_prompt, config)
    return reply


async def store_reply_draft(
    engagement_event_id: int,
    reply_draft: str,
    generated_by: str = "ai",
) -> None:
    """Store the AI-generated reply draft against the engagement event."""
    async with db_connection() as db:
        await db.execute(
            """UPDATE social_engagement_events
               SET reply_content = ?, replied_at = NULL
               WHERE id = ?""",
            (reply_draft, engagement_event_id),
        )
        await db.commit()


async def mark_reply_sent(engagement_event_id: int, sent_content: str) -> None:
    """Mark a reply as sent (after platform API call succeeds)."""
    from datetime import datetime, timezone
    async with db_connection() as db:
        await db.execute(
            """UPDATE social_engagement_events
               SET replied_at = ?, reply_content = ?
               WHERE id = ?""",
            (datetime.now(timezone.utc).isoformat(), sent_content, engagement_event_id),
        )
        await db.commit()


async def _get_active_persona() -> dict:
    """Fetch active brand persona for reply tone."""
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


def _build_reply_system_prompt(persona: dict, platform: str) -> str:
    """Build system prompt for reply generation."""
    persona_block = ""
    if persona.get("voice"):
        persona_block += f"\nBrand voice: {persona['voice']}"
    if persona.get("values_text"):
        persona_block += f"\nBrand values: {persona['values_text']}"
    if persona.get("words_to_use"):
        persona_block += f"\nWords to use: {persona['words_to_use']}"
    if persona.get("words_to_avoid"):
        persona_block += f"\nNever use: {persona['words_to_avoid']}"

    platform_tone = {
        "facebook": "friendly and conversational",
        "instagram": "warm and emoji-friendly",
        "linkedin": "professional and thoughtful",
    }.get(platform, "on-brand")

    return f"""You are the social media voice of our brand.{persona_block}

Platform: {platform.upper()}
Tone for this platform: {platform_tone}

You are replying to a customer's comment. Be genuine, helpful, and brief.
Personalize with their name if provided. Thank them for positive comments.
For questions, give a helpful answer or direct them to DM for details.
For complaints, acknowledge sincerely and offer to make it right.

Rules:
- Keep replies under 280 characters when possible
- Don't use corporate jargon
- Sign with the brand's personality, not your own name
- Never sound defensive
"""
