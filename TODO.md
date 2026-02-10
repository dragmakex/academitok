# Infrastructure Setup - Observability & Deployment

Atomic, verifiable tasks to set up complete observability infrastructure.

---

## LAOS Policy (Required)

- LAOS is **never vendored** into this repo and must **not** appear in git history here.
- Always use LAOS from the upstream git repo: `https://github.com/dtechvision/laos`.
- Any fixes or improvements to the stack must be **upstreamed to LAOS**, not patched locally.

## Quick Start (Experienced Engineers)

```bash
# 1. Start LAOS stack (external repo)
# https://github.com/dtechvision/laos
git clone https://github.com/dtechvision/laos.git
cd laos
docker compose up -d

# 2. Initialize Sentry (first time, in LAOS repo)
docker compose exec sentry-web sentry upgrade --noinput
docker compose exec sentry-web sentry createuser --email admin@localhost --password admin123 --superuser --no-input

# 3. Get DSNs/Keys from UIs
# - Sentry: http://localhost:9000 → Create project → Copy DSN
# - PostHog: http://localhost:8001 → Setup → Copy API key

# 4. Add to .env
echo "SENTRY_DSN=http://...@localhost:9000/1" >> /path/to/effect-tanstack-start/.env
echo "VITE_SENTRY_DSN=http://...@localhost:9000/1" >> /path/to/effect-tanstack-start/.env

# 5. Wire into app (see Phase 2-3 below)

# 6. Verify
curl http://localhost:3100/ready  # Loki
curl http://localhost:3200/ready  # Tempo
curl http://localhost:9090/-/ready  # Prometheus
```

---

## Architecture Summary

```
Frontend (React)                         Backend (Effect-TS)
├── Sentry (errors + replay)             ├── Otlp.layer() → Tempo (traces)
├── PostHog (analytics + flags)          │                → Loki (logs)
└── PostHog (session recording)          │                → Prometheus (metrics)
                                         ├── Sentry (errors + profiling)
                                         └── PostHog (server events)
```

**Tool Responsibilities:**

- **Grafana** → "Is it broken?" (system health, SLOs)
- **Sentry** → "Why is it broken?" (errors, profiling)
- **PostHog** → "What did it do to users?" (funnels, replay)

---

## Phase 1: Infrastructure (LAOS)

### 1.1 Generate Secrets

```bash
# Use LAOS stack repo
# https://github.com/dtechvision/laos
git clone https://github.com/dtechvision/laos.git
cd laos
```

**Verify:** `docker compose ps` → all services running/healthy

- [ ] Done

### 1.2 Start Docker Stack

```bash
docker compose up -d
```

**Verify:** `docker compose ps` → all services running/healthy (~2-3 min for full startup)

- [ ] Done

### 1.3 Verify Grafana Stack

| Service    | URL                           | Check               |
| ---------- | ----------------------------- | ------------------- |
| Grafana    | http://localhost:3001         | Login (admin/admin) |
| Loki       | http://localhost:3100/ready   | `ready`             |
| Tempo      | http://localhost:3200/ready   | `ready`             |
| Prometheus | http://localhost:9090/-/ready | `ready`             |

- [ ] Done

### 1.4 Initialize Sentry

```bash
docker compose exec sentry-web sentry upgrade --noinput
docker compose exec sentry-web sentry createuser \
  --email admin@localhost --password admin123 --superuser --no-input
```

**Verify:** http://localhost:9000 → login works

- [ ] Done

### 1.5 Configure Sentry Project

1. Login to http://localhost:9000
2. Create Organization → Create Project (JavaScript/React)
3. Copy DSN from project settings
4. Add to `.env`:
   ```bash
   SENTRY_DSN=http://YOUR_KEY@localhost:9000/1
   VITE_SENTRY_DSN=http://YOUR_KEY@localhost:9000/1
   ```

- [ ] Done

### 1.6 Configure PostHog

1. Open http://localhost:8001
2. Complete setup wizard
3. Copy Project API Key
4. Verify in `.env`:
   ```bash
   VITE_POSTHOG_KEY=phc_YOUR_KEY
   VITE_POSTHOG_HOST=http://localhost:8001
   ```

- [ ] Done

---

## Phase 2: Server Observability (Effect Native)

> **Key:** Use `Otlp.layer()` for unified traces + logs + metrics in one layer.

### 2.1 Create Observability Module

**Create:** `src/lib/observability.ts`

```typescript
/**
 * Unified observability - traces, logs, metrics via OTLP.
 */
import * as Otlp from "@effect/opentelemetry/Otlp"
import { NodeHttpClient } from "@effect/platform-node"
import { Layer } from "effect"

export const ObservabilityLive = Otlp
  .layer({
    baseUrl: process.env.OTLP_ENDPOINT ?? "http://localhost:4318",
    resource: {
      serviceName: "effect-tanstack-start",
      serviceVersion: process.env.npm_package_version,
      attributes: {
        "deployment.environment": process.env.NODE_ENV ?? "development",
      },
    },
  })
  .pipe(Layer.provide(NodeHttpClient.layerUndici))
```

