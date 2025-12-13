/**
 * Grafana Loki Logger Integration
 *
 * This module provides a custom Effect logger that sends logs to Grafana Loki.
 * Loki is a horizontally scalable, highly available log aggregation system inspired by Prometheus.
 */

import { Logger, type LogLevel } from "effect"

/**
 * Configuration for Grafana Loki
 */
export interface LokiConfig {
  /** Loki push API endpoint (e.g., "http://localhost:3100/loki/api/v1/push") */
  endpoint: string
  /** Labels to attach to all log streams */
  labels?: Record<string, string>
  /** Batch size for sending logs (default: 100) */
  batchSize?: number
  /** Flush interval in milliseconds (default: 5000ms) */
  flushIntervalMs?: number
  /** Optional authentication token */
  authToken?: string
}

/**
 * A log entry in Loki format
 */
interface LokiLogEntry {
  ts: string  // Timestamp in nanoseconds
  line: string // The log message
}

/**
 * A log stream with labels and entries
 */
interface LokiStream {
  stream: Record<string, string>
  values: Array<[string, string]> // [timestamp, message]
}

/**
 * The request body format for Loki push API
 */
interface LokiPushRequest {
  streams: LokiStream[]
}

/**
 * Internal log buffer for batching
 */
class LogBuffer {
  private buffer: Array<{ timestamp: number; message: string; level: LogLevel.LogLevel }> = []
  private timer: NodeJS.Timeout | null = null

  constructor(
    private config: Required<LokiConfig>,
    private flush: (logs: typeof this.buffer) => void
  ) {}

  add(timestamp: number, message: string, level: LogLevel.LogLevel) {
    this.buffer.push({ timestamp, message, level })

    if (this.buffer.length >= this.config.batchSize) {
      this.flushNow()
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flushNow(), this.config.flushIntervalMs)
    }
  }

  private flushNow() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    if (this.buffer.length > 0) {
      const logsToFlush = this.buffer.splice(0, this.buffer.length)
      this.flush(logsToFlush)
    }
  }

  destroy() {
    this.flushNow()
  }
}

/**
 * Create a Logger that sends logs to Grafana Loki
 */
export function createLokiLogger(config: LokiConfig): Logger.Logger<unknown, void> {
  const fullConfig: Required<LokiConfig> = {
    endpoint: config.endpoint,
    labels: config.labels || { job: "effect-app", level: "application" },
    batchSize: config.batchSize || 100,
    flushIntervalMs: config.flushIntervalMs || 5000,
    authToken: config.authToken || "",
  }

  // Function to send logs to Loki
  const sendToLoki = async (
    logs: Array<{ timestamp: number; message: string; level: LogLevel.LogLevel }>
  ) => {
    try {
      const streams: Record<string, LokiLogEntry[]> = {}

      // Group logs by level
      for (const log of logs) {
        const levelKey = log.level.label
        if (!streams[levelKey]) {
          streams[levelKey] = []
        }

        // Loki expects timestamp in nanoseconds as a string
        const timestampNs = `${log.timestamp * 1_000_000}`

        streams[levelKey].push({
          ts: timestampNs,
          line: log.message,
        })
      }

      // Convert to Loki format
      const lokiStreams: LokiStream[] = Object.entries(streams).map(([level, entries]) => ({
        stream: {
          ...fullConfig.labels,
          level,
        },
        values: entries.map((entry) => [entry.ts, entry.line]),
      }))

      const body: LokiPushRequest = {
        streams: lokiStreams,
      }

      // Send to Loki
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      }

      if (fullConfig.authToken) {
        headers["Authorization"] = `Bearer ${fullConfig.authToken}`
      }

      const response = await fetch(fullConfig.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        console.error(
          `Failed to send logs to Loki: ${response.status} ${response.statusText}`
        )
      }
    } catch (error) {
      console.error("Error sending logs to Loki:", error)
    }
  }

  // Create a buffer for batching logs
  const buffer = new LogBuffer(fullConfig, sendToLoki)

  // Create the custom logger
  return Logger.make(({ logLevel, message, date }) => {
    const timestamp = date.getTime()

    // Format the message
    let formattedMessage: string
    if (typeof message === "string") {
      formattedMessage = message
    } else if (Array.isArray(message)) {
      formattedMessage = message.map((m) => String(m)).join(" ")
    } else {
      formattedMessage = JSON.stringify(message)
    }

    // Add to buffer
    buffer.add(timestamp, formattedMessage, logLevel)
  })
}

/**
 * Create a layer that replaces the default logger with a Loki logger
 *
 * Example usage:
 *
 * ```ts
 * import { Effect } from "effect"
 * import { createLokiLoggerLayer } from "./lib/logger-loki"
 *
 * const LokiLoggerLive = createLokiLoggerLayer({
 *   endpoint: "http://localhost:3100/loki/api/v1/push",
 *   labels: {
 *     job: "my-app",
 *     environment: "production",
 *   },
 * })
 *
 * const program = Effect.gen(function* () {
 *   yield* Effect.log("Hello from Loki!")
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(LokiLoggerLive)))
 * ```
 */
export function createLokiLoggerLayer(config: LokiConfig) {
  const lokiLogger = createLokiLogger(config)
  return Logger.replace(Logger.defaultLogger, lokiLogger)
}

/**
 * Create a combined logger that logs to both console and Loki
 *
 * This is useful during development when you want to see logs in the console
 * while also sending them to Loki for aggregation and analysis.
 *
 * Example usage:
 *
 * ```ts
 * import { Effect } from "effect"
 * import { createCombinedLoggerLayer } from "./lib/logger-loki"
 *
 * const LoggerLive = createCombinedLoggerLayer({
 *   endpoint: "http://localhost:3100/loki/api/v1/push",
 *   labels: { job: "my-app" },
 * })
 *
 * const program = Effect.gen(function* () {
 *   yield* Effect.log("This goes to both console and Loki!")
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(LoggerLive)))
 * ```
 */
export function createCombinedLoggerLayer(config: LokiConfig) {
  const lokiLogger = createLokiLogger(config)
  const combinedLogger = Logger.zip(Logger.defaultLogger, lokiLogger)
  return Logger.replace(Logger.defaultLogger, combinedLogger)
}
