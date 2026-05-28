from __future__ import annotations

import logging
from pathlib import Path
from typing import AsyncGenerator

import aiosqlite

from app.config import get_settings

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = Path(__file__).parent / "migrations"

_db_path: str | None = None


def _get_db_path() -> str:
    global _db_path
    if _db_path is None:
        settings = get_settings()
        _db_path = settings.database_path
    return _db_path


def set_db_path(path: str) -> None:
    """Override the database path (used in tests)."""
    global _db_path
    _db_path = path


async def get_db() -> AsyncGenerator[aiosqlite.Connection, None]:
    """FastAPI dependency that yields an aiosqlite connection."""
    db = await aiosqlite.connect(_get_db_path())
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode = WAL")
    await db.execute("PRAGMA synchronous = NORMAL")
    await db.execute("PRAGMA foreign_keys = ON")
    await db.execute("PRAGMA busy_timeout = 5000")
    await db.execute("PRAGMA cache_size = -20000")
    try:
        yield db
    finally:
        await db.close()


async def init_db() -> None:
    """Create the data directory and run migrations on startup."""
    settings = get_settings()
    db_path = Path(_get_db_path())
    db_path.parent.mkdir(parents=True, exist_ok=True)

    # Ensure uploads directory exists
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)

    db = await aiosqlite.connect(str(db_path))
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode = WAL")
    await db.execute("PRAGMA synchronous = NORMAL")
    await db.execute("PRAGMA foreign_keys = ON")
    await db.execute("PRAGMA busy_timeout = 5000")
    await db.execute("PRAGMA cache_size = -20000")

    try:
        await _run_migrations(db)
    finally:
        await db.close()


async def _run_migrations(db: aiosqlite.Connection) -> None:
    """Run numbered SQL migration files that haven't been applied yet."""
    await db.execute("""
        CREATE TABLE IF NOT EXISTS _migrations (
            version INTEGER PRIMARY KEY,
            filename TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    await db.commit()

    cursor = await db.execute("SELECT COALESCE(MAX(version), 0) FROM _migrations")
    row = await cursor.fetchone()
    current_version = row[0]

    if not MIGRATIONS_DIR.exists():
        logger.warning("Migrations directory not found: %s", MIGRATIONS_DIR)
        return

    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))

    for migration_file in migration_files:
        try:
            version = int(migration_file.stem.split("_")[0])
        except (ValueError, IndexError):
            logger.warning("Skipping migration with invalid name: %s", migration_file.name)
            continue

        if version <= current_version:
            continue

        logger.info("Applying migration %d: %s", version, migration_file.name)
        sql = migration_file.read_text(encoding="utf-8")

        try:
            await db.executescript(sql)
            await db.execute(
                "INSERT INTO _migrations (version, filename) VALUES (?, ?)",
                (version, migration_file.name),
            )
            await db.commit()
            logger.info("Migration %d applied successfully", version)
        except Exception:
            logger.exception("Migration %d failed: %s", version, migration_file.name)
            raise


async def check_db_health() -> bool:
    """Quick health check — can we query the database?"""
    try:
        db = await aiosqlite.connect(_get_db_path())
        try:
            cursor = await db.execute("SELECT 1")
            await cursor.fetchone()
            return True
        finally:
            await db.close()
    except Exception:
        logger.exception("Database health check failed")
        return False
