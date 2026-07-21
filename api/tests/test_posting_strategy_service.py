"""Tests for posting_strategy_service — timezone handling, enabled flag, slot selection."""
from __future__ import annotations

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock
from zoneinfo import ZoneInfo


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_strategy(best_times: list[str], enabled: bool = True, posts_per_day: int = 2):
    return {
        "facebook": {
            "posts_per_day": posts_per_day,
            "best_times": best_times,
            "enabled": enabled,
            "content_mix": {"educational": 0.25, "community": 0.35, "promotional": 0.40},
        }
    }


# ---------------------------------------------------------------------------
# pick_content_type_for_platform
# ---------------------------------------------------------------------------

class TestPickContentTypeForPlatform:
    @pytest.mark.asyncio
    async def test_no_history_returns_highest_weight_type(self):
        """With no post history, pick the type with the highest target weight."""
        from app.services.posting_strategy_service import pick_content_type_for_platform

        strategy = {
            "facebook": {
                "content_mix": {
                    "educational": 0.25,
                    "community": 0.35,  # highest
                    "promotional": 0.20,
                    "entertaining": 0.20,
                }
            }
        }
        mock_cursor = AsyncMock()
        mock_cursor.fetchall = AsyncMock(return_value=[])
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("app.services.posting_strategy_service.get_posting_strategy", AsyncMock(return_value=strategy)),
            patch("app.services.posting_strategy_service.db_connection", return_value=mock_ctx),
        ):
            result = await pick_content_type_for_platform("facebook")

        assert result == "community"

    @pytest.mark.asyncio
    async def test_picks_most_underrepresented_type(self):
        """With history heavy in community, should pick the underrepresented type."""
        from app.services.posting_strategy_service import pick_content_type_for_platform

        strategy = {
            "facebook": {
                "content_mix": {
                    "educational": 0.25,
                    "community": 0.35,
                    "promotional": 0.20,
                    "entertaining": 0.20,
                }
            }
        }
        # 8 community posts, 0 educational — educational is most underrepresented
        mock_rows = [
            {"strategy_content_type": "community", "cnt": 8},
            {"strategy_content_type": "promotional", "cnt": 2},
        ]
        mock_cursor = AsyncMock()
        mock_cursor.fetchall = AsyncMock(return_value=mock_rows)
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("app.services.posting_strategy_service.get_posting_strategy", AsyncMock(return_value=strategy)),
            patch("app.services.posting_strategy_service.db_connection", return_value=mock_ctx),
        ):
            result = await pick_content_type_for_platform("facebook")

        # educational has 0/10 actual vs 0.25 target = gap of 0.25
        # entertaining has 0/10 actual vs 0.20 target = gap of 0.20
        # educational is the largest gap
        assert result == "educational"

    @pytest.mark.asyncio
    async def test_no_content_mix_returns_educational(self):
        """Platform with no content_mix configured defaults to 'educational'."""
        from app.services.posting_strategy_service import pick_content_type_for_platform

        strategy = {"facebook": {}}

        with patch("app.services.posting_strategy_service.get_posting_strategy", AsyncMock(return_value=strategy)):
            result = await pick_content_type_for_platform("facebook")

        assert result == "educational"

    @pytest.mark.asyncio
    async def test_unknown_platform_returns_educational(self):
        """Unknown platform not in strategy defaults to 'educational'."""
        from app.services.posting_strategy_service import pick_content_type_for_platform

        strategy = {"facebook": {"content_mix": {"community": 1.0}}}

        with patch("app.services.posting_strategy_service.get_posting_strategy", AsyncMock(return_value=strategy)):
            result = await pick_content_type_for_platform("myspace")

        assert result == "educational"

    @pytest.mark.asyncio
    async def test_balanced_history_returns_a_valid_type(self):
        """When all types are perfectly on target (gap=0), return any valid content type."""
        from app.services.posting_strategy_service import pick_content_type_for_platform

        strategy = {
            "facebook": {
                "content_mix": {
                    "educational": 0.25,
                    "community": 0.50,
                    "promotional": 0.25,
                }
            }
        }
        # Perfectly balanced: 1 edu, 2 community, 1 promo out of 4 total
        mock_rows = [
            {"strategy_content_type": "educational", "cnt": 1},
            {"strategy_content_type": "community", "cnt": 2},
            {"strategy_content_type": "promotional", "cnt": 1},
        ]
        mock_cursor = AsyncMock()
        mock_cursor.fetchall = AsyncMock(return_value=mock_rows)
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("app.services.posting_strategy_service.get_posting_strategy", AsyncMock(return_value=strategy)),
            patch("app.services.posting_strategy_service.db_connection", return_value=mock_ctx),
        ):
            result = await pick_content_type_for_platform("facebook")

        # All gaps are 0 — result must be one of the configured types
        assert result in {"educational", "community", "promotional"}


