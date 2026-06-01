"""Canada Post REST API integration for shipping rates.

Uses the Rating API (v1):
  https://www.canadapost-postescanada.ca/cpc/en/support/articles/developer-program

Falls back to flat-rate shipping when credentials are not configured.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from xml.etree import ElementTree as ET

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

# Canada Post API endpoints
CP_RATING_URL = "https://ct.soa-gw.canadapost.ca/rs/ship/price"
CP_RATING_URL_PROD = "https://soa-gw.canadapost.ca/rs/ship/price"

# Namespace for Canada Post XML responses
NS = {"cp": "http://www.canadapost.ca/ws/ship/rate-v4"}

# Service codes we care about (domestic)
PREFERRED_SERVICES = [
    "DOM.EP",   # Expedited Parcel
    "DOM.RP",   # Regular Parcel
    "DOM.PC",   # Priority
    "DOM.XP",   # Xpresspost
]


@dataclass
class ShippingRate:
    service_code: str
    service_name: str
    price_cents: int
    expected_transit_days: int | None = None


def is_configured() -> bool:
    """Check if Canada Post credentials are configured."""
    settings = get_settings()
    return bool(
        settings.canadapost_api_key
        and settings.canadapost_api_secret
        and settings.canadapost_customer_number
        and settings.origin_postal_code
    )


async def get_shipping_rates(
    destination_postal_code: str,
    weight_kg: float | None = None,
    length_cm: float | None = None,
    width_cm: float | None = None,
    height_cm: float | None = None,
) -> list[ShippingRate]:
    """Fetch shipping rates from Canada Post for a domestic shipment.

    Returns a list of ShippingRate sorted by price (cheapest first).
    Returns empty list if Canada Post is not configured or API fails.
    """
    settings = get_settings()

    if not is_configured():
        logger.debug("Canada Post not configured — will use flat-rate fallback")
        return []

    # Use defaults for parcel dimensions if not provided
    weight = weight_kg or settings.default_parcel_weight_kg
    length = length_cm or settings.default_parcel_length_cm
    width = width_cm or settings.default_parcel_width_cm
    height = height_cm or settings.default_parcel_height_cm

    # Normalize postal codes (uppercase, no spaces)
    origin = settings.origin_postal_code.upper().replace(" ", "")
    destination = destination_postal_code.upper().replace(" ", "")

    # Build XML request body
    xml_body = f"""<?xml version="1.0" encoding="UTF-8"?>
<mailing-scenario xmlns="http://www.canadapost.ca/ws/ship/rate-v4">
  <customer-number>{settings.canadapost_customer_number}</customer-number>
  {"<contract-id>" + settings.canadapost_contract_number + "</contract-id>" if settings.canadapost_contract_number else ""}
  <parcel-characteristics>
    <weight>{weight:.3f}</weight>
    <dimensions>
      <length>{length:.1f}</length>
      <width>{width:.1f}</width>
      <height>{height:.1f}</height>
    </dimensions>
  </parcel-characteristics>
  <origin-postal-code>{origin}</origin-postal-code>
  <destination>
    <domestic>
      <postal-code>{destination}</postal-code>
    </domestic>
  </destination>
</mailing-scenario>"""

    # Choose endpoint — use sandbox in dev mode
    url = CP_RATING_URL if settings.dev_mode else CP_RATING_URL_PROD

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                content=xml_body,
                headers={
                    "Content-Type": "application/vnd.cpc.ship.rate-v4+xml",
                    "Accept": "application/vnd.cpc.ship.rate-v4+xml",
                },
                auth=(settings.canadapost_api_key, settings.canadapost_api_secret),
                timeout=10.0,
            )

        if resp.status_code != 200:
            logger.warning(
                "Canada Post API returned %d: %s",
                resp.status_code, resp.text[:500],
            )
            return []

        return _parse_rates_response(resp.text)

    except httpx.TimeoutException:
        logger.warning("Canada Post API timeout")
        return []
    except Exception:
        logger.exception("Canada Post API error")
        return []


def _parse_rates_response(xml_text: str) -> list[ShippingRate]:
    """Parse Canada Post rating response XML into ShippingRate objects."""
    root = ET.fromstring(xml_text)
    rates = []

    for quote in root.findall(".//cp:price-quote", NS):
        service_code_el = quote.find("cp:service-code", NS)
        service_name_el = quote.find("cp:service-name", NS)
        price_el = quote.find(".//cp:price-details/cp:due", NS)
        transit_el = quote.find(".//cp:service-standard/cp:expected-transit-time", NS)

        if service_code_el is None or price_el is None:
            continue

        service_code = service_code_el.text or ""
        service_name = (service_name_el.text if service_name_el is not None else service_code) or service_code
        price_dollars = float(price_el.text or "0")
        price_cents = round(price_dollars * 100)

        transit_days = None
        if transit_el is not None and transit_el.text:
            try:
                transit_days = int(transit_el.text)
            except ValueError:
                pass

        rates.append(ShippingRate(
            service_code=service_code,
            service_name=service_name,
            price_cents=price_cents,
            expected_transit_days=transit_days,
        ))

    # Sort by price, cheapest first
    rates.sort(key=lambda r: r.price_cents)
    return rates


async def get_cheapest_rate(
    destination_postal_code: str,
    weight_kg: float | None = None,
) -> int | None:
    """Get the cheapest Canada Post rate for a destination. Returns cents or None."""
    rates = await get_shipping_rates(destination_postal_code, weight_kg=weight_kg)
    if not rates:
        return None
    return rates[0].price_cents
