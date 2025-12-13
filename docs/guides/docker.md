# Docker Guide

Complete guide to running the full stack with Docker Compose.

## Overview

```mermaid
graph TB
    subgraph "Docker Compose Stack"
        App[Application<br/>Port 3000]

        subgraph "Monitoring"
            Grafana[Grafana<br/>Port 3001]
            Loki[Loki<br/>Port 3100]
            Tempo[Tempo<br/>4317/4318]
            Prom[Prometheus<br/>Port 9090]
        end

        subgraph "Error Tracking"
            Sentry[Sentry<br/>Port 9000]
        end

        subgraph "Analytics"
            PostHog[PostHog<br/>Port 8001]
        end
    end

    App --> Loki
    App --> Tempo
    App --> Sentry
    App --> PostHog

    Loki --> Grafana
    Tempo --> Grafana
    Prom --> Grafana
```

See [DOCKER_SETUP.md](../../DOCKER_SETUP.md) for complete documentation.

## Quick Start

```bash
# Generate secret keys
openssl rand -hex 32  # Sentry
openssl rand -hex 32  # PostHog

# Configure environment
cp .env.docker .env
# Edit .env with secret keys

# Start all services
docker-compose up

# View logs
docker-compose logs -f app
```

## Services

| Service | URL | Purpose |
|---------|-----|---------|
| App | http://localhost:3000 | Your application |
| Grafana | http://localhost:3001 | Dashboards (admin/admin) |
| Sentry | http://localhost:9000 | Error tracking |
| PostHog | http://localhost:8001 | Analytics |
| Prometheus | http://localhost:9090 | Metrics |

## Common Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Rebuild app
docker-compose up -d --build app

# View logs
docker-compose logs -f

# Execute commands
docker-compose exec app bun run test
```

## Development Workflow

1. **Edit Code** - Changes auto-reload via hot module replacement
2. **View Logs** - `docker-compose logs -f app`
3. **Run Tests** - `docker-compose exec app bun run test`
4. **View Metrics** - Open Grafana at http://localhost:3001

## Troubleshooting

See [DOCKER_SETUP.md - Troubleshooting](../../DOCKER_SETUP.md#troubleshooting)
