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
  echo "❌ RENDER_DATABASE_URL not set. Skipping Render backup."
  exit 0
fi

BACKUP_DIR="${ROOT_DIR}/backups/render"
STAMP_DATE="$(date +%Y%m%d)"
STAMP_TIME="$(date +%H%M%S)"
TARGET_DIR="${BACKUP_DIR}/${STAMP_DATE}"
mkdir -p "${TARGET_DIR}"

OUT_FILE="${TARGET_DIR}/render_${STAMP_DATE}_${STAMP_TIME}.sql.gz"
LATEST_FILE="${ROOT_DIR}/backups/latest.sql.gz"

# pg_dump expects a postgresql:// URL
PG_URL="${RENDER_DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}"
PG_URL="$(echo "$PG_URL" | xargs)"

echo "📦 Backing up Render DB..."
# Use pg_dump matching Render's major version; avoid roles/privileges in local restore.
docker run -i --rm postgres:18 pg_dump --no-owner --no-privileges "${PG_URL}" | gzip > "${OUT_FILE}"
echo "✅ Render backup saved: ${OUT_FILE}"
# Keep a copy at backups/latest.sql.gz so it can be committed.
cp "${OUT_FILE}" "${LATEST_FILE}"
echo "✅ Render backup copied to: ${LATEST_FILE}"

# Keep only the most recent 10 backups
BACKUP_FILES=($(find "${BACKUP_DIR}" -type f -name "*.sql.gz" -print0 | xargs -0 ls -1t 2>/dev/null || true))
if [ ${#BACKUP_FILES[@]} -gt 10 ]; then
  for ((i=10; i<${#BACKUP_FILES[@]}; i++)); do
    rm -f "${BACKUP_FILES[$i]}"
  done
fi
