from __future__ import annotations

from fastapi import APIRouter

from app.config import get_settings
from app.database import check_db_health

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    settings = get_settings()
    db_ok = await check_db_health()
    return {
        "status": "ok" if db_ok else "degraded",
        "version": settings.app_version,
        "database": "ok" if db_ok else "error",
    }
