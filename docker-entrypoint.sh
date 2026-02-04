#!/bin/sh
set -e

echo "🚀 Starting ITS Business Core..."

# Set database path to persistent volume
export DATABASE_URL="file:/app/data/database.db"

# Check if database exists
if [ ! -f /app/data/database.db ]; then
  echo "📦 Database not found. Initializing empty database..."

  # Push schema to create database (no seed - wizard will handle that)
  npx prisma db push --accept-data-loss

  echo "✅ Database schema created. Setup wizard will complete initialization."
else
  echo "✅ Database found. Running migrations if needed..."
  npx prisma db push --accept-data-loss
fi

echo "🎉 Starting application..."
exec "$@"
