#!/bin/sh
set -e

echo "Running Prisma migrations..."
cd /app && pnpm exec prisma migrate deploy --schema=prisma/schema.prisma

echo "Starting API server..."
exec "$@"
