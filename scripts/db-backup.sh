#!/usr/bin/env sh
#
# Creates a verified, compressed PostgreSQL custom-format backup with SHA-256
# checksum and retention pruning.
#
# Required env:
#   DATABASE_URL      PostgreSQL connection URI
# Optional env:
#   BACKUP_DIR        Output directory (default: ./backups)
#   RETENTION_DAYS    Delete backups older than N days (default: 14)

set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL must be set" >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BASENAME="academitok-${TIMESTAMP}.dump"
TARGET="${BACKUP_DIR}/${BASENAME}"
TMP_TARGET="${TARGET}.tmp"

mkdir -p "${BACKUP_DIR}"
trap 'rm -f "${TMP_TARGET}"' EXIT

echo "[db-backup] Dumping PostgreSQL database to ${TARGET}..."
pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file="${TMP_TARGET}" \
  "${DATABASE_URL}"

echo "[db-backup] Verifying archive table of contents..."
pg_restore --list "${TMP_TARGET}" >/dev/null

mv "${TMP_TARGET}" "${TARGET}"

if command -v sha256sum >/dev/null 2>&1; then
  (cd "${BACKUP_DIR}" && sha256sum "${BASENAME}" > "${BASENAME}.sha256")
elif command -v shasum >/dev/null 2>&1; then
  (cd "${BACKUP_DIR}" && shasum -a 256 "${BASENAME}" > "${BASENAME}.sha256")
else
  echo "ERROR: neither sha256sum nor shasum is installed" >&2
  exit 1
fi

if [ "${RETENTION_DAYS}" -gt 0 ] 2>/dev/null; then
  find "${BACKUP_DIR}" -type f \( -name "academitok-*.dump" -o -name "academitok-*.dump.sha256" \) -mtime "+${RETENTION_DAYS}" -delete
fi

SIZE_BYTES="$(wc -c < "${TARGET}" | tr -d ' ')"
echo "[db-backup] Backup verified: ${TARGET} (${SIZE_BYTES} bytes)"
