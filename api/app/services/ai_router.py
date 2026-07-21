"""AI model router — selects the right model for each task type.

Rather than hardcoding 'gpt-4o' everywhere, each task type declares
its quality/cost profile. The router resolves this to a concrete
(provider, model, temperature, max_tokens) tuple, checking the DB
for admin overrides first, then falling back to baked-in defaults.

Usage:
    config = await get_model_config(AITaskType.BLOG_POST)
    result = await generate_with_config(prompt, system_prompt, config)

Supported providers:
    openrouter  — single key for ALL models (GPT-4o, Claude, Gemini, Llama…)
                  set OPENROUTER_API_KEY — recommended, most flexible
    openai      — direct OpenAI API — set OPENAI_API_KEY
    anthropic   — direct Anthropic API (Claude) — set ANTHROPIC_API_KEY
    gemini      — direct Google Gemini API — set GEMINI_API_KEY

Provider auto-selection priority (when set to "auto"):
    openrouter > openai > anthropic > gemini

Task types and their default model rationale:
    BLOG_POST       → gpt-4o / claude-3-5-sonnet  — depth, long context, reasoning
    SOCIAL_CAPTION  → gpt-4o-mini / gemini-flash   — short, punchy, fast, cheap
    SOCIAL_REPLY    → gpt-4o / claude-3-5-sonnet   — tone-critical, brand-risk if wrong
    HASHTAG_GEN     → gpt-4o-mini / gemini-flash   — deterministic, cheapest task
    SEO_SYNTHESIS   → gpt-4o-mini / gemini-flash   — structured extraction, low creativity
    PRODUCT_SOCIAL  → gpt-4o-mini / gemini-flash   — short form product captions
    IMAGE_ALT_TEXT  → gpt-4o-mini / gemini-flash   — factual, brief
    IMAGE_VISION    → gpt-4o (openai direct only)  — multimodal: reads image bytes,
                       returns SEO filename slug + descriptive alt text in one call
"""
from __future__ import annotations

import asyncio
import base64
import logging
from dataclasses import dataclass
from enum import Enum

import httpx

from app.config import get_settings
from app.database import db_connection

logger = logging.getLogger(__name__)

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
OPENAI_BASE = "https://api.openai.com/v1"
ANTHROPIC_BASE = "https://api.anthropic.com/v1"
ANTHROPIC_VERSION = "2023-06-01"

_M_OR_GPT4O = "openai/gpt-4o"
_M_OR_GPT4O_MINI = "openai/gpt-4o-mini"
_M_OAI_GPT4O = "gpt-4o"
_M_OAI_GPT4O_MINI = "gpt-4o-mini"
_M_CLAUDE_SONNET = "claude-3-5-sonnet-20241022"
_M_CLAUDE_HAIKU = "claude-3-haiku-20240307"
_M_GEMINI_PRO = "gemini-1.5-pro"
_M_GEMINI_FLASH = "gemini-1.5-flash"
_CONTENT_TYPE_JSON = "application/json"
_FALLBACK_REFERER = "https://localhost"


class AITaskType(str, Enum):
    BLOG_POST = "blog_post"
    SOCIAL_CAPTION = "social_caption"
    SOCIAL_REPLY = "social_reply"
    HASHTAG_GEN = "hashtag_gen"
    SEO_SYNTHESIS = "seo_synthesis"
    PRODUCT_SOCIAL = "product_social"
    IMAGE_ALT_TEXT = "image_alt_text"
    IMAGE_VISION = "image_vision"
    MODERATION = "moderation"
    IMAGE_PROMPT_GEN = "image_prompt_gen"


@dataclass
class ModelConfig:
    provider: str   # 'openrouter' | 'openai' | 'anthropic' | 'gemini'
    model: str      # e.g. 'gpt-4o-mini', 'claude-3-5-sonnet-20241022', 'openai/gpt-4o'
    temperature: float
    max_tokens: int
    task_type: str


# ── Baked-in defaults per provider ───────────────────────────────────────────
# Format: task_type → (openrouter_model, openai_model, anthropic_model, gemini_model, temperature, max_tokens)

