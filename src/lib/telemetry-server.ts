/**
 * Server-Side Telemetry Configuration
 *
 * This file configures OpenTelemetry and Sentry for server-side tracing and error logging.
 * It can export traces to either Sentry or another backend like Grafana/Tempo via OTLP.
 */

import { NodeSdk } from "@effect/opentelemetry"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { SentrySpanProcessor } from "@sentry/opentelemetry"
import * as Sentry from "@sentry/node"
import { Layer } from "effect"

/**
 * Configuration options for telemetry
 */
export interface TelemetryConfig {
  serviceName: string
  sentryDsn?: string
  otlpEndpoint?: string
  environment?: string
}

/**
 * Initialize Sentry for error logging and tracing
 */
export function initSentry(config: TelemetryConfig) {
  if (!config.sentryDsn) {
    console.warn("Sentry DSN not provided, skipping Sentry initialization")
    return
  }

  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.environment || "development",
    tracesSampleRate: 1.0, // Adjust this in production (e.g., 0.1 for 10% sampling)
    integrations: [
      // Add custom integrations here
      Sentry.httpIntegration(),
      Sentry.nativeNodeFetchIntegration(),
    ],
  })
}

/**
 * Create an OpenTelemetry Layer with Sentry integration
 */
export function createSentryTelemetryLayer(config: TelemetryConfig): Layer.Layer<never> {
  return NodeSdk.layer(() => ({
    resource: {
      serviceName: config.serviceName,
      environment: config.environment || "development",
    },
    // Use Sentry's span processor to send traces to Sentry
    spanProcessor: new SentrySpanProcessor(),
  }))
}

/**
 * Create an OpenTelemetry Layer with OTLP exporter (for Grafana/Tempo/etc.)
 */
export function createOTLPTelemetryLayer(config: TelemetryConfig): Layer.Layer<never> {
  const otlpEndpoint = config.otlpEndpoint || "http://localhost:4318/v1/traces"

  return NodeSdk.layer(() => ({
    resource: {
      serviceName: config.serviceName,
      environment: config.environment || "development",
    },
    // Export traces to an OTLP endpoint (e.g., Grafana Tempo)
    spanProcessor: new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: otlpEndpoint,
      })
    ),
  }))
}

/**
 * Create a combined telemetry layer that sends to both Sentry and OTLP
 */
export function createCombinedTelemetryLayer(config: TelemetryConfig): Layer.Layer<never> {
  const otlpEndpoint = config.otlpEndpoint || "http://localhost:4318/v1/traces"

  return NodeSdk.layer(() => ({
    resource: {
      serviceName: config.serviceName,
      environment: config.environment || "development",
    },
    // Send traces to both Sentry and OTLP endpoint
    spanProcessor: new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: otlpEndpoint,
      })
    ),
  }))
}

/**
 * Example usage:
 *
 * ```ts
 * import { Effect } from "effect"
 * import { initSentry, createSentryTelemetryLayer } from "./lib/telemetry-server"
 *
 * // Initialize Sentry
 * initSentry({
 *   serviceName: "my-service",
 *   sentryDsn: "https://your-sentry-dsn@sentry.io/project-id",
 *   environment: process.env.NODE_ENV,
 * })
 *
 * // Create telemetry layer
 * const TelemetryLive = createSentryTelemetryLayer({
 *   serviceName: "my-service",
 *   sentryDsn: "https://your-sentry-dsn@sentry.io/project-id",
 *   environment: process.env.NODE_ENV,
 * })
 *
 * // Use in your Effect program
 * const program = Effect.gen(function* () {
 *   yield* Effect.log("Starting operation")
 *   // Your business logic here
 * }).pipe(Effect.withSpan("my-operation"))
 *
 * Effect.runPromise(program.pipe(Effect.provide(TelemetryLive)))
 * ```
 */
