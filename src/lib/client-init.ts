/**
 * Client-side telemetry initialization — Sentry + PostHog.
 *
 * Call `initClient()` once from the root component. Guards against
 * server-side execution and double initialization.
 */

import * as Sentry from "@sentry/react"
import posthog from "posthog-js"

let initialized = false

/**
 * Initialize client-side observability (Sentry error tracking + PostHog analytics).
 * Safe to call multiple times and in SSR contexts (no-ops gracefully).
 */
export function initClient(): void {
  if (initialized || typeof window === "undefined") {
    return
  }

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

  if (import.meta.env.VITE_POSTHOG_KEY) {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
      /* eslint-disable camelcase */
      api_host: import.meta.env.VITE_POSTHOG_HOST ?? "http://localhost:8001",
      capture_pageview: true,
      capture_pageleave: true,
      /* eslint-enable camelcase */
    })
  }

  initialized = true
}

/**
 * Sentry ErrorBoundary component for wrapping the React tree.
 * Captures component-level errors and sends them to Sentry.
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary
