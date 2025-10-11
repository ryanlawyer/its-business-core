#!/bin/sh
set -e

echo "🚀 Starting ITS Business Core..."

# Set database path to persistent volume
export DATABASE_URL="file:/app/data/database.db"

# Check if database exists
if [ ! -f /app/data/database.db ]; then
  echo "📦 Database not found. Initializing..."

  # Push schema to create database
  npx prisma db push --accept-data-loss

  # Run seed data
  echo "🌱 Seeding database..."
  npx tsx prisma/seed.ts

  echo "✅ Database initialized successfully!"
else
  echo "✅ Database found. Running migrations if needed..."
  npx prisma db push --accept-data-loss
fi

echo "🎉 Starting application..."
exec "$@"
