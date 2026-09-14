#!/usr/bin/env bash
set -euo pipefail

# Usage: DATABASE_URL=postgresql://user:pass@host:5432/db IMAGE=registry/youruser/dashboard:latest ./run_seed.sh

IMAGE=${IMAGE:-registry/youruser/dashboard:latest}
DATABASE_URL=${DATABASE_URL:-}

if [ -z "$DATABASE_URL" ]; then
  echo "Please set DATABASE_URL environment variable, e.g. export DATABASE_URL=postgresql://postgres:postgres@db:5432/dashboard"
  exit 1
fi

echo "Running seed inside image $IMAGE against $DATABASE_URL"

docker run --rm -e DATABASE_URL="$DATABASE_URL" "$IMAGE" node scripts/seed.js

echo "Seed finished"
