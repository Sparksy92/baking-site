#!/usr/bin/env bash
# SQLite backup script for clothing-ecommerce-baseline
#
# Usage:
#   ./scripts/backup-db.sh                     # uses default path ./data/store.db
#   ./scripts/backup-db.sh /app/data/store.db  # specify database path
#
# Backups are stored in ./backups/ with timestamped filenames.
# Uses SQLite's .backup command for a safe, consistent snapshot.
#
# Crontab example (daily at 2 AM):
#   0 2 * * * /data/ecommerce-baseline/scripts/backup-db.sh /app/data/store.db
#
# Retention: keeps last 30 backups. Older files are deleted automatically.

set -euo pipefail

DB_PATH="${1:-./data/store.db}"
BACKUP_DIR="$(dirname "$DB_PATH")/backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/store_${TIMESTAMP}.db"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Verify source database exists
if [ ! -f "$DB_PATH" ]; then
  echo "ERROR: Database not found at $DB_PATH" >&2
  exit 1
fi

# Use SQLite .backup for a consistent snapshot (safe even with WAL mode)
sqlite3 "$DB_PATH" ".backup '${BACKUP_FILE}'"

# Compress the backup
gzip "$BACKUP_FILE"

echo "Backup created: ${BACKUP_FILE}.gz ($(du -h "${BACKUP_FILE}.gz" | cut -f1))"

# Prune old backups (keep last RETENTION_DAYS days)
find "$BACKUP_DIR" -name "store_*.db.gz" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true

BACKUP_COUNT=$(find "$BACKUP_DIR" -name "store_*.db.gz" | wc -l)
echo "Total backups: $BACKUP_COUNT"
