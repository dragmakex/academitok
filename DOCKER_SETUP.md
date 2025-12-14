# Docker Setup Guide

This guide explains how to run the complete application stack with Docker Compose, including the app with hot reload, monitoring (Grafana stack), error tracking (Sentry), and analytics (PostHog).

## Table of Contents

- [Quick Start](#quick-start)
- [Services Overview](#services-overview)
- [Configuration](#configuration)
- [Accessing Services](#accessing-services)
- [Development Workflow](#development-workflow)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)
- At least 8GB RAM available for Docker

### 2. Generate Secret Keys

```bash
# Generate Sentry secret key
openssl rand -hex 32

# Generate PostHog secret key
openssl rand -hex 32
```

### 3. Configure Environment

Copy the example environment file and update the secret keys:

```bash
cp .env.docker .env
```

Edit `.env` and replace the placeholder secret keys with the ones you generated.

### 4. Start the Stack

```bash
# Start all services
docker-compose up

# Or run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f app
```

### 5. Wait for Services to Initialize

First-time startup can take 5-10 minutes as services initialize databases and configurations.

Monitor the startup:

```bash
# Check service health
docker-compose ps

# Follow logs
docker-compose logs -f posthog sentry-web
```

### 6. Access the Application

Once all services are healthy:

- **Application**: http://localhost:3000
- **Grafana**: http://localhost:3001 (admin/admin)
- **Sentry**: http://localhost:9000
- **PostHog**: http://localhost:8001

---

## Services Overview

### Application Services

| Service | Port | Description                                     |
| ------- | ---- | ----------------------------------------------- |
| **app** | 3000 | Your TanStack Start application with hot reload |

### Monitoring Stack (Grafana)

| Service        | Port             | Description                  |
| -------------- | ---------------- | ---------------------------- |
| **grafana**    | 3001             | Visualization and dashboards |
| **loki**       | 3100             | Log aggregation              |
| **tempo**      | 3200, 4317, 4318 | Distributed tracing          |
| **prometheus** | 9090             | Metrics collection           |

### Error Tracking (Sentry Self-Hosted)

| Service           | Port | Description              |
| ----------------- | ---- | ------------------------ |
| **sentry-web**    | 9000 | Sentry web interface     |
| **sentry-worker** | -    | Background job processor |
| **sentry-cron**   | -    | Scheduled tasks          |
| **postgres**      | 5432 | Database for Sentry      |
| **redis**         | 6379 | Cache for Sentry         |

### Analytics (PostHog Self-Hosted)

| Service                | Port       | Description                   |
| ---------------------- | ---------- | ----------------------------- |
| **posthog**            | 8001, 8002 | PostHog web interface and API |
| **posthog-worker**     | -          | Background job processor      |
| **posthog-postgres**   | 5432       | PostgreSQL database           |
| **posthog-clickhouse** | -          | ClickHouse for analytics      |
| **posthog-redis**      | 6379       | Redis cache                   |
| **posthog-kafka**      | 9092       | Event streaming               |
| **posthog-zookeeper**  | 2181       | Kafka coordination            |

---

## Configuration

### Environment Variables

The `.env` file contains all configuration. Key variables:

#### Application

```env
NODE_ENV=development
```

#### Sentry

```env
# Generate with: openssl rand -hex 32
SENTRY_SECRET_KEY=your-secret-key-here

# After first run, create a project and get DSN from http://localhost:9000
SENTRY_DSN=http://your-sentry-dsn@sentry-web:9000/1
```

#### PostHog

```env
# Client-side (browser)
VITE_POSTHOG_KEY=phc_your_key_here
VITE_POSTHOG_HOST=http://localhost:8001

# Server-side
POSTHOG_API_KEY=phc_your_key_here
POSTHOG_HOST=http://posthog:8000

# Generate with: openssl rand -hex 32 (min 32 chars)
POSTHOG_SECRET_KEY=your-posthog-secret-key-here
```

#### Grafana Stack

```env
LOKI_ENDPOINT=http://loki:3100/loki/api/v1/push
OTLP_ENDPOINT=http://tempo:4318/v1/traces
```

### Custom Configurations

#### Grafana Datasources

Edit `docker/grafana/provisioning/datasources/datasources.yml` to customize datasources.

#### Loki Configuration

Edit `docker/loki/loki-config.yaml` to adjust log retention, limits, etc.

#### Tempo Configuration

Edit `docker/tempo/tempo-config.yaml` to configure trace storage and sampling.

---

## Accessing Services

### First-Time Setup

#### 1. Sentry

1. Navigate to http://localhost:9000
2. Create admin account (first visit)
3. Create a new project
4. Copy the DSN and update `.env`:
   ```env
   SENTRY_DSN=http://your-key@localhost:9000/1
   ```
5. Restart the app: `docker-compose restart app`

#### 2. PostHog

1. Navigate to http://localhost:8001
2. Create admin account (first visit)
3. Get your Project API Key from Settings → Project → Project API Key
4. Update `.env`:
   ```env
   VITE_POSTHOG_KEY=phc_your_actual_key
   POSTHOG_API_KEY=phc_your_actual_key
   ```
5. Restart the app: `docker-compose restart app`

#### 3. Grafana

1. Navigate to http://localhost:3001
2. Login with `admin` / `admin`
3. (Optional) Change password when prompted
4. Datasources are pre-configured (Loki, Tempo, Prometheus)

**Explore Logs:**

- Go to Explore → Select "Loki"
- Query: `{job="effect-tanstack-start"}`

**Explore Traces:**

- Go to Explore → Select "Tempo"
- Use Search or TraceQL queries

---

## Development Workflow

### Hot Reload

The application supports hot reload - changes to your source code will automatically trigger a rebuild.

```bash
# Edit your code
vim src/routes/index.tsx

# Watch the logs
docker-compose logs -f app
```

### Running Commands Inside Containers

```bash
# Execute commands in the app container
docker-compose exec app bun run test

# Open a shell
docker-compose exec app sh

# Run a one-off command
docker-compose run --rm app bun add new-package
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f grafana
docker-compose logs -f posthog

# Last 100 lines
docker-compose logs --tail=100 app
```

### Restarting Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart app

# Rebuild and restart
docker-compose up -d --build app
```

### Stopping Services

```bash
# Stop all services (preserves data)
docker-compose stop

# Stop and remove containers (preserves data)
docker-compose down

# Stop and remove everything including volumes (DELETES ALL DATA)
docker-compose down -v
```

---

## Production Deployment

### 1. Update Environment

Create a production `.env` file:

```env
NODE_ENV=production

# Use strong secret keys
SENTRY_SECRET_KEY=<generate-with-openssl-rand-hex-32>
POSTHOG_SECRET_KEY=<generate-with-openssl-rand-hex-32>

# Use production endpoints if using cloud services
SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/7890123
VITE_POSTHOG_KEY=phc_production_key
VITE_POSTHOG_HOST=https://app.posthog.com
```

### 2. Build for Production

Update `docker-compose.yml` to use production target:

```yaml
app:
  build:
    context: .
    target: production  # Changed from development
  # ... rest of config
```

### 3. Resource Limits

Add resource limits to prevent services from consuming too much memory:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
```

### 4. Persistent Volumes

Ensure important data is persisted:

```bash
# Backup volumes
docker run --rm -v posthog-postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/posthog-backup.tar.gz /data

# Restore volumes
docker run --rm -v posthog-postgres-data:/data -v $(pwd):/backup alpine tar xzf /backup/posthog-backup.tar.gz -C /
```

### 5. Security Considerations

- Use secrets management (Docker secrets, Kubernetes secrets, etc.)
- Enable HTTPS/TLS
- Set up firewall rules
- Regular backups
- Update secret keys
- Use strong passwords

---

## Troubleshooting

### Services Won't Start

**Check system resources:**

```bash
# Docker resource usage
docker stats

# System resources
free -h  # Linux
top      # macOS/Linux
```

**Common issues:**

1. **Port conflicts**: Another service is using the port
   ```bash
   # Check what's using port 3000
   lsof -i :3000  # macOS/Linux
   netstat -ano | findstr :3000  # Windows
   ```

2. **Out of disk space**: Docker volumes are full
   ```bash
   # Check disk usage
   docker system df

   # Clean up
   docker system prune -a --volumes
   ```

3. **Memory issues**: Not enough RAM
   - Increase Docker memory limit (Docker Desktop → Settings → Resources)
   - Stop unused services

### PostHog Initialization Slow

PostHog requires ClickHouse to be fully initialized, which can take 5-10 minutes on first start.

```bash
# Check ClickHouse logs
docker-compose logs posthog-clickhouse

# Wait for this message:
# "Ready for connections"
```

### Sentry Database Migration Issues

```bash
# Run migrations manually
docker-compose exec sentry-web sentry upgrade

# Create superuser
docker-compose exec sentry-web sentry createuser
```

### Grafana Datasources Not Connecting

```bash
# Check if services are reachable
docker-compose exec grafana wget -O- http://loki:3100/ready
docker-compose exec grafana wget -O- http://tempo:3200/ready
docker-compose exec grafana wget -O- http://prometheus:9090/-/ready
```

### Application Logs Not Appearing in Loki

1. **Check Loki is receiving logs:**
   ```bash
   curl http://localhost:3100/ready
   ```

2. **Check application configuration:**
   ```bash
   docker-compose exec app env | grep LOKI
   ```

3. **View raw logs:**
   ```bash
   docker-compose logs app | grep -i loki
   ```

### Traces Not Appearing in Tempo

1. **Check Tempo is receiving traces:**
   ```bash
   curl http://localhost:3200/ready
   ```

2. **Verify OTLP endpoint:**
   ```bash
   docker-compose exec app env | grep OTLP
   ```

### Hot Reload Not Working

1. **Check file watching is enabled:**
   ```bash
   # Some systems require polling
   docker-compose exec app env | grep WATCH
   ```

2. **Restart the app service:**
   ```bash
   docker-compose restart app
   ```

### Reset Everything

If you need to start fresh:

```bash
# Stop all services and remove volumes (DELETES ALL DATA)
docker-compose down -v

# Remove all Docker images
docker-compose down --rmi all

# Start fresh
docker-compose up
```

---

## Useful Commands

```bash
# View all running containers
docker-compose ps

# Check container health
docker-compose ps --format "table {{.Service}}\t{{.Status}}\t{{.Health}}"

# Follow logs from multiple services
docker-compose logs -f app grafana posthog

# Execute a command in a container
docker-compose exec app bun run build

# Scale a service (if supported)
docker-compose up -d --scale posthog-worker=3

# View resource usage
docker stats

# Inspect a service
docker-compose inspect app

# View networks
docker network ls

# View volumes
docker volume ls
```

---

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Sentry Self-Hosted Guide](https://develop.sentry.dev/self-hosted/)
- [PostHog Self-Hosted Docs](https://posthog.com/docs/self-host)
- [Bun Docker Guide](https://bun.sh/guides/ecosystem/docker)

---

For testing and telemetry documentation, see [TESTING_AND_TELEMETRY.md](./TESTING_AND_TELEMETRY.md).
