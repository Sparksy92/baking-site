from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import AsyncGenerator

import asyncpg

from app.config import get_settings

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = Path(__file__).parent / "migrations"

_pool: asyncpg.Pool | None = None

def _convert_qmarks(query: str) -> str:
    """Convert SQLite ? placeholders to PostgreSQL $1, $2, etc."""
    parts = query.split('?')
    out = parts[0]
    for i, part in enumerate(parts[1:], 1):
        out += f"${i}{part}"
    return out

class PostgresRow:
    """Wrapper around asyncpg.Record to simulate dict and tuple access like aiosqlite.Row."""
    def __init__(self, record: asyncpg.Record):
        self._record = record

    def __getitem__(self, key):
        return self._record[key]

    def keys(self):
        return self._record.keys()

class PostgresCursor:
    """Wrapper simulating an aiosqlite cursor using asyncpg."""
    def __init__(self, conn: asyncpg.Connection):
        self.conn = conn
        self._rows = []
        self.lastrowid = None
        self.rowcount = 0

    async def execute(self, query: str, args: tuple | list = None):
        if args is None:
            args = []
            
        original_query = query.strip()
        is_insert = original_query.upper().startswith("INSERT")
        
        # Rewrite query to use $1, $2
        pg_query = _convert_qmarks(original_query)
        
        # Append RETURNING id for lastrowid simulation
        if is_insert and "RETURNING" not in pg_query.upper() and "ON CONFLICT" not in pg_query.upper():
            pg_query += " RETURNING id"
            
        try:
            if is_insert and "RETURNING" in pg_query.upper():
                try:
                    row = await self.conn.fetchrow(pg_query, *args)
                    if row and 'id' in row:
                        self.lastrowid = row['id']
                    self.rowcount = 1 if row else 0
                except asyncpg.exceptions.UndefinedColumnError:
                    # Retry without RETURNING id
                    pg_query_no_return = pg_query.replace(" RETURNING id", "")
                    await self.conn.execute(pg_query_no_return, *args)
                    self.rowcount = 1
            else:
                # Use fetch so we can simulate fetchall/fetchone
                records = await self.conn.fetch(pg_query, *args)
                self._rows = [PostgresRow(r) for r in records]
                self.rowcount = len(records)
        except Exception as e:
            logger.error(f"Error executing query: {pg_query} with args {args}")
            raise e
        return self

    async def fetchone(self):
        if self._rows:
            return self._rows.pop(0)
        return None

    async def fetchall(self):
        res = self._rows
        self._rows = []
        return res

class PostgresConnection:
    """Wrapper simulating aiosqlite.Connection."""
    def __init__(self, conn: asyncpg.Connection):
        self.conn = conn
        self.row_factory = None # Ignored

    async def execute(self, query: str, args: tuple | list = None):
        cur = PostgresCursor(self.conn)
        await cur.execute(query, args)
        return cur

    async def executescript(self, script: str):
        await self.conn.execute(script)

    async def commit(self):
        # asyncpg auto-commits outside of transactions
        pass
        
    async def close(self):
        pass


async def get_db() -> AsyncGenerator[PostgresConnection, None]:
    """Yield a wrapped PostgresConnection."""
    global _pool
    if not _pool:
        settings = get_settings()
        _pool = await asyncpg.create_pool(settings.database_url)
    
    async with _pool.acquire() as conn:
        yield PostgresConnection(conn)


async def init_db() -> None:
    """Initialize database pool and run migrations."""
    global _pool
    settings = get_settings()
    
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    
    if not _pool:
        _pool = await asyncpg.create_pool(settings.database_url)
            
    async with _pool.acquire() as conn:
        await _run_migrations(conn)


async def _run_migrations(conn: asyncpg.Connection) -> None:
    """Run Postgres migrations from MIGRATIONS_DIR."""
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS _migrations (
            version INTEGER PRIMARY KEY,
            filename TEXT NOT NULL,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    row = await conn.fetchrow("SELECT COALESCE(MAX(version), 0) as ver FROM _migrations")
    current_version = row['ver'] if row else 0

    if not MIGRATIONS_DIR.exists():
        logger.warning("Migrations directory not found: %s", MIGRATIONS_DIR)
        return

    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))

    for migration_file in migration_files:
        try:
            version = int(migration_file.stem.split("_")[0])
        except (ValueError, IndexError):
            continue

        if version <= current_version:
            continue

        logger.info("Applying migration %d: %s", version, migration_file.name)
        sql = migration_file.read_text(encoding="utf-8")

        async with conn.transaction():
            await conn.execute(sql)
            await conn.execute(
                "INSERT INTO _migrations (version, filename) VALUES ($1, $2)",
                version, migration_file.name
            )
            logger.info("Migration %d applied successfully", version)


async def check_db_health() -> bool:
    """Health check for PostgreSQL."""
    global _pool
    try:
        if not _pool:
            return False
        async with _pool.acquire() as conn:
            await conn.execute("SELECT 1")
            return True
    except Exception:
        logger.exception("Database health check failed")
        return False
