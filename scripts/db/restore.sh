#!/bin/bash
# DB 복원 스크립트
# 사용법: ./scripts/db/restore.sh [backup_name]

set -e

if [ -z "$1" ]; then
  echo "❌ Error: Backup name required"
  echo ""
  echo "Usage: ./scripts/db/restore.sh <backup_name>"
  echo ""
  echo "Available backups:"
  ls -lh ./backups/*.sql.gz 2>/dev/null || echo "  (no backups found)"
  exit 1
fi

BACKUP_NAME=$1
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.sql"
BACKUP_FILE_GZ="${BACKUP_FILE}.gz"

if [ ! -f "${BACKUP_FILE_GZ}" ]; then
  echo "❌ Error: Backup file not found: ${BACKUP_FILE_GZ}"
  echo ""
  echo "Available backups:"
  ls -lh ./backups/*.sql.gz 2>/dev/null || echo "  (no backups found)"
  exit 1
fi

echo "🔄 Restoring database from backup..."
echo "📁 Backup file: ${BACKUP_FILE_GZ}"
echo ""

# 압축 해제
echo "📦 Decompressing backup..."
gunzip -k -f "${BACKUP_FILE_GZ}"

# DB 복원 전 확인
echo ""
read -p "⚠️  This will OVERWRITE the current database. Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Restore cancelled"
  rm -f "${BACKUP_FILE}"
  exit 1
fi

# 기존 데이터 삭제
echo "🗑️  Dropping existing database..."
docker exec sonic_db psql -U sonic -d postgres -c "DROP DATABASE IF EXISTS sonic_db;"
docker exec sonic_db psql -U sonic -d postgres -c "CREATE DATABASE sonic_db OWNER sonic;"

# 백업 복원
echo "📥 Restoring backup..."
docker exec -i sonic_db psql -U sonic -d sonic_db < "${BACKUP_FILE}"

# 압축 파일 정리
rm -f "${BACKUP_FILE}"

echo ""
echo "✅ Database restored successfully!"
echo "📊 Backup: ${BACKUP_NAME}"
echo ""
echo "💡 Restart backend to apply changes:"
echo "   docker-compose restart backend"
