#!/usr/bin/env bash
#
# One-time Ubuntu 22.04 / 24.04 VPS bootstrap for AcademiTok.
# Run as root (or via sudo):
#   sudo bash deploy/vps-bootstrap.sh
#
# Idempotently installs Docker Engine + Compose plugin, configures UFW to allow
# only SSH/80/443, enables unattended security upgrades, and prepares host
# directories for the app and PostgreSQL backups.

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: Run this script as root or with sudo." >&2
  exit 1
fi

APP_DIR="${APP_DIR:-/opt/academitok}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/academitok}"
DEPLOY_USER="${DEPLOY_USER:-${SUDO_USER:-}}"

echo "[bootstrap] Updating apt packages and installing prerequisites..."
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  git \
  gnupg \
  ufw \
  unattended-upgrades

if ! command -v docker >/dev/null 2>&1; then
  echo "[bootstrap] Installing Docker Engine & Compose plugin..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  # shellcheck source=/dev/null
  . /etc/os-release
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list

  apt-get update
  apt-get install -y --no-install-recommends \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin
fi

systemctl enable --now docker

if [ -n "${DEPLOY_USER}" ] && id "${DEPLOY_USER}" >/dev/null 2>&1; then
  echo "[bootstrap] Adding ${DEPLOY_USER} to docker group..."
  usermod -aG docker "${DEPLOY_USER}"
fi

echo "[bootstrap] Configuring UFW firewall (SSH, HTTP 80, HTTPS 443 only)..."
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "[bootstrap] Preparing ${APP_DIR} and ${BACKUP_DIR}..."
mkdir -p "${APP_DIR}" "${BACKUP_DIR}"
if [ -n "${DEPLOY_USER}" ] && id "${DEPLOY_USER}" >/dev/null 2>&1; then
  chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}"
fi
chmod 750 "${BACKUP_DIR}"

echo "[bootstrap] Enabling unattended security upgrades..."
dpkg-reconfigure -f noninteractive unattended-upgrades || true

echo ""
echo "✅ Ubuntu VPS bootstrap complete."
echo "Next steps:"
echo "  1. Clone the repo into ${APP_DIR}"
echo "  2. Copy deploy/.env.production.example -> ${APP_DIR}/.env.production && chmod 600 ${APP_DIR}/.env.production"
echo "  3. Fill in real values in ${APP_DIR}/.env.production"
echo "  4. Run: cd ${APP_DIR} && bash deploy/vps-deploy.sh"
