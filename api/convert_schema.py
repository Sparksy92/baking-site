import os
import glob
import re
from pathlib import Path

MIGRATIONS_DIR = Path("app/migrations")
SQL_FILES = sorted(MIGRATIONS_DIR.glob("*.sql"))

schema = ""

for f in SQL_FILES:
    schema += f"-- From {f.name}\n"
    schema += f.read_text(encoding="utf-8") + "\n\n"

# Replace SQLite syntax with Postgres syntax
schema = re.sub(r"INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT", "SERIAL PRIMARY KEY", schema, flags=re.IGNORECASE)
schema = re.sub(r"datetime\('now'\)", "CURRENT_TIMESTAMP", schema, flags=re.IGNORECASE)
schema = re.sub(r"INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0", "INTEGER NOT NULL DEFAULT 0", schema, flags=re.IGNORECASE)
schema = re.sub(r"INTEGER\s+NOT\s+NULL\s+DEFAULT\s+1", "INTEGER NOT NULL DEFAULT 1", schema, flags=re.IGNORECASE)
schema = re.sub(r"REAL", "NUMERIC", schema, flags=re.IGNORECASE)

# Fix INSERT OR IGNORE
schema = schema.replace("INSERT OR IGNORE INTO settings", "INSERT INTO settings")
schema = schema.replace("VALUES ('analytics_id', '');", "VALUES ('analytics_id', '') ON CONFLICT (key) DO NOTHING;")

# Remove COLLATE NOCASE
schema = re.sub(r"COLLATE\s+NOCASE", "", schema, flags=re.IGNORECASE)

# Remove SQLite PRAGMAs
schema = re.sub(r"PRAGMA .*?;", "", schema, flags=re.IGNORECASE)

# Drop existing files
for f in SQL_FILES:
    f.unlink()

# Write the new schema
output_file = MIGRATIONS_DIR / "001_initial_postgres_schema.sql"
output_file.write_text(schema, encoding="utf-8")

print(f"Generated {output_file.name}")
