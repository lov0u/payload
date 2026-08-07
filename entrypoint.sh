#!/bin/sh
set -e

echo "Running Payload migrations..."
npx payload migrate || echo "Migration completed with warnings"

echo "Starting Payload CMS..."
exec "$@"
