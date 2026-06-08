"""API routes for Platform Variations (per-platform content adaptation)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

from app.auth import require_admin
from app.database import get_db, PostgresConnection
import json

from app.services.platform_variation_service import (
    generate_platform_variations,
    get_variations_for_post,
    get_variation,
    approve_variation,
    ai_rewrite_for_platform,
)

router = APIRouter(prefix="/admin/platform-variations", tags=["platform-variations"])


class VariationGenerate(BaseModel):
    base_post_id: int
    base_content: str
    base_hashtags: List[str]
    image_url: Optional[str] = None
    platforms: List[str] = Field(default=["instagram", "twitter", "facebook", "linkedin"])


class VariationApprove(BaseModel):
    variation_id: int


class AIRewrite(BaseModel):
    content: str
    platform: str
    tone_prompt: Optional[str] = None


@router.post("/generate")
async def generate_variations(
    data: VariationGenerate,
    user: dict = Depends(require_admin),
):
    """Generate platform-specific variations for a post."""
    result = await generate_platform_variations(
        base_post_id=data.base_post_id,
        base_content=data.base_content,
        base_hashtags=data.base_hashtags,
        image_url=data.image_url,
        platforms=data.platforms,
    )
    return result


@router.get("/for-post/{post_id}")
async def get_for_post(
    post_id: int,
    user: dict = Depends(require_admin),
):
    """Get all platform variations for a base post."""
    variations = await get_variations_for_post(post_id)
    return {"variations": variations}


@router.get("/variation/{variation_id}")
async def get_variation_detail(
    variation_id: int,
    user: dict = Depends(require_admin),
):
    """Get a specific variation."""
    variation = await get_variation(variation_id)
    if not variation:
        raise HTTPException(status_code=404, detail="Variation not found")
    return variation


@router.post("/variation/{variation_id}/approve")
async def approve(
    variation_id: int,
    user: dict = Depends(require_admin),
):
    """Approve a variation for publishing."""
    result = await approve_variation(variation_id)
    return result


@router.post("/ai-rewrite")
async def ai_rewrite(
    data: AIRewrite,
    user: dict = Depends(require_admin),
):
    """Use AI to rewrite content for a specific platform."""
    rewritten = await ai_rewrite_for_platform(
        content=data.content,
        platform=data.platform,
        tone_prompt=data.tone_prompt,
    )
    return {
        "original": data.content,
        "rewritten": rewritten,
        "platform": data.platform,
    }


@router.get("/platforms")
async def list_platforms(
    user: dict = Depends(require_admin),
):
    """List supported platforms with their constraints."""
    from app.services.platform_variation_service import PLATFORM_LIMITS
    return {"platforms": PLATFORM_LIMITS}