_DEFAULTS: dict[str, tuple[str, str, str, str, float, int]] = {
    AITaskType.BLOG_POST:        (_M_OR_GPT4O_MINI, _M_OAI_GPT4O_MINI, _M_CLAUDE_SONNET, _M_GEMINI_PRO,   0.7, 2000),
    AITaskType.SOCIAL_CAPTION:  (_M_OR_GPT4O_MINI, _M_OAI_GPT4O_MINI, _M_CLAUDE_HAIKU,  _M_GEMINI_FLASH, 0.8,  400),
    AITaskType.SOCIAL_REPLY:    (_M_OR_GPT4O_MINI, _M_OAI_GPT4O,      _M_CLAUDE_SONNET, _M_GEMINI_PRO,   0.6,  200),
    AITaskType.HASHTAG_GEN:     (_M_OR_GPT4O_MINI, _M_OAI_GPT4O_MINI, _M_CLAUDE_HAIKU,  _M_GEMINI_FLASH, 0.5,  100),
    AITaskType.SEO_SYNTHESIS:   (_M_OR_GPT4O_MINI, _M_OAI_GPT4O_MINI, _M_CLAUDE_HAIKU,  _M_GEMINI_FLASH, 0.3,  600),
    AITaskType.PRODUCT_SOCIAL:  (_M_OR_GPT4O_MINI, _M_OAI_GPT4O_MINI, _M_CLAUDE_HAIKU,  _M_GEMINI_FLASH, 0.8,  400),
    AITaskType.IMAGE_ALT_TEXT:  (_M_OR_GPT4O_MINI, _M_OAI_GPT4O_MINI, _M_CLAUDE_HAIKU,  _M_GEMINI_FLASH, 0.2,   80),
    AITaskType.IMAGE_VISION:    (_M_OR_GPT4O,      _M_OAI_GPT4O,      _M_CLAUDE_SONNET, _M_GEMINI_PRO,   0.2,  150),
    AITaskType.MODERATION:      (_M_OR_GPT4O_MINI, _M_OAI_GPT4O_MINI, _M_CLAUDE_HAIKU,  _M_GEMINI_FLASH, 0.1,  600),
    AITaskType.IMAGE_PROMPT_GEN:(_M_OR_GPT4O_MINI, _M_OAI_GPT4O_MINI, _M_CLAUDE_SONNET, _M_GEMINI_PRO,   0.8, 4000),
}

# Human-readable labels for the admin UI
PROVIDER_LABELS = {
    "openrouter": "OpenRouter (all models)",
    "openai": "OpenAI (direct)",
    "anthropic": "Anthropic / Claude (direct)",
    "gemini": "Google Gemini (direct)",
}

TASK_LABELS = {
    AITaskType.BLOG_POST:      "Blog Post Writing",
    AITaskType.SOCIAL_CAPTION: "Social Media Captions",
    AITaskType.SOCIAL_REPLY:   "Comment Replies",
    AITaskType.HASHTAG_GEN:    "Hashtag Generation",
    AITaskType.SEO_SYNTHESIS:  "SEO / Trend Analysis",
    AITaskType.PRODUCT_SOCIAL: "Product Social Posts",
    AITaskType.IMAGE_ALT_TEXT: "Image Alt Text",
    AITaskType.IMAGE_VISION:   "Image Vision (filename + alt text)",
    AITaskType.MODERATION:      "Content Moderation / Compliance",
    AITaskType.IMAGE_PROMPT_GEN: "Image Prompt Generation (7-concept campaign)",
}


def _available_providers(settings) -> list[str]:
    """Return providers that have API keys configured, in priority order."""
    providers = []
    if settings.openrouter_api_key:
        providers.append("openrouter")
    if settings.openai_api_key:
        providers.append("openai")
    if settings.anthropic_api_key:
        providers.append("anthropic")
    if settings.gemini_api_key:
        providers.append("gemini")
    return providers


