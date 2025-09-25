#!/bin/sh
set -e

echo "Starting Drive Ooblik..."

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
until nc -z ${DB_HOST:-postgres} ${DB_PORT:-5432}; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done
echo "PostgreSQL is ready!"

# Run migrations
echo "Running database migrations..."
cd /app/backend
node migrations/run-migrations.js || {
  echo "Warning: Migration failed, but continuing..."
}

# Start supervisor to manage both nginx and backend
echo "Starting services with supervisor..."
exec "$@"