"""AI model router — selects the right model for each task type.

Rather than hardcoding 'gpt-4o' everywhere, each task type declares
its quality/cost profile. The router resolves this to a concrete
(provider, model, temperature, max_tokens) tuple, checking the DB
for admin overrides first, then falling back to baked-in defaults.

Usage:
    config = await get_model_config(AITaskType.BLOG_POST)
    result = await generate_with_config(prompt, system_prompt, config)

Task types and their default model rationale:
    BLOG_POST       → gpt-4o / gemini-1.5-pro    — depth, long context, reasoning
    SOCIAL_CAPTION  → gpt-4o-mini / gemini-flash  — short, punchy, fast, cheap
    SOCIAL_REPLY    → gpt-4o / gemini-1.5-pro    — tone-critical, brand-risk if wrong
    HASHTAG_GEN     → gpt-4o-mini / gemini-flash  — deterministic, cheapest task
    SEO_SYNTHESIS   → gpt-4o-mini / gemini-flash  — structured extraction, low creativity
    PRODUCT_SOCIAL  → gpt-4o-mini / gemini-flash  — short form product captions
    IMAGE_ALT_TEXT  → gpt-4o-mini / gemini-flash  — factual, brief
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum

import httpx

from app.config import get_settings
from app.database import db_connection

logger = logging.getLogger(__name__)


class AITaskType(str, Enum):
    BLOG_POST = "blog_post"
    SOCIAL_CAPTION = "social_caption"
    SOCIAL_REPLY = "social_reply"
    HASHTAG_GEN = "hashtag_gen"
    SEO_SYNTHESIS = "seo_synthesis"
    PRODUCT_SOCIAL = "product_social"
    IMAGE_ALT_TEXT = "image_alt_text"


@dataclass
class ModelConfig:
    provider: str          # 'openai' | 'gemini'
    model: str             # e.g. 'gpt-4o-mini'
    temperature: float
    max_tokens: int
    task_type: str


# ── Baked-in defaults (used if DB row missing or DB unavailable) ──────────────
# Format: task_type → (openai_model, gemini_model, temperature, max_tokens)

_DEFAULTS: dict[str, tuple[str, str, float, int]] = {
    AITaskType.BLOG_POST:      ("gpt-4o",      "gemini-1.5-pro",   0.7, 2000),
    AITaskType.SOCIAL_CAPTION: ("gpt-4o-mini", "gemini-1.5-flash", 0.8, 400),
    AITaskType.SOCIAL_REPLY:   ("gpt-4o",      "gemini-1.5-pro",   0.6, 200),
    AITaskType.HASHTAG_GEN:    ("gpt-4o-mini", "gemini-1.5-flash", 0.5, 100),
    AITaskType.SEO_SYNTHESIS:  ("gpt-4o-mini", "gemini-1.5-flash", 0.3, 600),
    AITaskType.PRODUCT_SOCIAL: ("gpt-4o-mini", "gemini-1.5-flash", 0.8, 400),
    AITaskType.IMAGE_ALT_TEXT: ("gpt-4o-mini", "gemini-1.5-flash", 0.2, 80),
}


async def get_model_config(task_type: AITaskType) -> ModelConfig:
    """Resolve (provider, model, temperature, max_tokens) for a given task.

    Priority:
      1. DB override in ai_model_configs (admin-configurable)
      2. Baked-in defaults from _DEFAULTS above
      3. Cheapest capable model as last resort
    """
    settings = get_settings()
    has_openai = bool(settings.openai_api_key)
    has_gemini = bool(settings.gemini_api_key)

    if not has_openai and not has_gemini:
        raise ValueError("No AI provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY.")

    db_row = await _load_db_config(task_type)

    # Resolve provider
    if db_row and db_row.get("provider") not in ("auto", ""):
        preferred_provider = db_row["provider"]
    else:
        preferred_provider = "openai" if has_openai else "gemini"

    # Validate provider is available, fall back if not
    if preferred_provider == "openai" and not has_openai:
        preferred_provider = "gemini"
    elif preferred_provider == "gemini" and not has_gemini:
        preferred_provider = "openai"

    defaults = _DEFAULTS.get(task_type, ("gpt-4o-mini", "gemini-1.5-flash", 0.7, 500))
    default_openai_model, default_gemini_model, default_temp, default_tokens = defaults

    if preferred_provider == "openai":
        model = (db_row.get("model") or "").strip() if db_row else ""
        model = model or default_openai_model
    else:
        model = (db_row.get("model") or "").strip() if db_row else ""
        model = model or default_gemini_model

    temperature = float(db_row["temperature"]) if db_row and db_row.get("temperature") is not None else default_temp
    max_tokens = int(db_row["max_tokens"]) if db_row and db_row.get("max_tokens") is not None else default_tokens

    config = ModelConfig(
        provider=preferred_provider,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        task_type=task_type,
    )
    logger.debug(f"AI task={task_type} → provider={preferred_provider} model={model} temp={temperature} max_tokens={max_tokens}")
    return config


async def generate_with_config(
    prompt: str,
    system_prompt: str,
    config: ModelConfig,
) -> str:
    """Execute the AI generation using the resolved ModelConfig.

    Routes to the correct provider/model combination.
    """
    settings = get_settings()
    if config.provider == "openai":
        return await _call_openai(prompt, system_prompt, config, settings.openai_api_key)
    else:
        return await _call_gemini(prompt, system_prompt, config, settings.gemini_api_key)


async def ai_generate(prompt: str, max_tokens: int = 1000, temperature: float = 0.7) -> str:
    """Simple one-shot AI generation convenience wrapper."""
    config = await get_model_config(AITaskType.CONTENT_GENERATION)
    config = ModelConfig(
        provider=config.provider,
        model=config.model,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return await generate_with_config(prompt, "", config)


# ── Provider implementations ─────────────────────────────────────────────────

async def _call_openai(prompt: str, system_prompt: str, config: ModelConfig, api_key: str) -> str:
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": config.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=60.0,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()


async def _call_gemini(prompt: str, system_prompt: str, config: ModelConfig, api_key: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{config.model}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": f"{system_prompt}\n\nUser Prompt: {prompt}"}]}],
        "generationConfig": {
            "temperature": config.temperature,
            "maxOutputTokens": config.max_tokens,
        },
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=60.0,
        )
        resp.raise_for_status()
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()


# ── DB helpers ────────────────────────────────────────────────────────────────

async def _load_db_config(task_type: AITaskType) -> dict | None:
    """Load admin override from ai_model_configs. Returns None on any failure."""
    try:
        async with db_connection() as db:
            cursor = await db.execute(
                "SELECT * FROM ai_model_configs WHERE task_type = ? AND enabled = TRUE",
                (task_type.value,),
            )
            row = await cursor.fetchone()
            return dict(row) if row else None
    except Exception as e:
        logger.debug(f"Could not load AI model config from DB (table may not exist yet): {e}")
        return None
