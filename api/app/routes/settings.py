import re
from fastapi import APIRouter, Depends
from app.database import PostgresConnection

from app.config import get_settings
from app.database import get_db
from app.models.schemas import PublicSettingsResponse

router = APIRouter(tags=["settings"])


def clean_legacy_value(val: str | None) -> str | None:
    if not val:
        return val
    # Replace Cedar & Sage names
    val = re.sub(r'(?i)Cedar\s*&\s*Sage', 'Sage & Sweetgrass Homestead', val)
    val = re.sub(r'(?i)Cedar\s+and\s+Sage', 'Sage & Sweetgrass Homestead', val)
    # Replace emails
    def repl(m):
        match_str = m.group(0).lower()
        if 'payment' in match_str or 'etransfer' in match_str:
            return 'payments@sageandsweetgrass.ca'
        return 'hello@sageandsweetgrass.ca'
    val = re.sub(r'(?i)[a-zA-Z0-9._%+-]+@cedar(?:and)?sage(?:homestead)?\.(?:ca|com)', repl, val)
    return val


@router.get("/settings/public", response_model=PublicSettingsResponse)
async def get_public_settings(db: PostgresConnection = Depends(get_db)):
    settings = get_settings()

    cursor = await db.execute("SELECT key, value FROM settings")
    rows = await cursor.fetchall()
    store_settings = {r["key"]: r["value"] for r in rows}

    return PublicSettingsResponse(
        brand_name=clean_legacy_value(store_settings.get("brand_name", "") or settings.brand_name),
        brand_tagline=clean_legacy_value(store_settings.get("brand_tagline", "") or settings.brand_tagline),
        store_announcement=clean_legacy_value(store_settings.get("store_announcement", "")),
        shipping_flat_rate_cents=int(store_settings.get("shipping_flat_rate_cents", str(settings.shipping_flat_rate_cents))),
        shipping_free_threshold_cents=int(store_settings.get("shipping_free_threshold_cents", str(settings.shipping_free_threshold_cents))),
        tax_rate=float(store_settings.get("tax_rate", str(settings.tax_rate))),
        currency=store_settings.get("currency", settings.store_currency),
        analytics_id=store_settings.get("analytics_id", ""),
        etransfer_email=clean_legacy_value(store_settings.get("etransfer_email", "") or settings.etransfer_email),
        contact_email=clean_legacy_value(store_settings.get("contact_email", "") or settings.contact_email),
        default_og_image=store_settings.get("default_og_image", ""),
        twitter_handle=store_settings.get("twitter_handle", ""),
        google_verification=store_settings.get("google_verification", ""),
        blog_section_name=store_settings.get("blog_section_name", ""),
        brand_abbreviation=store_settings.get("brand_abbreviation", ""),
        store_domain=store_settings.get("store_domain", "") or settings.store_domain,
        about_content=clean_legacy_value(store_settings.get("about_content", "")),
        faq_content=clean_legacy_value(store_settings.get("faq_content", "")),
        pickup_instructions=clean_legacy_value(store_settings.get("pickup_instructions", "")),
        payment_instructions=clean_legacy_value(store_settings.get("payment_instructions", "")),
        allergy_disclaimer=clean_legacy_value(store_settings.get("allergy_disclaimer", "")),
        preorder_instructions=clean_legacy_value(store_settings.get("preorder_instructions", "")),
        oven_fund_goal=store_settings.get("oven_fund_goal", ""),
        oven_fund_current_amount=store_settings.get("oven_fund_current_amount", ""),
        oven_fund_description=clean_legacy_value(store_settings.get("oven_fund_description", "")),
    )
