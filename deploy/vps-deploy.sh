#!/usr/bin/env bash
#
# Idempotent Ubuntu VPS deploy / update script for AcademiTok.
#
# Usage:
#   cd /opt/academitok
#   bash deploy/vps-deploy.sh [--pull]
#
# Validates .env.production, takes a pre-deploy PostgreSQL snapshot when the
# database is already running, builds and starts the Compose stack, and verifies
# /api/health, /api/ready, and 404 /api/sentry-test before exiting.

set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.production}"
PULL=0

for arg in "$@"; do
  case "${arg}" in
    --pull) PULL=1 ;;
    *)
      echo "Unknown argument: ${arg}" >&2
      echo "Usage: $0 [--pull]" >&2
      exit 1
      ;;
  esac
done

if [ ! -f "${ENV_FILE}" ]; then
  echo "ERROR: ${ENV_FILE} not found." >&2
  echo "Create it from deploy/.env.production.example and run: chmod 600 ${ENV_FILE}" >&2
  exit 1
fi

# Enforce strict file permissions on secrets file
PERMS="$(stat -c '%a' "${ENV_FILE}" 2>/dev/null || stat -f '%Lp' "${ENV_FILE}")"
if [ "${PERMS}" != "600" ] && [ "${PERMS}" != "400" ]; then
  echo "[deploy] Tightening permissions on ${ENV_FILE} (${PERMS} -> 600)..."
  chmod 600 "${ENV_FILE}"
fi

# Load env values for pre-flight validation without leaking secrets to logs
set -a
# shellcheck source=/dev/null
. "${ENV_FILE}"
set +a

missing=()
for var in APP_DOMAIN POSTGRES_PASSWORD OPENALEX_MAILTO; do
  val="${!var:-}"
  if [ -z "${val}" ] || [[ "${val}" == *"replace"* ]] || [[ "${val}" == *"example.com"* ]]; then
    missing+=("${var}")
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "ERROR: ${ENV_FILE} is missing or still has placeholder values for: ${missing[*]}" >&2
  exit 1
fi

if [[ ! "${APP_DOMAIN}" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]]; then
  echo "ERROR: APP_DOMAIN must be a bare hostname without a scheme or path (got ${APP_DOMAIN})." >&2
  exit 1
fi

HOST_BACKUP_DIR="${HOST_BACKUP_DIR:-/var/backups/academitok}"
mkdir -p "${HOST_BACKUP_DIR}"

if [ "${PULL}" -eq 1 ]; then
  echo "[deploy] Pulling latest code..."
  git pull --ff-only
fi

# Take a pre-deploy safety backup if PostgreSQL is already up
if docker compose --env-file "${ENV_FILE}" ps --status running --services 2>/dev/null | grep -qx "postgres-backup"; then
  echo "[deploy] Taking pre-deploy PostgreSQL safety backup..."
  docker compose --env-file "${ENV_FILE}" exec -T postgres-backup sh /usr/local/bin/db-backup.sh
fi

echo "[deploy] Building and starting AcademiTok stack..."
docker compose --env-file "${ENV_FILE}" up -d --build --remove-orphans

BIND_PORT="${APP_BIND_PORT:-3000}"
LOCAL_URL="http://127.0.0.1:${BIND_PORT}"

echo "[deploy] Waiting for ${LOCAL_URL}/api/health and /api/ready..."
healthy=0
for _ in $(seq 1 40); do
  if [ "$(curl -fsS "${LOCAL_URL}/api/health" 2>/dev/null || true)" = "OK" ] \
    && [ "$(curl -fsS "${LOCAL_URL}/api/ready" 2>/dev/null || true)" = "OK" ]; then
    healthy=1
    break
  fi
  sleep 1
done

if [ "${healthy}" -ne 1 ]; then
  echo "ERROR: App did not become healthy in time. Recent logs:" >&2
  docker compose --env-file "${ENV_FILE}" logs --tail=80 app >&2
  exit 1
fi

SENTRY_STATUS="$(curl -s -o /dev/null -w '%{http_code}' "${LOCAL_URL}/api/sentry-test")"
if [ "${SENTRY_STATUS}" != "404" ]; then
  echo "ERROR: Expected 404 for /api/sentry-test, got ${SENTRY_STATUS}" >&2
  exit 1
fi

echo "[deploy] Checking public HTTPS endpoint https://${APP_DOMAIN}/api/health..."
if curl -fsS --max-time 10 "https://${APP_DOMAIN}/api/health" >/dev/null 2>&1; then
  echo "  ✓ Public HTTPS verified: https://${APP_DOMAIN}"
else
  echo "ERROR: Local app is healthy, but https://${APP_DOMAIN}/api/health did not respond." >&2
  echo "  Verify DNS A/AAAA points at this VPS, then rerun this script." >&2
  echo "  Current Caddy state:" >&2
  docker compose --env-file "${ENV_FILE}" logs --tail=40 caddy >&2
  exit 1
fi

echo ""
echo "✅ Deploy succeeded."
docker compose --env-file "${ENV_FILE}" ps
