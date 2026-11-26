#!/usr/bin/env sh
#
# Verifies checksum and archive integrity, then restores a PostgreSQL backup
# created by scripts/db-backup.sh.
#
# Usage:
#   DATABASE_URL="postgresql://..." scripts/db-restore.sh [--yes] <backup.dump>

set -eu

AUTO_CONFIRM=0
if [ "${1:-}" = "--yes" ]; then
  AUTO_CONFIRM=1
  shift
fi

BACKUP_FILE="${1:-}"
if [ -z "${BACKUP_FILE}" ] || [ ! -f "${BACKUP_FILE}" ]; then
  echo "Usage: DATABASE_URL=... $0 [--yes] <backup.dump>" >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL must be set" >&2
  exit 1
fi

CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "${CHECKSUM_FILE}" ]; then
  echo "[db-restore] Verifying SHA-256 checksum..."
  BACKUP_DIR="$(dirname "${BACKUP_FILE}")"
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "${BACKUP_DIR}" && sha256sum -c "$(basename "${CHECKSUM_FILE}")")
  elif command -v shasum >/dev/null 2>&1; then
    (cd "${BACKUP_DIR}" && shasum -a 256 -c "$(basename "${CHECKSUM_FILE}")")
  else
    echo "ERROR: neither sha256sum nor shasum is installed" >&2
    exit 1
  fi
fi

echo "[db-restore] Verifying archive readability..."
pg_restore --list "${BACKUP_FILE}" >/dev/null

if [ "${AUTO_CONFIRM}" -ne 1 ]; then
  printf "Restore %s into the configured database? This overwrites existing tables. [y/N] " "${BACKUP_FILE}"
  read -r REPLY
  case "${REPLY}" in
    y|Y|yes|YES) ;;
    *)
      echo "[db-restore] Aborted."
      exit 1
      ;;
  esac
fi

echo "[db-restore] Restoring ${BACKUP_FILE}..."
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  --dbname="${DATABASE_URL}" \
  "${BACKUP_FILE}"

echo "[db-restore] Restore completed successfully."