**Verify:** `bun run typecheck`

- [ ] Done

### 2.2 Create Server Entry

**Create:** `src/lib/server-init.ts`

```typescript
/**
 * Server-side initialization - call once at startup.
 */
import * as Sentry from "@sentry/node"

let initialized = false

export function initServer() {
  if (initialized) return

  // Sentry for error tracking (separate from OTLP observability)
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: 1.0,
    })
  }

  initialized = true
  console.log("[Server] Initialized (Sentry + Observability ready)")
}
```

- [ ] Done

### 2.3 Wire into API Runtime

Add to your server entry point (e.g., API handler or server.ts):

```typescript
import { ObservabilityLive } from "./lib/observability"
import { initServer } from "./lib/server-init"

initServer()

// Provide ObservabilityLive to your Effect programs
const program = myEffect.pipe(Effect.provide(ObservabilityLive))
```

- [ ] Done

### 2.4 Verify Server Observability

1. Start app: `bun run dev`
2. Make requests
3. Check Grafana (http://localhost:3001):
   - **Tempo:** Search for service `effect-tanstack-start`
   - **Loki:** Query `{service_name="effect-tanstack-start"}`

- [ ] Traces visible in Tempo
- [ ] Logs visible in Loki

---

## Phase 3: Client Observability

### 3.1 Create Client Init Module

**Create:** `src/lib/client-init.ts`

```typescript
/**
 * Client-side telemetry initialization.
 */
import * as Sentry from "@sentry/react"
import posthog from "posthog-js"

let initialized = false

export function initClient() {
  if (initialized || typeof window === "undefined") return

  // Sentry
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
    })
  }

  // PostHog
  if (import.meta.env.VITE_POSTHOG_KEY) {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
      api_host: import.meta.env.VITE_POSTHOG_HOST ?? "http://localhost:8001",
      capture_pageview: true,
      capture_pageleave: true,
    })
  }

  initialized = true
}

export const SentryErrorBoundary = Sentry.ErrorBoundary
```

- [ ] Done

### 3.2 Wire into Root Route

**Edit:** `src/routes/__root.tsx`

```typescript
import { initClient, SentryErrorBoundary } from "../lib/client-init"

// Initialize on client
if (typeof window !== "undefined") {
  initClient()
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <SentryErrorBoundary
          fallback={
            <div>
              Error occurred
            </div>
          }
        >
          <RegistryProvider defaultIdleTTL={60_000}>
            {children}
          </RegistryProvider>
        </SentryErrorBoundary>
        <Scripts />
      </body>
    </html>
  )
}
```

- [ ] Done

### 3.3 Verify Client Observability

1. Open http://localhost:3000
2. Check browser console for init messages
3. Trigger test error: `throw new Error("Test")`
4. Check:
   - **Sentry** (http://localhost:9000): Error appears
   - **PostHog** (http://localhost:8001): Pageview event appears

- [ ] Errors in Sentry
- [ ] Events in PostHog

---

## Phase 4: Database Instrumentation

> **Goal:** See query performance in traces + aggregate metrics in Prometheus.
> **Profiling note:** Pyroscope profiling requires Node; Bun runs without profiling.

### 4.1 Install PG Instrumentation

```bash
bun add @opentelemetry/instrumentation-pg
```

- [ ] Done

### 4.2 Add to Server Init

**Edit:** `src/lib/server-init.ts`

```typescript
import { registerInstrumentations } from "@opentelemetry/instrumentation"
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg"

export function initServer() {
  if (initialized) return

  // Database instrumentation (before Sentry)
  registerInstrumentations({
    instrumentations: [
      new PgInstrumentation({
        enhancedDatabaseReporting: true,
      }),
    ],
  })

  // ... rest of init
}
```

**What you get in traces:**

- `db.statement` - Sanitized SQL
- `db.operation` - SELECT/INSERT/UPDATE/DELETE
- `db.sql.table` - Table name
- Duration per query

- [ ] Done

### 4.3 Add postgres_exporter (Optional - Aggregate Metrics)

**Edit (in LAOS repo):** `docker-compose.yml` - add service:

```yaml
postgres-exporter:
  image: prometheuscommunity/postgres-exporter:latest
  environment:
    DATA_SOURCE_NAME: "postgresql://user:pass@your-db-host:5432/dbname?sslmode=disable"
  ports:
    - "9187:9187"
  networks:
    - monitoring
```

**Edit (in LAOS repo):** `docker/prometheus/prometheus.yml` - add scrape:

```yaml
scrape_configs:
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
```

**Key metrics exposed:**

- `pg_stat_statements_calls` - Query execution count
- `pg_stat_statements_total_time_seconds` - Time per query
- `pg_stat_user_tables_seq_scan` - Sequential scans (missing index?)

- [ ] Done (optional)

### 4.4 Verify Database Instrumentation

1. Make requests that hit the database
2. Check Grafana/Tempo: DB spans appear within request traces
3. If using postgres_exporter: Check Prometheus for `pg_*` metrics

- [ ] DB spans visible in traces

---

## Phase 5: Deployment (Railway)

### 5.1 Create Health Endpoint

**Create:** `src/routes/api/health.ts`

```typescript
import { createAPIFileRoute } from "@tanstack/react-start/api"

export const APIRoute = createAPIFileRoute("/api/health")({
  GET: async () =>
    Response.json({ status: "ok", timestamp: new Date().toISOString() }),
})
```

- [ ] Done

### 5.2 Create Dockerfile

**Create:** `Dockerfile`

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Production
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["bun", "run", ".output/server/index.mjs"]
```

**Create:** `railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "DOCKERFILE" },
  "deploy": {
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 30
  }
}
```

- [ ] Done

### 5.3 Configure Railway Environment

```bash
railway init  # or railway link

# Set production observability endpoints
railway variables set NODE_ENV=production
railway variables set SENTRY_DSN="https://...@sentry.io/..."
railway variables set VITE_SENTRY_DSN="https://...@sentry.io/..."
railway variables set VITE_POSTHOG_KEY="phc_..."
railway variables set VITE_POSTHOG_HOST="https://app.posthog.com"
railway variables set OTLP_ENDPOINT="https://your-grafana-cloud-otlp-endpoint"
```

**Note:** For production, use cloud-hosted services:

- Sentry Cloud (sentry.io)
- PostHog Cloud (app.posthog.com)
- Grafana Cloud (for OTLP endpoint)

- [ ] Done

### 5.4 Deploy

```bash
railway up
```

**Verify:** `curl https://YOUR_APP.up.railway.app/api/health`

- [ ] Done

---

## Verification Checklist

Run after completing all phases:

```bash
# Code quality
bun run typecheck && bun run lint && bun run test
```

### End-to-End Data Flow

| Signal         | Check                       | Location             |
| -------------- | --------------------------- | -------------------- |
| Traces         | Request spans with DB calls | Grafana → Tempo      |
| Logs           | Structured log entries      | Grafana → Loki       |
| Metrics        | Counter/gauge values        | Grafana → Prometheus |
| Errors         | Test error captured         | Sentry               |
| Analytics      | Pageview event              | PostHog              |
| Session Replay | Recording available         | PostHog              |

### Quick Verification Commands

```bash
# Loki logs
curl -G http://localhost:3100/loki/api/v1/query \
  --data-urlencode 'query={service_name="effect-tanstack-start"}'

# Prometheus metrics
curl http://localhost:9090/api/v1/query?query=up

# Tempo traces (via Grafana UI)
# http://localhost:3001 → Explore → Tempo → Search
```

- [ ] All signals flowing

---

## Troubleshooting

### Docker Stack Issues

```bash
# Port conflicts
lsof -i :3001 -i :9000 -i :8001

# Reset everything
docker compose down -v && docker compose up -d

# Check logs
docker compose logs -f sentry-web
docker compose logs -f posthog
```

### No Data in Grafana

1. Check OTLP endpoint: `curl http://localhost:4318/v1/traces` (should accept POST)
2. Verify Tempo is receiving: `docker compose logs tempo`
3. Check service name matches query

### Sentry Not Receiving

1. Verify DSN in `.env`
2. Check network: `curl http://localhost:9000/api/0/`
3. Check browser console for Sentry errors

### PostHog Not Receiving

1. Verify API key in `.env`
2. Enable debug: `posthog.debug()` in console
3. Check Kafka health: `docker compose logs posthog-kafka`

### Railway Deployment

```bash
# Check logs
railway logs

# Verify build locally
bun run build && bun run start
```

---

## Reference: Environment Variables

```bash
# .env template
NODE_ENV=development

# Sentry
SENTRY_DSN=
VITE_SENTRY_DSN=
SENTRY_SECRET_KEY=  # For self-hosted only

# PostHog
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=http://localhost:8001
POSTHOG_SECRET_KEY=  # For self-hosted only

# Grafana Stack (OTLP)
OTLP_ENDPOINT=http://localhost:4318

# Database (if applicable)
DATABASE_URL=
```

---

## Reference: File Structure

```
src/lib/
├── observability.ts    # Otlp.layer() - traces, logs, metrics
├── server-init.ts      # Server startup (Sentry + DB instrumentation)
└── client-init.ts      # Client startup (Sentry + PostHog)

# Observability stack lives in:
# https://github.com/dtechvision/laos
```
