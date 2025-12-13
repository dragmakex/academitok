# Effect TanStack Start

A modern, full-stack TypeScript application built with **Effect-TS**, **TanStack Start**, and **Bun**, featuring comprehensive testing, monitoring, and analytics out of the box.

## ✨ Features

### Core Stack
- 🚀 **[Bun](https://bun.sh)** - Fast JavaScript runtime and package manager
- ⚡ **[Effect-TS](https://effect.website)** - Powerful functional effect system
- 🎯 **[TanStack Start](https://tanstack.com/router/latest/docs/framework/react/start/getting-started)** - Full-stack React framework with SSR
- 🎨 **[Tailwind CSS 4](https://tailwindcss.com)** - Utility-first CSS framework
- 📦 **[@effect-atom](https://github.com/effect-ts-app/atom)** - Atomic state management
- 🔄 **[@effect/rpc](https://effect.website/docs/guides/rpc/overview)** - Type-safe client-server communication

### Testing & Quality
- 🧪 **[Vitest 4](https://vitest.dev)** - Fast unit testing with browser mode
- 🎭 **[@effect/vitest](https://effect.website/docs/guides/testing/vitest)** - Effect-based testing with TestContext
- 🌐 **Multi-Browser Testing** - Chromium, Firefox, WebKit via Playwright
- 📸 **Visual Regression Testing** - Screenshot comparison across browsers
- 🔍 **Component Testing** - Real browser testing for React components

### Observability & Analytics
- 📊 **[Grafana Stack](https://grafana.com)** - Complete monitoring solution
  - **Loki** - Log aggregation
  - **Tempo** - Distributed tracing
  - **Prometheus** - Metrics collection
  - **Grafana** - Unified dashboards
- 🐛 **[Sentry](https://sentry.io)** - Error tracking and performance monitoring (self-hosted)
- 📈 **[PostHog](https://posthog.com)** - Product analytics and feature flags (self-hosted)
- 🔭 **OpenTelemetry** - Distributed tracing and observability

### Infrastructure
- 🐳 **Docker Compose** - Complete local development stack
- 🔄 **Hot Reload** - Fast development with HMR
- 🏗️ **Production Ready** - Optimized builds and deployment configs

---

## 🚀 Quick Start

### Option 1: Local Development

```bash
# Install dependencies
bun install

# Install Playwright browsers for testing
bunx playwright install --with-deps

# Copy environment template
cp .env.example .env

# Start development server
bun run dev
```

Visit http://localhost:3000

### Option 2: Full Stack with Docker (Recommended)

```bash
# Generate secret keys
openssl rand -hex 32  # For SENTRY_SECRET_KEY
openssl rand -hex 32  # For POSTHOG_SECRET_KEY

# Configure environment
cp .env.docker .env
# Edit .env and update secret keys

# Start everything (app + monitoring + analytics)
docker-compose up
```

**Access Services:**
- 🌐 **Application**: http://localhost:3000
- 📊 **Grafana** (Logs, Traces, Metrics): http://localhost:3001 (admin/admin)
- 🐛 **Sentry** (Errors): http://localhost:9000
- 📈 **PostHog** (Analytics): http://localhost:8001
- 📉 **Prometheus** (Metrics): http://localhost:9090

📚 **See [DOCKER_SETUP.md](./DOCKER_SETUP.md) for complete Docker documentation**

---

## 📦 Project Structure

```
effect-tanstack-start/
├── docs/                          # Documentation
│   ├── architecture/              # Architecture and diagrams
│   │   └── overview.md            # System architecture
│   └── guides/                    # How-to guides
│       ├── getting-started.md     # Setup guide
│       ├── testing.md             # Testing guide
│       ├── telemetry.md           # Observability guide
│       ├── posthog.md            # Analytics guide
│       └── docker.md             # Docker guide
├── docker/                        # Docker configurations
├── src/
│   ├── api/                       # API schemas and clients
│   ├── lib/                       # Shared utilities
│   │   ├── logger-loki.ts         # Loki logging
│   │   ├── posthog-client.ts      # PostHog browser
│   │   ├── posthog-server.ts      # PostHog server
│   │   ├── telemetry-client.ts    # Sentry browser
│   │   └── telemetry-server.ts    # Sentry server
│   ├── routes/                    # File-based routing
│   ├── component/                 # Component tests
│   ├── visual/                    # Visual regression tests
│   └── *.test.ts                  # Unit tests
├── Dockerfile                     # Container build
├── docker-compose.yml             # Service orchestration
├── CONTRIBUTING.md                # Contribution guidelines
├── DOCKER_SETUP.md                # Docker documentation
└── TESTING_AND_TELEMETRY.md       # Testing & observability
```

---

## 🧪 Testing

```bash
# Run all tests
bun run test

# Run specific test suites
bun run test:unit        # Effect-based unit tests
bun run test:component   # Component tests (3 browsers)
bun run test:visual      # Visual regression tests

# Update visual regression baselines
bun run test:visual:update

# Watch mode
bun run test:watch

# Type checking
bun run typecheck
```

**Test Types:**
- **Unit Tests** - Effect-based tests with @effect/vitest
- **Component Tests** - Real browser testing with Playwright
- **Visual Regression** - Screenshot comparison across browsers

📚 **See [Testing Guide](./docs/guides/testing.md) for complete documentation**

---

## 🏗️ Building

```bash
# Build for production
bun run build

# Preview production build
bun run preview
```

---

## 📊 Monitoring & Observability

### Logs (Grafana Loki)

```typescript
import { Effect } from "effect"

const program = Effect.gen(function* () {
  yield* Effect.log("Application started")
  // Logs automatically sent to Loki
})
```

### Traces (OpenTelemetry + Tempo)

```typescript
import { Effect } from "effect"

const program = Effect.gen(function* () {
  // Your code here
}).pipe(
  Effect.withSpan("operationName", {
    attributes: { userId: "123" }
  })
)
```

### Error Tracking (Sentry)

```typescript
import { captureException } from "./lib/telemetry-client"

try {
  // Your code
} catch (error) {
  captureException(error)
}
```

📚 **See [Telemetry Guide](./docs/guides/telemetry.md) for complete documentation**

---

## 📈 Analytics (PostHog)

### Client-Side

```typescript
import { trackEvent, identifyUser } from "./lib/posthog-client"

// Track events
trackEvent("button_clicked", {
  button_id: "signup",
  page: "/landing"
})

// Identify users
identifyUser({
  userId: "user-123",
  email: "user@example.com"
})

// Feature flags
if (isFeatureFlagEnabled("new_dashboard")) {
  // Show new dashboard
}
```

### Server-Side

```typescript
import { Effect } from "effect"
import { trackServerEvent } from "./lib/posthog-server"

const program = Effect.gen(function* () {
  yield* trackServerEvent("user_signup", {
    distinctId: "user-123",
    plan: "premium"
  })
})
```

📚 **See [PostHog Guide](./docs/guides/posthog.md) for complete documentation**

---

## 🎯 Effect-TS Integration

This project leverages Effect-TS for:
- Type-safe error handling
- Composable business logic
- Resource management with scopes
- Built-in observability (tracing, logging)
- Dependency injection

**Example:**

```typescript
import { Effect } from "effect"

const fetchUser = (userId: string) =>
  Effect.gen(function* () {
    yield* Effect.log(`Fetching user: ${userId}`)

    const response = yield* Effect.tryPromise(() =>
      fetch(`/api/users/${userId}`)
    )

    const user = yield* Effect.tryPromise(() => response.json())

    return user
  }).pipe(
    Effect.withSpan("fetchUser", { attributes: { userId } })
  )
```

---

## 📚 Documentation

### For New Contributors
👉 **Start with [CONTRIBUTING.md](./CONTRIBUTING.md)**

### Guides
- 🚀 [Getting Started](./docs/guides/getting-started.md) - Setup and installation
- 🏗️ [Architecture Overview](./docs/architecture/overview.md) - System design
- 🧪 [Testing Guide](./docs/guides/testing.md) - Writing and running tests
- 📊 [Telemetry Guide](./docs/guides/telemetry.md) - Monitoring and observability
- 📈 [PostHog Guide](./docs/guides/posthog.md) - Analytics and feature flags
- 🐳 [Docker Guide](./docs/guides/docker.md) - Running with Docker

### Complete Documentation
- 📖 [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines
- 🐳 [DOCKER_SETUP.md](./DOCKER_SETUP.md) - Complete Docker setup
- 🧪 [TESTING_AND_TELEMETRY.md](./TESTING_AND_TELEMETRY.md) - Testing & observability

---

## 🔧 Available Scripts

```bash
# Development
bun run dev              # Start dev server with hot reload

# Testing
bun run test             # Run all tests
bun run test:unit        # Run Effect-based unit tests
bun run test:component   # Run component tests
bun run test:visual      # Run visual regression tests
bun run test:watch       # Run tests in watch mode

# Building
bun run build            # Build for production
bun run preview          # Preview production build

# Code Quality
bun run typecheck        # TypeScript type checking
```

---

## 🌟 Key Highlights

### Type Safety
- **End-to-end type safety** with TypeScript and Effect-TS
- **Type-safe RPC** with @effect/rpc
- **Type-safe routing** with TanStack Router

### Developer Experience
- **Hot Module Replacement** - Instant feedback
- **Browser DevTools** - Debug tests in real browsers
- **Comprehensive Testing** - Unit, component, and visual regression
- **Built-in Monitoring** - Pre-configured observability stack

### Production Ready
- **Self-hosted monitoring** - Full control over data
- **Error tracking** - Automatic error capture and reporting
- **Analytics** - Product analytics and feature flags
- **Distributed tracing** - Track requests across services
- **Docker deployment** - Complete containerized stack

---

## 🤝 Contributing

We welcome contributions! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on:
- Setting up your development environment
- Project architecture and patterns
- Testing requirements
- Code style and conventions
- Pull request process

---

## 📄 License

[Your License Here]

---

## 🙏 Acknowledgments

Built with amazing open-source technologies:
- [Effect-TS](https://effect.website)
- [TanStack](https://tanstack.com)
- [Bun](https://bun.sh)
- [Vitest](https://vitest.dev)
- [Grafana](https://grafana.com)
- [Sentry](https://sentry.io)
- [PostHog](https://posthog.com)
- [Playwright](https://playwright.dev)

---

**Ready to build?** 🚀

```bash
bun install
bun run dev
```

For the full experience with monitoring and analytics:

```bash
docker-compose up
```
