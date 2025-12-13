/**
 * Telemetry Example
 *
 * This file demonstrates how to use OpenTelemetry tracing, Sentry error logging,
 * and Grafana Loki logging in an Effect application.
 */

import { Effect } from "effect"
import { initSentry, createSentryTelemetryLayer } from "./lib/telemetry-server"
import { createLokiLoggerLayer } from "./lib/logger-loki"

// ====================
// Configuration
// ====================

const TELEMETRY_CONFIG = {
  serviceName: "effect-tanstack-start",
  sentryDsn: process.env.SENTRY_DSN, // Set this in your .env file
  environment: process.env.NODE_ENV || "development",
}

const LOKI_CONFIG = {
  endpoint: process.env.LOKI_ENDPOINT || "http://localhost:3100/loki/api/v1/push",
  labels: {
    job: "effect-tanstack-start",
    environment: TELEMETRY_CONFIG.environment,
  },
}

// ====================
// Initialize Sentry
// ====================

initSentry(TELEMETRY_CONFIG)

// ====================
// Create Layers
// ====================

// Telemetry layer for tracing (sends to Sentry)
const TelemetryLive = createSentryTelemetryLayer(TELEMETRY_CONFIG)

// Logger layer for structured logging (sends to Loki)
const LoggerLive = createLokiLoggerLayer(LOKI_CONFIG)

// Combine both layers
const AppLayer = TelemetryLive.pipe(
  // Note: If you want logs in both console and Loki, use createCombinedLoggerLayer instead
  Effect.zipLeft(LoggerLive)
)

// ====================
// Example Tasks
// ====================

// Simulate a database query
const queryDatabase = (userId: string) =>
  Effect.gen(function* () {
    yield* Effect.log(`Querying database for user: ${userId}`)
    yield* Effect.sleep("100 millis")

    // Simulate a random failure (10% chance)
    const shouldFail = Math.random() < 0.1
    if (shouldFail) {
      return yield* Effect.fail(new Error("Database connection timeout"))
    }

    return {
      id: userId,
      name: "John Doe",
      email: "john@example.com",
    }
  }).pipe(
    Effect.withSpan("queryDatabase", { attributes: { userId } })
  )

// Simulate an API call
const callExternalAPI = (endpoint: string) =>
  Effect.gen(function* () {
    yield* Effect.log(`Calling external API: ${endpoint}`)
    yield* Effect.sleep("200 millis")

    return {
      status: "success",
      data: { message: "API response" },
    }
  }).pipe(
    Effect.withSpan("callExternalAPI", { attributes: { endpoint } })
  )

// Simulate processing data
const processData = (data: unknown) =>
  Effect.gen(function* () {
    yield* Effect.log("Processing data...")
    yield* Effect.sleep("50 millis")

    yield* Effect.logInfo("Data processed successfully")

    return { processed: true, timestamp: Date.now() }
  }).pipe(
    Effect.withSpan("processData")
  )

// ====================
// Main Program
// ====================

const program = Effect.gen(function* () {
  yield* Effect.log("Application starting...")

  // Add custom annotations for all logs in this scope
  yield* Effect.annotateLogsScoped({
    requestId: "req-123",
    version: "1.0.0",
  })

  try {
    // Query the database
    const user = yield* queryDatabase("user-456")
    yield* Effect.log(`User fetched: ${user.name}`)

    // Call external API
    const apiResult = yield* callExternalAPI("/api/external/data")
    yield* Effect.log(`API call completed: ${apiResult.status}`)

    // Process the data
    const processed = yield* processData({ user, apiResult })
    yield* Effect.log(`Processing result: ${JSON.stringify(processed)}`)

    yield* Effect.log("Application completed successfully")
  } catch (error) {
    yield* Effect.logError("Application failed", error)
    throw error
  }
}).pipe(
  // Wrap everything in a span for the entire request
  Effect.withSpan("handleRequest"),
  // Add a log span to measure total duration
  Effect.withLogSpan("requestDuration"),
  // Make it scoped so annotateLogsScoped works
  Effect.scoped
)

// ====================
// Run the Program
// ====================

Effect.runPromise(
  program.pipe(
    Effect.provide(AppLayer),
    Effect.catchAllCause((cause) => {
      // Log any unhandled errors
      return Effect.logError("Unhandled error", cause)
    })
  )
).then(
  () => {
    console.log("\n✅ Program completed successfully")
    process.exit(0)
  },
  (error) => {
    console.error("\n❌ Program failed:", error)
    process.exit(1)
  }
)

/**
 * To run this example:
 *
 * 1. Start Grafana Loki (using Docker):
 *    ```bash
 *    docker run -p 3100:3100 grafana/loki
 *    ```
 *
 * 2. Optionally set up the OpenTelemetry backend:
 *    ```bash
 *    docker run -p 3000:3000 -p 4317:4317 -p 4318:4318 --rm -it docker.io/grafana/otel-lgtm
 *    ```
 *
 * 3. Set environment variables (create a .env file):
 *    ```
 *    SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
 *    LOKI_ENDPOINT=http://localhost:3100/loki/api/v1/push
 *    NODE_ENV=development
 *    ```
 *
 * 4. Run the example:
 *    ```bash
 *    bun run src/telemetry-example.ts
 *    ```
 *
 * 5. View the results:
 *    - Traces: Open http://localhost:3000/explore (Grafana Tempo)
 *    - Logs: Query Loki via Grafana at http://localhost:3000
 *    - Errors: Check your Sentry dashboard
 */
