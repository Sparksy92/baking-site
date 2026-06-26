from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.database import PostgresConnection

from app.auth import require_admin
from app.database import get_db
from app.routes.settings import clean_legacy_value

router = APIRouter(prefix="/admin/settings", tags=["admin-settings"])


class SettingUpdate(BaseModel):
    key: str
    value: str


@router.get("")
async def get_all_settings(
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    # 1. Run self-healing database updates on settings table
    await db.execute("""
      INSERT INTO settings (key, value) VALUES
      ('brand_name', 'Sage & Sweetgrass Homestead'),
      ('brand_tagline', 'Fresh baking, pantry goods & handmade home and body care'),
      ('brand_abbreviation', 'SSH'),
      ('contact_email', 'hello@sageandsweetgrass.ca'),
      ('etransfer_email', 'payments@sageandsweetgrass.ca')
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value
      WHERE settings.value = 'Automated Brand' 
         OR settings.value = '' 
         OR settings.value LIKE '%Cedar%'
    """)

    await db.execute("UPDATE settings SET value = REPLACE(value, 'Cedar & Sage', 'Sage & Sweetgrass Homestead') WHERE value LIKE '%Cedar & Sage%'")
    await db.execute("UPDATE settings SET value = REPLACE(value, 'Cedar and Sage', 'Sage & Sweetgrass Homestead') WHERE value LIKE '%Cedar and Sage%'")
    await db.execute("UPDATE settings SET value = REPLACE(value, 'kirstinsparks@hotmail.com', 'hello@sageandsweetgrass.ca') WHERE key = 'contact_email'")
    await db.execute("UPDATE settings SET value = REPLACE(value, 'kirstinsparks@hotmail.com', 'payments@sageandsweetgrass.ca') WHERE key = 'etransfer_email' OR key = 'payment_instructions'")
    await db.execute("UPDATE settings SET value = REPLACE(value, 'payments@example.com', 'payments@sageandsweetgrass.ca') WHERE value LIKE '%payments@example.com%'")
    await db.execute("UPDATE settings SET value = REPLACE(value, 'family-run homestead kitchen', 'family-run kitchen') WHERE value LIKE '%family-run homestead kitchen%'")
    await db.execute("UPDATE settings SET value = REPLACE(value, 'small-batch homestead kitchen', 'small-batch kitchen') WHERE value LIKE '%small-batch homestead kitchen%'")

    # 2. Fetch and return values, applying clean_legacy_value
    cursor = await db.execute("SELECT * FROM settings ORDER BY key")
    rows = await cursor.fetchall()
    
    settings_list = []
    for r in rows:
        d = dict(r)
        if isinstance(d.get("value"), str):
            d["value"] = clean_legacy_value(d["value"])
        settings_list.append(d)
        
    return settings_list


@router.put("")
async def update_settings(
    updates: list[SettingUpdate],
    db: PostgresConnection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    for item in updates:
        await db.execute(
            "INSERT INTO settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP",
            (item.key, item.value, user["sub"]),
        )
    await db.commit()
    return {"updated": len(updates)}
