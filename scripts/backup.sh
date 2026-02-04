#!/bin/sh
set -e

# Backup script for ITS Business Core
# Usage: backup.sh [data|full] > backup.tar.gz

BACKUP_TYPE="${1:-data}"
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
TEMP_DIR=$(mktemp -d)

# Print to stderr so stdout remains clean for tar output
log() {
    echo "$1" >&2
}

cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

log "Creating $BACKUP_TYPE backup..."

# Create manifest
cat > "$TEMP_DIR/manifest.json" << EOF
{
    "type": "$BACKUP_TYPE",
    "timestamp": "$TIMESTAMP",
    "version": "1.0",
    "created_by": "its-business-core-backup"
}
EOF

# Always include database
if [ -f /app/data/database.db ]; then
    cp /app/data/database.db "$TEMP_DIR/database.db"
    log "✓ Database included"
else
    log "⚠ Database not found at /app/data/database.db"
fi

# Always include uploads
if [ -d /app/uploads ]; then
    cp -r /app/uploads "$TEMP_DIR/uploads"
    log "✓ Uploads included"
else
    mkdir -p "$TEMP_DIR/uploads"
    log "⚠ Uploads directory not found, creating empty"
fi

# Full backup includes additional files
if [ "$BACKUP_TYPE" = "full" ]; then
    # Include secrets file
    if [ -f /app/data/.secrets ]; then
        cp /app/data/.secrets "$TEMP_DIR/.secrets"
        log "✓ Secrets file included"
    else
        log "⚠ Secrets file not found"
    fi

    # Export system config from database
    if [ -f /app/data/database.db ]; then
        # Use sqlite3 to export system_config table as JSON
        if command -v sqlite3 > /dev/null 2>&1; then
            sqlite3 -json /app/data/database.db "SELECT * FROM system_config" > "$TEMP_DIR/system_config.json" 2>/dev/null || echo "[]" > "$TEMP_DIR/system_config.json"
            log "✓ System config exported"
        else
            echo "[]" > "$TEMP_DIR/system_config.json"
            log "⚠ sqlite3 not available, skipping config export"
        fi
    fi
fi

# Create tar archive and output to stdout
log "Compressing backup..."
tar -czf - -C "$TEMP_DIR" .

log "✓ Backup complete"
