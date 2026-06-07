from __future__ import annotations

from fastapi import APIRouter, Depends
from app.database import PostgresConnection

from app.config import get_settings
from app.database import get_db
from app.models.schemas import PublicSettingsResponse

router = APIRouter(tags=["settings"])


@router.get("/settings/public", response_model=PublicSettingsResponse)
async def get_public_settings(db: PostgresConnection = Depends(get_db)):
    settings = get_settings()

    cursor = await db.execute("SELECT key, value FROM settings")
    rows = await cursor.fetchall()
    store_settings = {r["key"]: r["value"] for r in rows}

    return PublicSettingsResponse(
        brand_name=store_settings.get("brand_name", "") or settings.brand_name,
        brand_tagline=store_settings.get("brand_tagline", "") or settings.brand_tagline,
        store_announcement=store_settings.get("store_announcement", ""),
        shipping_flat_rate_cents=int(store_settings.get("shipping_flat_rate_cents", str(settings.shipping_flat_rate_cents))),
        shipping_free_threshold_cents=int(store_settings.get("shipping_free_threshold_cents", str(settings.shipping_free_threshold_cents))),
        tax_rate=float(store_settings.get("tax_rate", str(settings.tax_rate))),
        currency=store_settings.get("currency", settings.store_currency),
        analytics_id=store_settings.get("analytics_id", ""),
        etransfer_email=store_settings.get("etransfer_email", "") or settings.etransfer_email,
        default_og_image=store_settings.get("default_og_image", ""),
        twitter_handle=store_settings.get("twitter_handle", ""),
        google_verification=store_settings.get("google_verification", ""),
        blog_section_name=store_settings.get("blog_section_name", ""),
        brand_abbreviation=store_settings.get("brand_abbreviation", ""),
        store_domain=store_settings.get("store_domain", "") or settings.store_domain,
    )
