from __future__ import annotations

import logging
import re
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

import asyncpg

from app.config import get_settings


class IntegrityError(Exception):
    """Raised when a database integrity constraint is violated."""

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
    """Wrapper around asyncpg.Record to simulate dict and tuple access."""
    def __init__(self, record: asyncpg.Record):
        self._record = record

    def __getitem__(self, key):
        return self._record[key]

    def keys(self):
        return self._record.keys()

class PostgresCursor:
    """Cursor wrapper using asyncpg."""
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
        pg_query = re.sub(r'(?i)([a-zA-Z0-9_.]+)\s*=\s*\$(\d+)\s+COLLATE\s+NOCASE', r'LOWER(\1) = LOWER($\2)', pg_query)
        pg_query = re.sub(r'(?i)\bGROUP_CONCAT\b', 'STRING_AGG', pg_query)
        pg_query = re.sub(r"(?i)\bdate\('now',\s*'start of month'\)", "date_trunc('month', NOW())", pg_query)
        pg_query = re.sub(r"(?i)\bdate\('now',\s*'-(\d+)\s+days?'\)", r"(NOW() - INTERVAL '\1 days')", pg_query)
        pg_query = re.sub(r"(?i)\bdatetime\('now',\s*'-(\d+)\s+days?'\)", r"(NOW() - INTERVAL '\1 days')", pg_query)
        pg_query = re.sub(r"(?i)\bdatetime\('now',\s*'-(\d+)\s+hours?'\)", r"(NOW() - INTERVAL '\1 hours')", pg_query)
        pg_query = re.sub(r"(?i)\bdatetime\('now'\)", "CURRENT_TIMESTAMP", pg_query)
        pg_query = re.sub(r"(?i)\bdate\(([^)]+)\)", r"SUBSTRING(CAST(\1 AS TEXT) FROM 1 FOR 10)", pg_query)
        pg_query = re.sub(r'(?i)\bCOALESCE\(session_id,\s*id\)', r'COALESCE(session_id, CAST(id AS TEXT))', pg_query)
        pg_query = re.sub(r'(?i)\bCASE\s+WHEN\s+\$(\d+)\s+IS\s+NOT\s+NULL', r'CASE WHEN CAST($\1 AS TEXT) IS NOT NULL', pg_query)
        
        # Universal timestamp text casting for comparisons (inequalities only)
        pg_query = re.sub(r'\b([a-zA-Z0-9_]+\.)?(created_at|last_activity_at|updated_at|refunded_at|cancelled_at)\s*([<>]=?)\s*', r'CAST(\1\2 AS timestamp) \3 ', pg_query)
        
        is_insert_ignore = "INSERT OR IGNORE" in original_query.upper()
        if is_insert_ignore:
            pg_query = re.sub(r'(?i)\bINSERT\s+OR\s+IGNORE\s+INTO\b', 'INSERT INTO', pg_query)
            if "ON CONFLICT" not in pg_query.upper():
                pg_query += " ON CONFLICT DO NOTHING"
                
        is_insert_replace = "INSERT OR REPLACE" in original_query.upper()
        if is_insert_replace:
            pg_query = re.sub(r'(?i)\bINSERT\s+OR\s+REPLACE\s+INTO\b\s+([a-zA-Z0-9_]+)', r'INSERT INTO \1', pg_query)
            if "ON CONFLICT" not in pg_query.upper():
                if "settings" in original_query.lower():
                    pg_query += " ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
                    
        # SQLite LIKE is case-insensitive, Postgres LIKE is case-sensitive
        pg_query = re.sub(r'(?i)\bLIKE\b', 'ILIKE', pg_query)
                
        if pg_query.strip().upper() == "BEGIN EXCLUSIVE":
            pg_query = "BEGIN"
        elif pg_query.strip().upper() == "SELECT LAST_INSERT_ROWID()":
            pg_query = "SELECT lastval()"
        
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
            elif original_query.upper().startswith("UPDATE") or original_query.upper().startswith("DELETE"):
                status = await self.conn.execute(pg_query, *args)
                # status is usually "UPDATE 1" or "DELETE 0"
                try:
                    self.rowcount = int(status.split()[-1])
                except (ValueError, IndexError):
                    self.rowcount = 0
            else:
                # Use fetch so we can simulate fetchall/fetchone
                records = await self.conn.fetch(pg_query, *args)
                self._rows = [PostgresRow(r) for r in records]
                self.rowcount = len(records)
        except asyncpg.exceptions.IntegrityConstraintViolationError as e:
            raise IntegrityError(str(e))
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
    """PostgreSQL connection wrapper."""
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
        pass  # asyncpg pool connections use autocommit outside explicit transactions

    async def rollback(self):
        pass  # asyncpg pool connections use autocommit outside explicit transactions
        
    async def close(self):
        pass


async def get_db() -> AsyncGenerator[PostgresConnection, None]:
    """Yield a wrapped PostgresConnection. For use with FastAPI Depends."""
    global _pool
    if not _pool:
        settings = get_settings()
        _pool = await asyncpg.create_pool(settings.database_url)

    async with _pool.acquire() as conn:
        yield PostgresConnection(conn)


@asynccontextmanager
async def db_connection() -> AsyncGenerator[PostgresConnection, None]:
    """Async context manager for acquiring a DB connection outside of FastAPI request scope.

    Usage:
        async with db_connection() as db:
            await db.execute(...)
    """
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

async def close_db() -> None:
    """Close the database pool. Used primarily for test teardown."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None



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
