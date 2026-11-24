# Deployment & Operations Runbook (Ubuntu VPS)

This guide covers launching AcademiTok on an Ubuntu 22.04 / 24.04 VPS with Docker Compose, automatic HTTPS via Caddy, PostgreSQL 16, verified daily backups, strict startup environment validation, and end-to-end smoke testing.

## Architecture on the VPS

- **Caddy (`caddy:2-alpine`)** binds public ports `80` and `443`, provisions and renews Let's Encrypt TLS certificates automatically, sets security headers, and proxies to `app:3000` over the private Docker bridge network.
- **App (`Dockerfile`, `production` stage)** runs as the non-root `bun` user, binds only `127.0.0.1:3000` for local health checks, and validates all required production environment variables at boot before opening a listening socket.
- **PostgreSQL (`postgres:16-alpine`)** is reachable only inside the private Docker network with persistent storage in the `postgres_data` volume.
- **Backup sidecar (`postgres-backup`)** runs `scripts/db-backup.sh` daily into `/var/backups/academitok` with SHA-256 checksums and 14-day retention.

## Required Production Environment Variables

When `NODE_ENV=production`, `src/lib/server-env.ts` (invoked by Nitro's boot plugin `src/server/validate-env.ts`) aborts startup immediately if any required variable is missing or malformed:

| Variable                    | Required in prod    | Purpose                                                                   |
| --------------------------- | ------------------- | ------------------------------------------------------------------------- |
| `APP_DOMAIN`                | Yes (Compose/Caddy) | Public hostname with DNS A/AAAA pointing at the VPS                       |
| `POSTGRES_PASSWORD`         | Yes (Compose)       | Strong PostgreSQL password (`openssl rand -hex 24`)                       |
| `NODE_ENV`                  | Yes (`production`)  | Enables `Secure` cookies, strict env checks, and disables PGlite fallback |
| `DATABASE_URL`              | Yes                 | PostgreSQL URI (wired automatically by `docker-compose.yml`)              |
| `AUTH_ORIGINS`              | Yes                 | Comma-separated bare origins allowed in sign-in magic links               |
| `OPENALEX_MAILTO`           | Yes                 | Email identifying requests in OpenAlex's polite pool                      |
| `RESEND_API_KEY`            | Yes                 | Resend API key for sign-in email delivery                                 |
| `MAIL_FROM`                 | Yes                 | Sender identity containing a valid email address                          |
| `SENTRY_DSN`                | Optional            | Valid `http(s)://` DSN for error reporting                                |
| `SENTRY_TRACES_SAMPLE_RATE` | Optional            | Finite number in `[0, 1]`                                                 |
| `OTLP_ENDPOINT`             | Optional            | Tempo OTLP base URL                                                       |
| `LOKI_OTLP_ENDPOINT`        | Optional            | Loki OTLP base URL                                                        |

## Ubuntu VPS Launch Steps

### 1. Point DNS at the VPS

Create an `A` (and optionally `AAAA`) record for your domain (e.g. `academitok.example.com` or `staging.academitok.example.com`) pointing to the VPS IP address.

### 2. Bootstrap the Ubuntu VPS (one time)

SSH into the VPS and run the bootstrap script (installs Docker Engine + Compose plugin, configures UFW for SSH + 80/443 only, enables unattended security upgrades, and creates `/opt/academitok` and `/var/backups/academitok`):

```bash
git clone https://github.com/dragmakex/academitok.git /opt/academitok
cd /opt/academitok
sudo bash deploy/vps-bootstrap.sh
```

_(Optional) Install the systemd unit so the stack starts automatically after reboots:_

```bash
sudo cp deploy/academitok.service /etc/systemd/system/academitok.service
sudo systemctl daemon-reload
sudo systemctl enable academitok.service
```

### 3. Configure `.env.production`

```bash
cd /opt/academitok
cp deploy/.env.production.example .env.production
chmod 600 .env.production
# Generate a strong DB password:
openssl rand -hex 24
# Edit .env.production with real values:
nano .env.production
```

### 4. Deploy & Verify

```bash
cd /opt/academitok
bash deploy/vps-deploy.sh
```

For subsequent updates (takes a pre-deploy PostgreSQL snapshot automatically):

```bash
cd /opt/academitok
bash deploy/vps-deploy.sh --pull
```

### 5. Run the End-to-End Smoke Test Against the VPS

From your laptop (or any machine with Playwright installed):

```bash
BASE_URL="https://academitok.example.com" bun run smoke:staging
```

## Health Endpoints

- `GET /api/health` — process liveness (`200 OK`)
- `GET /api/ready` — database readiness (`SELECT 1`, `200 OK`)

## Backups & Restore Drills

Automated daily compressed dumps (`.dump` + `.sha256`) land in `/var/backups/academitok` (configurable via `HOST_BACKUP_DIR`). Sync `/var/backups/academitok` off-host (e.g. `rclone` to S3/Backblaze B2 or `rsync` to another machine) so backups survive VPS loss.

```bash
# Trigger an on-demand backup on the VPS
docker compose --env-file .env.production exec -T postgres-backup sh /usr/local/bin/db-backup.sh

# Restore a backup into PostgreSQL
docker compose --env-file .env.production exec -T postgres-backup \
  sh -c 'DATABASE_URL="$DATABASE_URL" sh /usr/local/bin/db-restore.sh --yes /backups/academitok-<timestamp>.dump'
```

_(For local / direct PostgreSQL restore outside Docker, use `DATABASE_URL="postgresql://..." bun run db:restore -- --yes ./backups/academitok-<timestamp>.dump`.)_
