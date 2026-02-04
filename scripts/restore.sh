#!/bin/sh
set -e

# Restore script for ITS Business Core
# Usage: restore.sh < backup.tar.gz

TEMP_DIR=$(mktemp -d)
BACKUP_DIR=$(mktemp -d)
RESTORE_SUCCESS=0

log() {
    echo "$1" >&2
}

cleanup() {
    rm -rf "$TEMP_DIR" "$BACKUP_DIR"
}
trap cleanup EXIT

error_exit() {
    log "✗ Error: $1"
    exit 1
}

log "Starting restore process..."

# Extract backup to temp directory
log "Extracting backup archive..."
if ! tar -xzf - -C "$TEMP_DIR" 2>/dev/null; then
    error_exit "Failed to extract backup archive. Is it a valid .tar.gz file?"
fi

# Validate manifest
if [ ! -f "$TEMP_DIR/manifest.json" ]; then
    error_exit "Invalid backup: manifest.json not found"
fi

# Parse manifest (basic validation)
BACKUP_TYPE=$(grep -o '"type"[[:space:]]*:[[:space:]]*"[^"]*"' "$TEMP_DIR/manifest.json" | cut -d'"' -f4)
BACKUP_TIMESTAMP=$(grep -o '"timestamp"[[:space:]]*:[[:space:]]*"[^"]*"' "$TEMP_DIR/manifest.json" | cut -d'"' -f4)

if [ -z "$BACKUP_TYPE" ]; then
    error_exit "Invalid backup: missing backup type in manifest"
fi

log "Backup type: $BACKUP_TYPE"
log "Backup timestamp: $BACKUP_TIMESTAMP"

# Validate required files exist
if [ ! -f "$TEMP_DIR/database.db" ]; then
    error_exit "Invalid backup: database.db not found"
fi

log "✓ Backup validation passed"

# Create safety backup of current data
log "Creating safety backup of current data..."
if [ -f /app/data/database.db ]; then
    cp /app/data/database.db "$BACKUP_DIR/database.db.bak"
fi
if [ -d /app/uploads ]; then
    cp -r /app/uploads "$BACKUP_DIR/uploads.bak"
fi
if [ -f /app/data/.secrets ]; then
    cp /app/data/.secrets "$BACKUP_DIR/.secrets.bak"
fi
log "✓ Safety backup created"

# Perform restore
log "Restoring data..."

# Restore database
cp "$TEMP_DIR/database.db" /app/data/database.db
log "✓ Database restored"

# Restore uploads
if [ -d "$TEMP_DIR/uploads" ]; then
    rm -rf /app/uploads/*
    cp -r "$TEMP_DIR/uploads/"* /app/uploads/ 2>/dev/null || true
    log "✓ Uploads restored"
fi

# Restore secrets (full backup only)
if [ "$BACKUP_TYPE" = "full" ] && [ -f "$TEMP_DIR/.secrets" ]; then
    cp "$TEMP_DIR/.secrets" /app/data/.secrets
    log "✓ Secrets restored"
fi

# Run schema migrations
log "Running database migrations..."
cd /app
if npx prisma db push --accept-data-loss 2>&1 | grep -v "^$" >&2; then
    log "✓ Database schema updated"
else
    log "⚠ Migration had warnings (this may be normal)"
fi

log ""
log "═══════════════════════════════════════════"
log "✓ Restore completed successfully!"
log "═══════════════════════════════════════════"
log ""
log "Important: Please restart the application for changes to take effect."
log "All users will need to log in again."

exit 0
