#!/bin/sh
set -e

echo "Generating prisma client..."
npx prisma generate

echo "Starting application..."
exec "$@"
