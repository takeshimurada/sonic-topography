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
  echo "❌ RENDER_DATABASE_URL not set. Aborting."
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q '^sonic_db$'; then
  echo "❌ sonic_db container not running."
  exit 1
fi

PG_URL="${RENDER_DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}"
PG_URL="$(echo "$PG_URL" | xargs)"

LOCAL_SQL=$(cat <<'SQL'
SELECT
  (SELECT COUNT(*) FROM album_groups) AS total_albums,
  (SELECT SUM(cnt-1) FROM (
     SELECT COUNT(*) AS cnt
     FROM album_groups
     GROUP BY lower(trim(title)), lower(trim(primary_artist_display)), original_year
     HAVING COUNT(*) > 1
   ) s) AS duplicate_rows;
SQL
)

RENDER_SQL="${LOCAL_SQL}"

echo "📍 Local DB (sonic_db)"
docker exec -i sonic_db psql -U sonic -d sonic_db -t -A -F"," -c "${LOCAL_SQL}" | awk -F',' '{
  printf "  total_albums=%s\n  duplicate_rows=%s\n", $1, ($2==""?0:$2)
}'

echo ""
echo "☁️  Render DB"
docker run -i --rm postgres:15 psql "${PG_URL}" -t -A -F"," -c "${RENDER_SQL}" | awk -F',' '{
  printf "  total_albums=%s\n  duplicate_rows=%s\n", $1, ($2==""?0:$2)
}'