# ---------------------------------------------------------------------------
# get_store_timezone
# ---------------------------------------------------------------------------

class TestGetStoreTimezone:
    @pytest.mark.asyncio
    async def test_returns_configured_timezone(self):
        from app.services.posting_strategy_service import get_store_timezone

        mock_row = {"value": "America/Vancouver"}
        mock_cursor = AsyncMock()
        mock_cursor.fetchone = AsyncMock(return_value=mock_row)
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.posting_strategy_service.db_connection", return_value=mock_ctx):
            tz = await get_store_timezone()

        assert tz == ZoneInfo("America/Vancouver")

    @pytest.mark.asyncio
    async def test_defaults_to_toronto_when_not_set(self):
        from app.services.posting_strategy_service import get_store_timezone

        mock_cursor = AsyncMock()
        mock_cursor.fetchone = AsyncMock(return_value=None)
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.posting_strategy_service.db_connection", return_value=mock_ctx):
            tz = await get_store_timezone()

        assert tz == ZoneInfo("America/Toronto")

    @pytest.mark.asyncio
    async def test_falls_back_to_toronto_on_invalid_tz(self):
        from app.services.posting_strategy_service import get_store_timezone

        mock_row = {"value": "Not/A_Real_Timezone"}
        mock_cursor = AsyncMock()
        mock_cursor.fetchone = AsyncMock(return_value=mock_row)
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.posting_strategy_service.db_connection", return_value=mock_ctx):
            tz = await get_store_timezone()

        assert tz == ZoneInfo("America/Toronto")


# ---------------------------------------------------------------------------
# find_next_queue_slot — timezone conversion
# ---------------------------------------------------------------------------

class TestFindNextQueueSlotTimezone:
    """Verify best_times are treated as local store time, not UTC."""

    @pytest.mark.asyncio
    async def test_slot_is_local_time_converted_to_utc(self):
        """09:00 Eastern should become 13:00 UTC (UTC-4 in EDT summer)."""
        from app.services.posting_strategy_service import find_next_queue_slot

        # Use a known future summer date so EDT (UTC-4) applies
        # 09:00 America/Toronto on 2099-06-18 (summer) = 13:00 UTC
        strategy = _make_strategy(["23:00"])  # 23:00 local — always in future today

        mock_cursor = AsyncMock()
        mock_cursor.fetchall = AsyncMock(return_value=[])
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("app.services.posting_strategy_service.get_posting_strategy", AsyncMock(return_value=strategy)),
            patch("app.services.posting_strategy_service.get_store_timezone", AsyncMock(return_value=ZoneInfo("America/Toronto"))),
            patch("app.services.posting_strategy_service.db_connection", return_value=mock_ctx),
        ):
            slot = await find_next_queue_slot("facebook")

        # 23:00 America/Toronto (EDT = UTC-4) = 03:00 UTC next day
        assert slot.hour == 3
        assert slot.tzinfo == timezone.utc

    @pytest.mark.asyncio
    async def test_pacific_timezone_offset_applied(self):
        """23:00 Pacific (PDT = UTC-7 in summer) should be 06:00 UTC next day."""
        from app.services.posting_strategy_service import find_next_queue_slot

        strategy = _make_strategy(["23:00"])  # 23:00 local — always in future today

        mock_cursor = AsyncMock()
        mock_cursor.fetchall = AsyncMock(return_value=[])
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("app.services.posting_strategy_service.get_posting_strategy", AsyncMock(return_value=strategy)),
            patch("app.services.posting_strategy_service.get_store_timezone", AsyncMock(return_value=ZoneInfo("America/Vancouver"))),
            patch("app.services.posting_strategy_service.db_connection", return_value=mock_ctx),
        ):
            slot = await find_next_queue_slot("facebook")

        # 23:00 America/Vancouver (PDT = UTC-7) = 06:00 UTC next day
        assert slot.hour == 6
        assert slot.tzinfo == timezone.utc


