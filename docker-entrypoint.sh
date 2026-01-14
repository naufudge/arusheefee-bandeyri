#!/bin/sh
set -e

echo "Running Prisma migrations..."
node /app/node_modules/prisma/build/index.js migrate deploy

echo "Starting application..."
exec "$@"
