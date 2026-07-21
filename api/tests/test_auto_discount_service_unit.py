"""Unit tests for auto_discount_service pure functions.
No DB access required."""
import pytest


def _disc(applies_to="all", applies_to_id=None, discount_type="percentage",
          discount_value=10, buy_quantity=None, get_quantity=None):
    return {
        "applies_to": applies_to,
        "applies_to_id": applies_to_id,
        "discount_type": discount_type,
        "discount_value": discount_value,
        "buy_quantity": buy_quantity,
        "get_quantity": get_quantity,
    }


def _item(product_id=1, category_id=10, collection_ids=None,
          line_total_cents=1000, unit_price_cents=1000, quantity=1):
    return {
        "product_id": product_id,
        "category_id": category_id,
        "collection_ids": collection_ids or [],
        "line_total_cents": line_total_cents,
        "unit_price_cents": unit_price_cents,
        "quantity": quantity,
    }


# ── _get_matching_items ───────────────────────────────────────────────────────

def test_matching_items_all():
    from app.services.auto_discount_service import _get_matching_items
    items = [_item(product_id=1), _item(product_id=2)]
    assert _get_matching_items(_disc("all"), items) == items


def test_matching_items_product_match():
    from app.services.auto_discount_service import _get_matching_items
    items = [_item(product_id=1), _item(product_id=2)]
    result = _get_matching_items(_disc("product", applies_to_id=1), items)
    assert len(result) == 1
    assert result[0]["product_id"] == 1


def test_matching_items_product_no_match():
    from app.services.auto_discount_service import _get_matching_items
    items = [_item(product_id=2), _item(product_id=3)]
    result = _get_matching_items(_disc("product", applies_to_id=99), items)
    assert result == []


def test_matching_items_category():
    from app.services.auto_discount_service import _get_matching_items
    items = [_item(category_id=10), _item(category_id=20)]
    result = _get_matching_items(_disc("category", applies_to_id=10), items)
    assert len(result) == 1
    assert result[0]["category_id"] == 10


def test_matching_items_collection():
    from app.services.auto_discount_service import _get_matching_items
    items = [
        _item(collection_ids=[1, 2]),
        _item(collection_ids=[3]),
    ]
    result = _get_matching_items(_disc("collection", applies_to_id=2), items)
    assert len(result) == 1
    assert 2 in result[0]["collection_ids"]


def test_matching_items_collection_not_in_list():
    from app.services.auto_discount_service import _get_matching_items
    items = [_item(collection_ids=[5, 6])]
    result = _get_matching_items(_disc("collection", applies_to_id=99), items)
    assert result == []


def test_matching_items_unknown_applies_to_returns_empty():
    from app.services.auto_discount_service import _get_matching_items
    items = [_item()]
    result = _get_matching_items(_disc("unknown_type"), items)
    assert result == []


def test_matching_items_empty_cart():
    from app.services.auto_discount_service import _get_matching_items
    assert _get_matching_items(_disc("all"), []) == []


# ── _calculate_discount_amount — percentage ───────────────────────────────────

def test_calculate_discount_percentage():
    from app.services.auto_discount_service import _calculate_discount_amount
    items = [_item(line_total_cents=1000)]
    disc = _disc("all", discount_type="percentage", discount_value=10)
    assert _calculate_discount_amount(disc, items, 1000) == 100


def test_calculate_discount_percentage_multiple_items():
    from app.services.auto_discount_service import _calculate_discount_amount
    items = [_item(line_total_cents=500), _item(line_total_cents=500)]
    disc = _disc("all", discount_type="percentage", discount_value=20)
    assert _calculate_discount_amount(disc, items, 1000) == 200


def test_calculate_discount_percentage_rounds_down():
    from app.services.auto_discount_service import _calculate_discount_amount
    items = [_item(line_total_cents=333)]
    disc = _disc("all", discount_type="percentage", discount_value=10)
    result = _calculate_discount_amount(disc, items, 333)
    assert result == 33  # int(333 * 10 / 100) = 33


# ── _calculate_discount_amount — fixed_cents ──────────────────────────────────

def test_calculate_discount_fixed_cents_full():
    from app.services.auto_discount_service import _calculate_discount_amount
    items = [_item(line_total_cents=2000)]
    disc = _disc("all", discount_type="fixed_cents", discount_value=500)
    assert _calculate_discount_amount(disc, items, 2000) == 500


def test_calculate_discount_fixed_cents_capped_at_subtotal():
    from app.services.auto_discount_service import _calculate_discount_amount
    items = [_item(line_total_cents=300)]
    disc = _disc("all", discount_type="fixed_cents", discount_value=500)
    assert _calculate_discount_amount(disc, items, 300) == 300


def test_calculate_discount_fixed_cents_exact():
    from app.services.auto_discount_service import _calculate_discount_amount
    items = [_item(line_total_cents=500)]
    disc = _disc("all", discount_type="fixed_cents", discount_value=500)
    assert _calculate_discount_amount(disc, items, 500) == 500


# ── _calculate_discount_amount — buy_x_get_y ─────────────────────────────────

def test_calculate_discount_buy_2_get_1_free():
    from app.services.auto_discount_service import _calculate_discount_amount
    # Buy 2, get 1 free (100% off cheapest)
    items = [_item(line_total_cents=3000, unit_price_cents=1000, quantity=3)]
    disc = _disc("all", discount_type="buy_x_get_y",
                 discount_value=100, buy_quantity=2, get_quantity=1)
    # 3 items → 1 full set (2+1=3), 1 free item at 1000 cents
    result = _calculate_discount_amount(disc, items, 3000)
    assert result == 1000


def test_calculate_discount_buy_x_get_y_not_enough_qty():
    from app.services.auto_discount_service import _calculate_discount_amount
    # Only 2 items, need 3 (buy 2 get 1)
    items = [_item(line_total_cents=2000, unit_price_cents=1000, quantity=2)]
    disc = _disc("all", discount_type="buy_x_get_y",
                 discount_value=100, buy_quantity=2, get_quantity=1)
    # 2 items, set size=3 → 0 full sets → 0 discount
    result = _calculate_discount_amount(disc, items, 2000)
    assert result == 0


def test_calculate_discount_unknown_type_returns_zero():
    from app.services.auto_discount_service import _calculate_discount_amount
    items = [_item(line_total_cents=1000)]
    disc = _disc("all", discount_type="mystery_type", discount_value=10)
    assert _calculate_discount_amount(disc, items, 1000) == 0


def test_calculate_discount_no_matching_items_returns_zero():
    from app.services.auto_discount_service import _calculate_discount_amount
    disc = _disc("all", discount_type="percentage", discount_value=10)
    assert _calculate_discount_amount(disc, [], 0) == 0
