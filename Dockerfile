# Dockerfile for AcademiTok (Effect + TanStack Start + Nitro Bun preset)

# Base image pinned to the repository Bun minor release
FROM oven/bun:1.4.4-slim AS base
WORKDIR /app

# Install dependencies stage (git + ca-certificates required for git-hosted deps)
FROM base AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json bun.lock ./
COPY patches ./patches
COPY scripts/install-git-hooks.sh ./scripts/install-git-hooks.sh
RUN bun install --frozen-lockfile

# Development stage with hot reload
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["bun", "run", "dev"]

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Production stage — minimal non-root runtime serving Nitro's self-contained .output
FROM base AS production
ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=3000
COPY --from=builder --chown=bun:bun /app/.output ./.output
COPY --from=builder --chown=bun:bun /app/package.json ./package.json
USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["bun", "run", ".output/server/index.mjs"]