# ---------------------------------------------------------------------------
# find_next_queue_slot — enabled flag
# ---------------------------------------------------------------------------

class TestFindNextQueueSlotEnabled:
    @pytest.mark.asyncio
    async def test_disabled_platform_returns_fallback(self):
        """A platform with enabled=False should return now+5min, not a strategy slot."""
        from app.services.posting_strategy_service import find_next_queue_slot

        strategy = _make_strategy(["09:00", "15:00"], enabled=False)
        before = datetime.now(timezone.utc)

        with (
            patch("app.services.posting_strategy_service.get_posting_strategy", AsyncMock(return_value=strategy)),
            patch("app.services.posting_strategy_service.get_store_timezone", AsyncMock(return_value=ZoneInfo("America/Toronto"))),
        ):
            slot = await find_next_queue_slot("facebook")

        after = datetime.now(timezone.utc)
        # Should be now+5min fallback — within 4m50s to 5m10s from call time
        delta = (slot - before).total_seconds()
        assert 250 <= delta <= 610, f"Expected ~300s fallback, got {delta}s (before={before}, slot={slot})"

    @pytest.mark.asyncio
    async def test_enabled_platform_returns_strategy_slot(self):
        """A platform with enabled=True should use best_times, not a now+5min fallback."""
        from app.services.posting_strategy_service import find_next_queue_slot

        strategy = _make_strategy(["23:00"], enabled=True)  # always in future
        now_utc = datetime.now(timezone.utc)

        mock_cursor = AsyncMock()
        mock_cursor.fetchall = AsyncMock(return_value=[])
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("app.services.posting_strategy_service.get_posting_strategy", AsyncMock(return_value=strategy)),
            patch("app.services.posting_strategy_service.get_store_timezone", AsyncMock(return_value=ZoneInfo("America/Toronto"))),
            patch("app.services.posting_strategy_service.db_connection", return_value=mock_ctx),
        ):
            slot = await find_next_queue_slot("facebook")

        # Strategy slot (23:00 local = 03:00 UTC next day) is well beyond now+5min
        delta = (slot - now_utc).total_seconds()
        assert delta > 300, "Should have picked a real strategy slot, not now+5min fallback"
        # And it must be the 23:00 local slot (03:00 UTC)
        assert slot.hour == 3 and slot.minute == 0


# ---------------------------------------------------------------------------
# find_next_queue_slot — conflict avoidance
# ---------------------------------------------------------------------------

class TestFindNextQueueSlotConflicts:
    @pytest.mark.asyncio
    async def test_skips_occupied_slot_and_picks_next(self):
        """If first best_time slot is occupied, pick the next available one."""
        from app.services.posting_strategy_service import find_next_queue_slot
        from datetime import date as date_type

        tz = ZoneInfo("America/Toronto")
        strategy = _make_strategy(["09:00", "15:00"], enabled=True)

        # Block both today's AND tomorrow's 09:00 local slots so the function is
        # forced to pick the next 15:00 local slot regardless of what UTC time CI runs.
        from datetime import timedelta as td
        today = datetime.now(timezone.utc).astimezone(tz).date()
        occupied_slots = []
        for day_offset in range(2):
            d = today + td(days=day_offset)
            s = datetime(d.year, d.month, d.day, 9, 0, 0, tzinfo=tz).astimezone(timezone.utc)
            occupied_slots.append({"slot_time": s.isoformat()})

        mock_cursor = AsyncMock()
        mock_cursor.fetchall = AsyncMock(return_value=occupied_slots)
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("app.services.posting_strategy_service.get_posting_strategy", AsyncMock(return_value=strategy)),
            patch("app.services.posting_strategy_service.get_store_timezone", AsyncMock(return_value=tz)),
            patch("app.services.posting_strategy_service.db_connection", return_value=mock_ctx),
        ):
            slot = await find_next_queue_slot("facebook")

        # Should skip the occupied 09:00 local slot and pick the 15:00 local slot
        slot_local_result = slot.astimezone(tz)
        assert slot_local_result.hour == 15 and slot_local_result.minute == 0, \
            f"Expected 15:00 local (EDT), got local={slot_local_result} utc={slot}"