async def get_model_config(task_type: AITaskType) -> ModelConfig:
    """Resolve (provider, model, temperature, max_tokens) for a given task.

    Priority:
      1. DB override in ai_model_configs (admin-configurable via UI)
      2. Baked-in defaults from _DEFAULTS above
      3. Any available provider as last resort
    """
    settings = get_settings()
    available = _available_providers(settings)

    if not available:
        raise ValueError(
            "No AI provider configured. Add at least one key: "
            "OPENROUTER_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY."
        )

    db_row = await _load_db_config(task_type)

    # Resolve provider — DB override wins, then auto-select by priority
    if db_row and db_row.get("provider") not in (None, "auto", ""):
        preferred = db_row["provider"]
        if preferred not in available:
            logger.warning(f"DB-configured provider '{preferred}' has no API key — falling back to auto")
            preferred = available[0]
    else:
        preferred = available[0]

    defaults = _DEFAULTS.get(task_type, (_M_OR_GPT4O_MINI, _M_OAI_GPT4O_MINI, _M_CLAUDE_HAIKU, _M_GEMINI_FLASH, 0.7, 500))
    or_model, oa_model, an_model, ge_model, default_temp, default_tokens = defaults

    default_model_map = {
        "openrouter": or_model,
        "openai": oa_model,
        "anthropic": an_model,
        "gemini": ge_model,
    }

    db_model = (db_row.get("model") or "").strip() if db_row else ""
    model = db_model or default_model_map.get(preferred, oa_model)

    temperature = float(db_row["temperature"]) if db_row and db_row.get("temperature") is not None else default_temp
    max_tokens = int(db_row["max_tokens"]) if db_row and db_row.get("max_tokens") is not None else default_tokens

    config = ModelConfig(
        provider=preferred,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        task_type=task_type,
    )
    logger.debug(f"AI task={task_type} → provider={preferred} model={model} temp={temperature} max_tokens={max_tokens}")
    return config


async def generate_with_config(
    prompt: str,
    system_prompt: str,
    config: ModelConfig,
) -> str:
    """Execute the AI generation using the resolved ModelConfig."""
    settings = get_settings()
    if config.provider == "openrouter":
        return await _call_openai_compat(prompt, system_prompt, config, settings.openrouter_api_key, OPENROUTER_BASE)
    elif config.provider == "openai":
        return await _call_openai_compat(prompt, system_prompt, config, settings.openai_api_key, OPENAI_BASE)
    elif config.provider == "anthropic":
        return await _call_anthropic(prompt, system_prompt, config, settings.anthropic_api_key)
    elif config.provider == "gemini":
        return await _call_gemini(prompt, system_prompt, config, settings.gemini_api_key)
    else:
        raise ValueError(f"Unknown provider: {config.provider}")


# ── Provider implementations ─────────────────────────────────────────────────

async def _call_openai_compat(
    prompt: str,
    system_prompt: str,
    config: ModelConfig,
    api_key: str,
    base_url: str,
) -> str:
    """OpenAI-compatible API call — works for both OpenAI direct and OpenRouter."""
    payload = {
        "model": config.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": _CONTENT_TYPE_JSON,
    }
    if base_url == OPENROUTER_BASE:
        headers["HTTP-Referer"] = get_settings().store_domain or _FALLBACK_REFERER
        headers["X-Title"] = f"{get_settings().brand_name} Admin"

    # Scale timeout with token budget: base 30s + 0.04s per output token (generous)
    timeout = max(120.0, 30.0 + config.max_tokens * 0.04)

    async with httpx.AsyncClient() as client:
        for attempt in range(3):
            resp = await client.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=timeout,
            )
            if resp.status_code == 429 and attempt < 2:
                retry_after = int(resp.headers.get("retry-after", 10))
                logger.warning("OpenRouter 429 — retrying in %ds (attempt %d/3)", retry_after, attempt + 1)
                await asyncio.sleep(retry_after)
                continue
            if not resp.is_success:
                logger.error(
                    "AI provider error: status=%s model=%s body=%s",
                    resp.status_code, config.model, resp.text[:500],
                )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"].get("content") or ""
            if not content.strip():
                raise ValueError(f"AI model '{config.model}' returned empty content")
            return content.strip()
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"].get("content") or ""
        if not content.strip():
            raise ValueError(f"AI model '{config.model}' returned empty content")
        return content.strip()


async def call_openai_vision(
    image_bytes: bytes,
    mime_type: str,
    prompt: str,
    api_key: str,
    max_tokens: int = 150,
    use_openrouter: bool = False,
) -> str:
    """Send an image to gpt-4o vision via OpenAI direct API or OpenRouter.

    Returns the model's text response (filename slug + alt text JSON).
    This uses a separate code path from generate_with_config because vision
    requires a multimodal message payload (base64 image, not text-only).
    """
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    model = _M_OR_GPT4O if use_openrouter else _M_OAI_GPT4O
    base_url = OPENROUTER_BASE if use_openrouter else OPENAI_BASE
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime_type};base64,{b64}", "detail": "low"},
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
        "max_tokens": max_tokens,
        "temperature": 0.2,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": _CONTENT_TYPE_JSON,
    }
    if use_openrouter:
        settings = get_settings()
        headers["HTTP-Referer"] = settings.store_domain or _FALLBACK_REFERER
        headers["X-Title"] = f"{settings.brand_name} Admin"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
            timeout=30.0,
        )
        if not resp.is_success:
            logger.error("Vision API error: status=%s model=%s body=%s", resp.status_code, model, resp.text[:300])
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()


