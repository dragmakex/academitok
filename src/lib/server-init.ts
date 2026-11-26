/**
 * Server-side initialization — call once at startup before handling requests.
 *
 * Initializes Sentry for error tracking. Pyroscope profiling is handled
 * separately via `pyroscope-server.ts` (Effect-native, Config-driven).
 */

import * as Sentry from "@sentry/node"
import { validateServerEnv } from "./server-env"

let initialized = false

/**
 * Initialize server-side observability singletons and enforce environment validation.
 * Safe to call multiple times — only the first call takes effect.
 */
export function initServer(): void {
  if (initialized) {
    return
  }

  const env = validateServerEnv(process.env)

  if (env.sentryDsn !== undefined) {
    Sentry.init({
      dsn: env.sentryDsn,
      environment: env.nodeEnv,
      tracesSampleRate: env.sentryTracesSampleRate ?? 1.0,
    })
  }

  initialized = true
}
