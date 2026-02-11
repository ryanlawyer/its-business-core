#!/bin/sh
set -e

echo "Starting ITS Business Core..."

# Set database path to persistent volume
export DATABASE_URL="file:/app/data/database.db"
export SQLITE_URL="file:/app/data/database.db"

# Generate or load NEXTAUTH_SECRET
SECRETS_FILE="/app/data/.secrets"
if [ -f "$SECRETS_FILE" ]; then
  echo "Loading existing secrets..."
  . "$SECRETS_FILE"
else
  echo "Generating new secrets..."
  AUTH_SECRET=$(openssl rand -base64 32)
  echo "export AUTH_SECRET=\"$AUTH_SECRET\"" > "$SECRETS_FILE"
  chmod 600 "$SECRETS_FILE"
fi
export AUTH_SECRET
export NEXTAUTH_SECRET="$AUTH_SECRET"

# Check if database exists
if [ ! -f /app/data/database.db ]; then
  echo "Database not found. Initializing empty database..."

  # Push schema to create database (no seed - wizard will handle that)
  npx prisma db push --accept-data-loss

  echo "Database schema created. Setup wizard will complete initialization."
else
  echo "Database found. Running migrations if needed..."
  npx prisma db push --accept-data-loss
fi

# Seed config file if empty or missing (happens when config volume is first mounted)
CONFIG_FILE="/app/config/system-settings.json"
DEFAULT_CONFIG="/app/config-defaults/system-settings.json"
if [ ! -s "$CONFIG_FILE" ] && [ -f "$DEFAULT_CONFIG" ]; then
  echo "Config file missing or empty. Seeding from defaults..."
  cp "$DEFAULT_CONFIG" "$CONFIG_FILE"
fi

echo "Starting application..."
exec "$@"
