#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.local"

if [ -f "${ENV_FILE}" ]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

if [ -z "${RENDER_DATABASE_URL:-}" ]; then
  echo "❌ RENDER_DATABASE_URL not set. Skipping Render sync."
  exit 0
fi

if ! docker ps --format '{{.Names}}' | grep -q '^sonic_backend$'; then
  echo "❌ sonic_backend container not running."
  exit 1
fi

echo "☁️  Syncing to Render DB..."

COMMON_ENVS=(-e DATABASE_URL="${RENDER_DATABASE_URL}")

if [ -n "${DISCOGS_TOKEN:-}" ]; then
  COMMON_ENVS+=(-e DISCOGS_TOKEN="${DISCOGS_TOKEN}")
fi

if [ -n "${COVER_LIMIT:-}" ]; then
  COMMON_ENVS+=(-e COVER_LIMIT="${COVER_LIMIT}")
fi

if [ -n "${DRY_RUN:-}" ]; then
  COMMON_ENVS+=(-e DRY_RUN="${DRY_RUN}")
fi

docker exec "${COMMON_ENVS[@]}" sonic_backend python scripts/db/import/import-album-groups.py
docker exec "${COMMON_ENVS[@]}" sonic_backend python scripts/db/import/import-metadata.py
docker exec "${COMMON_ENVS[@]}" sonic_backend python scripts/db/covers/update-spotify-missing-covers.py
docker exec "${COMMON_ENVS[@]}" sonic_backend python scripts/db/covers/update-covers.py

echo "✅ Render sync complete."
