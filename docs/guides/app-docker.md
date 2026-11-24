# App Docker Guide

This guide covers building and running the AcademiTok production container. Observability runs in LAOS and is documented separately.

## Build

```bash
docker build --target production -t academitok:latest .
```

## Run

Provide a production environment file (PostgreSQL `DATABASE_URL`, `AUTH_ORIGINS`, `OPENALEX_MAILTO`, and Resend mail credentials):

```bash
docker run --rm \
  -p 3000:3000 \
  --env-file .env \
  academitok:latest
```

For a complete local or staging stack with PostgreSQL and automated backups, use `docker-compose.yml`:

```bash
docker compose up -d --build
```

## Notes

- The `production` target runs as the non-root `bun` user and exposes a built-in `HEALTHCHECK` against `/api/health`.
- The `deps` stage uses `bun.lock` (`--frozen-lockfile`) and installs `git` for git-hosted dependencies without carrying build tools into the runtime stage.
- LAOS runs outside this repo: `https://github.com/dtechvision/laos`.
