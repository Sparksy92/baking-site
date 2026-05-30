"""Shipping rate estimation endpoint.

Called by the storefront when the customer enters their postal code to show
real-time shipping costs. Falls back to flat rate if Canada Post is not configured.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.config import get_settings
from app.services.canadapost_service import get_shipping_rates, is_configured

logger = logging.getLogger(__name__)

router = APIRouter(tags=["shipping"])


class ShippingOption(BaseModel):
    service_code: str
    service_name: str
    price_cents: int
    expected_transit_days: int | None = None


class ShippingRatesResponse(BaseModel):
    rates: list[ShippingOption]
    source: str  # "canadapost" or "flat_rate"


@router.get("/shipping/rates", response_model=ShippingRatesResponse)
async def estimate_shipping(
    postal_code: str = Query(..., min_length=3, max_length=10, description="Destination postal code"),
    subtotal_cents: int = Query(default=0, ge=0, description="Cart subtotal to check free shipping threshold"),
):
    """Estimate shipping cost for a destination postal code.

    If Canada Post is configured, returns real rates.
    Otherwise, returns flat-rate from store settings.
    If subtotal meets free shipping threshold, returns $0.
    """
    settings = get_settings()

    # Check free shipping threshold
    if subtotal_cents >= settings.shipping_free_threshold_cents:
        return ShippingRatesResponse(
            rates=[ShippingOption(
                service_code="FREE",
                service_name="Free Shipping",
                price_cents=0,
                expected_transit_days=None,
            )],
            source="flat_rate",
        )

    # Try Canada Post
    if is_configured():
        rates = await get_shipping_rates(postal_code)
        if rates:
            return ShippingRatesResponse(
                rates=[ShippingOption(
                    service_code=r.service_code,
                    service_name=r.service_name,
                    price_cents=r.price_cents,
                    expected_transit_days=r.expected_transit_days,
                ) for r in rates],
                source="canadapost",
            )
        # API failed — fall through to flat rate
        logger.warning("Canada Post rates unavailable for %s, using flat rate", postal_code)

    # Flat-rate fallback
    return ShippingRatesResponse(
        rates=[ShippingOption(
            service_code="FLAT",
            service_name=settings.shipping_description,
            price_cents=settings.shipping_flat_rate_cents,
            expected_transit_days=None,
        )],
        source="flat_rate",
    )
