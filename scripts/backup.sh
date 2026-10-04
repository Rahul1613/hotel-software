#!/bin/bash
set -euo pipefail

# Hotel Ekdant Database Backup Script (PostgreSQL or SQLite fallback)
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

if [ -n "${DATABASE_URL:-}" ] && [[ "$DATABASE_URL" == postgres* ]]; then
    BACKUP_FILE="$BACKUP_DIR/hotel_ekdant_${TIMESTAMP}.sql.gz"
    echo "Creating PostgreSQL backup to $BACKUP_FILE..."
    pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"
    echo "Backup completed: $BACKUP_FILE"
elif [ -f "backend/hotel_ekdant.db" ]; then
    BACKUP_FILE="$BACKUP_DIR/hotel_ekdant_${TIMESTAMP}.sqlite"
    echo "Creating SQLite backup to $BACKUP_FILE..."
    sqlite3 "backend/hotel_ekdant.db" ".backup '$BACKUP_FILE'"
    echo "Backup completed: $BACKUP_FILE"
else
    echo "No active database found to back up."
    exit 1
fi
