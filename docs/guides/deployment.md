# Deployment & Operations Runbook

This guide covers launching AcademiTok into staging and production with PostgreSQL, automated backups, strict startup environment validation, and end-to-end smoke testing.

## Required Production Environment Variables

When `NODE_ENV=production`, `src/lib/server-env.ts` validates configuration at boot and aborts immediately if any required variable is missing or malformed:

| Variable                    | Required in prod   | Purpose                                                                 |
| --------------------------- | ------------------ | ----------------------------------------------------------------------- |
| `NODE_ENV`                  | Yes (`production`) | Enables secure cookies, strict env checks, and disables PGlite fallback |
| `DATABASE_URL`              | Yes                | PostgreSQL URI (`postgres://` or `postgresql://`)                       |
| `AUTH_ORIGINS`              | Yes                | Comma-separated bare origins allowed in sign-in magic links             |
| `OPENALEX_MAILTO`           | Yes                | Email identifying requests in OpenAlex's polite pool                    |
| `RESEND_API_KEY`            | Yes                | Resend API key for sign-in email delivery                               |
| `MAIL_FROM`                 | Yes                | Sender identity containing a valid email address                        |
| `SENTRY_DSN`                | Optional           | Valid `http(s)://` DSN for error reporting                              |
| `SENTRY_TRACES_SAMPLE_RATE` | Optional           | Finite number in `[0, 1]`                                               |
| `OTLP_ENDPOINT`             | Optional           | Tempo OTLP base URL                                                     |
| `LOKI_OTLP_ENDPOINT`        | Optional           | Loki OTLP base URL                                                      |

## Container Stack (PostgreSQL + Backups)

`docker-compose.yml` runs three services:

1. `postgres` — PostgreSQL 16 with persistent volume and `pg_isready` healthcheck
2. `app` — AcademiTok production container (`Dockerfile`, non-root `bun` user, `/api/health` healthcheck)
3. `postgres-backup` — periodic compressed `pg_dump` snapshots with SHA-256 verification and 14-day retention

```bash
docker compose up -d --build
```

## Database Provisioning, Backups, and Restore Drills

On first connection, `ReaderStateRepository` applies idempotent DDL for `papers`, `impressions`, `reactions`, `reader_profiles`, `feed_sessions`, `accounts`, `account_readers`, and `login_tokens`.

```bash
# Create a verified compressed dump + .sha256 checksum
DATABASE_URL="postgresql://..." bun run db:backup

# Verify restore into a staging/recovery database
DATABASE_URL="postgresql://..." bun run db:restore -- --yes ./backups/academitok-<timestamp>.dump
```

## Health Endpoints

- `GET /api/health` — process liveness (`200 OK`)
- `GET /api/ready` — database readiness (`SELECT 1`, `200 OK`)

## End-to-End Staging Smoke Test

Run the automated smoke test against any deployed staging URL:

```bash
BASE_URL="http://127.0.0.1:3000" bun run smoke:staging
```