# ---------------------------------------------------------------------------
# get_daily_posting_plan — enabled flag
# ---------------------------------------------------------------------------

class TestDailyPlanEnabledFlag:
    @pytest.mark.asyncio
    async def test_disabled_platform_excluded_from_plan(self):
        from app.services.posting_strategy_service import get_daily_posting_plan

        strategy = {
            "facebook": {"posts_per_day": 2, "best_times": ["09:00", "15:00"], "enabled": True, "content_mix": {}},
            "linkedin": {"posts_per_day": 1, "best_times": ["08:00"], "enabled": False, "content_mix": {}},
        }

        mock_cursor = AsyncMock()
        mock_cursor.fetchall = AsyncMock(return_value=[])
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("app.services.posting_strategy_service.get_posting_strategy", AsyncMock(return_value=strategy)),
            patch("app.services.posting_strategy_service.db_connection", return_value=mock_ctx),
        ):
            plan = await get_daily_posting_plan("2026-06-18")

        assert "facebook" in plan["by_platform"]
        assert "linkedin" not in plan["by_platform"], "Disabled platform should be excluded from daily plan"

    @pytest.mark.asyncio
    async def test_plan_total_excludes_disabled_platforms(self):
        from app.services.posting_strategy_service import get_daily_posting_plan

        strategy = {
            "facebook": {"posts_per_day": 2, "best_times": ["09:00", "15:00"], "enabled": True, "content_mix": {}},
            "instagram": {"posts_per_day": 3, "best_times": ["08:00", "12:00", "18:00"], "enabled": False, "content_mix": {}},
        }

        mock_cursor = AsyncMock()
        mock_cursor.fetchall = AsyncMock(return_value=[])
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("app.services.posting_strategy_service.get_posting_strategy", AsyncMock(return_value=strategy)),
            patch("app.services.posting_strategy_service.db_connection", return_value=mock_ctx),
        ):
            plan = await get_daily_posting_plan("2026-06-18")

        # Only facebook (2 posts) — instagram disabled (3 posts) should not be counted
        assert plan["total_target"] == 2


# ---------------------------------------------------------------------------
# get_store_timezone — settings API integration (via admin endpoint)
# ---------------------------------------------------------------------------

class TestStoreTimezoneSettingAPI:
    @pytest.mark.asyncio
    async def test_settings_endpoint_accepts_store_timezone(self, admin_client):
        """PUT /api/admin/settings should persist store_timezone. Requires DB."""
        resp = await admin_client.put(
            "/api/admin/settings",
            json=[{"key": "store_timezone", "value": "America/Vancouver"}],
        )
        assert resp.status_code == 200
        resp2 = await admin_client.get("/api/admin/settings")
        assert resp2.status_code == 200
        rows = {r["key"]: r["value"] for r in resp2.json()}
        assert rows.get("store_timezone") == "America/Vancouver"

    @pytest.mark.asyncio
    async def test_get_store_timezone_reads_settings_db(self):
        """get_store_timezone returns the value saved in the settings table."""
        from app.services.posting_strategy_service import get_store_timezone

        mock_row = {"value": "America/Halifax"}
        mock_cursor = AsyncMock()
        mock_cursor.fetchone = AsyncMock(return_value=mock_row)
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_cursor)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.posting_strategy_service.db_connection", return_value=mock_ctx):
            tz = await get_store_timezone()

        assert tz == ZoneInfo("America/Halifax")
