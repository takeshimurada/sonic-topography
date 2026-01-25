#!/bin/bash
# DB 백업 스크립트
# 사용법: ./scripts/db/backup/backup.sh [backup_name]

set -e

BACKUP_NAME=${1:-"backup_$(date +%Y%m%d_%H%M%S)"}
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.sql"

echo "🔄 Creating database backup..."
echo "📁 Backup file: ${BACKUP_FILE}"

# 백업 디렉토리 생성
mkdir -p "${BACKUP_DIR}"

# PostgreSQL 백업
docker exec sonic_db pg_dump -U sonic -d sonic_db > "${BACKUP_FILE}"

# 압축
gzip -f "${BACKUP_FILE}"
BACKUP_FILE_GZ="${BACKUP_FILE}.gz"

echo ""
echo "✅ Backup completed successfully!"
echo "📦 File: ${BACKUP_FILE_GZ}"
echo "📊 Size: $(du -h "${BACKUP_FILE_GZ}" | cut -f1)"
echo ""
echo "💡 To restore this backup:"
echo "   ./scripts/db/restore/restore.sh ${BACKUP_NAME}"