async def call_openai_vision_multi(
    image_urls: list[str],
    prompt: str,
    api_key: str,
    max_tokens: int = 800,
    use_openrouter: bool = False,
) -> str:
    """Send up to 3 public image URLs to GPT-4o Vision in a single call.

    Accepts already-uploaded public URLs (e.g. /media/filename.jpg).
    Returns the model's text response — caller controls what JSON shape to request
    via the prompt argument.
    """
    model = _M_OR_GPT4O if use_openrouter else _M_OAI_GPT4O
    base_url = OPENROUTER_BASE if use_openrouter else OPENAI_BASE

    content_parts: list[dict] = []
    for idx, url in enumerate(image_urls[:3], start=1):
        content_parts.append({
            "type": "text",
            "text": f"Image {idx}:",
        })
        content_parts.append({
            "type": "image_url",
            "image_url": {"url": url, "detail": "high"},
        })
    content_parts.append({"type": "text", "text": prompt})

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": content_parts}],
        "max_tokens": max_tokens,
        "temperature": 0.3,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": _CONTENT_TYPE_JSON,
    }
    if use_openrouter:
        settings = get_settings()
        headers["HTTP-Referer"] = settings.store_domain or _FALLBACK_REFERER
        headers["X-Title"] = f"{settings.brand_name} Admin"

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
            timeout=60.0,
        )
        if not resp.is_success:
            logger.error("Vision multi error: status=%s model=%s body=%s",
                         resp.status_code, model, resp.text[:300])
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()


async def _call_anthropic(prompt: str, system_prompt: str, config: ModelConfig, api_key: str) -> str:
    """Anthropic Messages API."""
    payload = {
        "model": config.model,
        "max_tokens": config.max_tokens,
        "system": system_prompt,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": config.temperature,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{ANTHROPIC_BASE}/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": ANTHROPIC_VERSION,
                "Content-Type": _CONTENT_TYPE_JSON,
            },
            json=payload,
            timeout=60.0,
        )
        resp.raise_for_status()
        return resp.json()["content"][0]["text"].strip()


async def _call_gemini(prompt: str, system_prompt: str, config: ModelConfig, api_key: str) -> str:
    """Google Gemini generateContent API."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{config.model}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": f"{system_prompt}\n\nUser Prompt: {prompt}"}]}],
        "generationConfig": {
            "temperature": config.temperature,
            "maxOutputTokens": config.max_tokens,
        },
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers={"Content-Type": _CONTENT_TYPE_JSON}, json=payload, timeout=60.0)
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
        logger.debug(f"Could not load AI model config from DB: {e}")
        return None


async def ai_generate(
    prompt: str,
    system_prompt: str = "You are a helpful assistant.",
    max_tokens: int = 500,
    temperature: float = 0.7,
    task_type: AITaskType = AITaskType.SOCIAL_CAPTION,
) -> str:
    """Compatibility shim — wraps get_model_config + generate_with_config.

    Preserves the old ai_generate(prompt, max_tokens=..., temperature=...) call
    signature used by platform_variation_service and other pre-refactor callers.
    """
    config = await get_model_config(task_type)
    config.max_tokens = max_tokens
    config.temperature = temperature
    return await generate_with_config(prompt, system_prompt, config)


async def list_all_configs() -> list[dict]:
    """Return current effective config for every task type — used by admin UI."""
    settings = get_settings()
    available = _available_providers(settings)
    result = []
    for task_type in AITaskType:
        try:
            config = await get_model_config(task_type)
            db_row = await _load_db_config(task_type)
            result.append({
                "task_type": task_type.value,
                "task_label": TASK_LABELS.get(task_type, task_type.value),
                "provider": config.provider,
                "model": config.model,
                "temperature": config.temperature,
                "max_tokens": config.max_tokens,
                "is_db_override": db_row is not None,
                "enabled": True,
            })
        except Exception as e:
            result.append({
                "task_type": task_type.value,
                "task_label": TASK_LABELS.get(task_type, task_type.value),
                "provider": "unconfigured",
                "model": "",
                "temperature": 0.7,
                "max_tokens": 500,
                "is_db_override": False,
                "enabled": False,
                "error": str(e),
            })
    return result
