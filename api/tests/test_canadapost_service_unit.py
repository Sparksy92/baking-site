"""Unit tests for canadapost_service pure functions.
No network calls required."""
import pytest
from unittest.mock import patch, MagicMock


# ── ShippingRate dataclass ────────────────────────────────────────────────────

def test_shipping_rate_fields():
    from app.services.canadapost_service import ShippingRate
    rate = ShippingRate(
        service_code="DOM.EP",
        service_name="Expedited Parcel",
        price_cents=1250,
        expected_transit_days=3,
    )
    assert rate.service_code == "DOM.EP"
    assert rate.price_cents == 1250
    assert rate.expected_transit_days == 3


def test_shipping_rate_transit_days_optional():
    from app.services.canadapost_service import ShippingRate
    rate = ShippingRate(service_code="DOM.RP", service_name="Regular", price_cents=800)
    assert rate.expected_transit_days is None


# ── PREFERRED_SERVICES constant ───────────────────────────────────────────────

def test_preferred_services_contains_core_codes():
    from app.services.canadapost_service import PREFERRED_SERVICES
    assert "DOM.EP" in PREFERRED_SERVICES
    assert "DOM.RP" in PREFERRED_SERVICES
    assert "DOM.PC" in PREFERRED_SERVICES
    assert "DOM.XP" in PREFERRED_SERVICES


# ── is_configured ─────────────────────────────────────────────────────────────

def test_is_configured_true_when_all_set():
    from app.services.canadapost_service import is_configured
    mock_settings = MagicMock()
    mock_settings.canadapost_api_key = "key"
    mock_settings.canadapost_api_secret = "secret"
    mock_settings.canadapost_customer_number = "1234567"
    with patch("app.services.canadapost_service.get_settings", return_value=mock_settings):
        assert is_configured() is True


def test_is_configured_false_when_key_missing():
    from app.services.canadapost_service import is_configured
    mock_settings = MagicMock()
    mock_settings.canadapost_api_key = None
    mock_settings.canadapost_api_secret = "secret"
    mock_settings.canadapost_customer_number = "1234567"
    with patch("app.services.canadapost_service.get_settings", return_value=mock_settings):
        assert is_configured() is False


def test_is_configured_false_when_all_missing():
    from app.services.canadapost_service import is_configured
    mock_settings = MagicMock()
    mock_settings.canadapost_api_key = None
    mock_settings.canadapost_api_secret = None
    mock_settings.canadapost_customer_number = None
    with patch("app.services.canadapost_service.get_settings", return_value=mock_settings):
        assert is_configured() is False


# ── _parse_rates_response ─────────────────────────────────────────────────────

_NS_DECL = 'xmlns:cp="http://www.canadapost.ca/ws/ship/rate-v4"'

def _make_xml(quotes: list[dict]) -> str:
    """Build a minimal Canada Post rating XML response."""
    quote_xml = ""
    for q in quotes:
        transit = f"<cp:expected-transit-time>{q['transit']}</cp:expected-transit-time>" if q.get("transit") else ""
        quote_xml += f"""
        <cp:price-quote {_NS_DECL}>
            <cp:service-code>{q['code']}</cp:service-code>
            <cp:service-name>{q['name']}</cp:service-name>
            <cp:price-details>
                <cp:due>{q['price']}</cp:due>
            </cp:price-details>
            <cp:service-standard>{transit}</cp:service-standard>
        </cp:price-quote>
        """
    return f'<cp:price-quotes {_NS_DECL}>{quote_xml}</cp:price-quotes>'


def test_parse_rates_basic():
    from app.services.canadapost_service import _parse_rates_response
    xml = _make_xml([{"code": "DOM.EP", "name": "Expedited Parcel", "price": "12.50", "transit": "3"}])
    rates = _parse_rates_response(xml)
    assert len(rates) == 1
    assert rates[0].service_code == "DOM.EP"
    assert rates[0].price_cents == 1250
    assert rates[0].expected_transit_days == 3


def test_parse_rates_sorted_by_price():
    from app.services.canadapost_service import _parse_rates_response
    xml = _make_xml([
        {"code": "DOM.PC", "name": "Priority", "price": "25.00", "transit": "1"},
        {"code": "DOM.RP", "name": "Regular", "price": "8.00", "transit": "10"},
        {"code": "DOM.EP", "name": "Expedited", "price": "12.50", "transit": "3"},
    ])
    rates = _parse_rates_response(xml)
    prices = [r.price_cents for r in rates]
    assert prices == sorted(prices)  # cheapest first


def test_parse_rates_no_transit_days():
    from app.services.canadapost_service import _parse_rates_response
    xml = _make_xml([{"code": "DOM.RP", "name": "Regular", "price": "8.00"}])
    rates = _parse_rates_response(xml)
    assert rates[0].expected_transit_days is None


def test_parse_rates_empty_response():
    from app.services.canadapost_service import _parse_rates_response
    xml = f'<cp:price-quotes {_NS_DECL}></cp:price-quotes>'
    rates = _parse_rates_response(xml)
    assert rates == []


def test_parse_rates_price_converts_to_cents():
    from app.services.canadapost_service import _parse_rates_response
    xml = _make_xml([{"code": "DOM.XP", "name": "Xpresspost", "price": "19.99", "transit": "2"}])
    rates = _parse_rates_response(xml)
    assert rates[0].price_cents == 1999


def test_parse_rates_multiple_quotes():
    from app.services.canadapost_service import _parse_rates_response
    xml = _make_xml([
        {"code": "DOM.EP", "name": "Expedited", "price": "12.00", "transit": "3"},
        {"code": "DOM.XP", "name": "Xpresspost", "price": "22.00", "transit": "2"},
    ])
    rates = _parse_rates_response(xml)
    assert len(rates) == 2
