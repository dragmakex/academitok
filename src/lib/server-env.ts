/**
 * Production environment validation (fail-fast startup boundary).
 *
 * Pattern: Effect Schema boundary validation
 * Purpose: Prevent production servers from booting into unsafe defaults
 * (ephemeral PGlite fallback, open sign-in origin allowlist, unconfigured
 * mail delivery, or missing OpenAlex polite-pool identification).
 */

import * as Schema from "effect/Schema"

const originPattern = /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const mailFromEmailPattern = /[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/

const NodeEnvSchema = Schema.Literals(["development", "test", "production"])

export type NodeEnv = typeof NodeEnvSchema.Type

export interface ValidatedServerEnv {
  readonly nodeEnv: NodeEnv
  readonly databaseUrl: string | undefined
  readonly authOrigins: ReadonlyArray<string>
  readonly openAlexMailto: string | undefined
  readonly resendApiKey: string | undefined
  readonly mailFrom: string | undefined
  readonly sentryDsn: string | undefined
  readonly sentryTracesSampleRate: number | undefined
  readonly otlpEndpoint: string | undefined
  readonly lokiOtlpEndpoint: string | undefined
  readonly posthogHost: string | undefined
  readonly pyroscopeServerAddress: string | undefined
}

/**
 * Typed error thrown when server environment validation fails.
 */
export class ServerEnvError extends Error {
  readonly issues: ReadonlyArray<string>

  /**
   * Builds a configuration error listing all invalid environment entries.
   * @param issues - Human-readable validation failures.
   */
  constructor(issues: ReadonlyArray<string>) {
    super(
      `Invalid server environment configuration:\n${
        issues.map((issue) => `  - ${issue}`).join("\n")
      }`,
    )
    this.name = "ServerEnvError"
    this.issues = issues
  }
}

const trimmed = (value: string | undefined): string | undefined => {
  if (value === undefined) {
    return undefined
  }
  const normalized = value.trim()
  return normalized === "" ? undefined : normalized
}

const isValidHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

const isValidPostgresUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value)
    return (
      (parsed.protocol === "postgres:" || parsed.protocol === "postgresql:")
      && parsed.hostname.length > 0
      && parsed.pathname.length > 1
    )
  } catch {
    return false
  }
}

const parseAuthOrigins = (raw: string | undefined): ReadonlyArray<string> =>
  (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "")

const optionalHttpUrlVars = [
  "SENTRY_DSN",
  "OTLP_ENDPOINT",
  "LOKI_OTLP_ENDPOINT",
  "POSTHOG_HOST",
  "PYROSCOPE_SERVER_ADDRESS",
] as const

/**
 * Validates server environment variables and enforces strict production rules.
 *
 * @param env - Raw environment map (defaults to `process.env`).
 * @returns Normalized, validated server environment configuration.
 * @throws {ServerEnvError} When one or more variables are missing or malformed.
 */
export function validateServerEnv(
  env: Record<string, string | undefined> = process.env,
): ValidatedServerEnv {
  const issues: Array<string> = []

  const rawNodeEnv = trimmed(env.NODE_ENV) ?? "development"
  const decodedNodeEnv = Schema.decodeUnknownOption(NodeEnvSchema)(rawNodeEnv)
  const nodeEnv: NodeEnv = decodedNodeEnv._tag === "Some"
    ? decodedNodeEnv.value
    : "development"
  if (decodedNodeEnv._tag === "None") {
    issues.push(
      `NODE_ENV must be one of "development", "test", or "production" (got "${rawNodeEnv}")`,
    )
  }

  const isProduction = nodeEnv === "production"
  const databaseUrl = trimmed(env.DATABASE_URL)
  const authOrigins = parseAuthOrigins(env.AUTH_ORIGINS)
  const openAlexMailto = trimmed(env.OPENALEX_MAILTO)
  const resendApiKey = trimmed(env.RESEND_API_KEY)
  const mailFrom = trimmed(env.MAIL_FROM)
  const sentryDsn = trimmed(env.SENTRY_DSN)
  const otlpEndpoint = trimmed(env.OTLP_ENDPOINT)
  const lokiOtlpEndpoint = trimmed(env.LOKI_OTLP_ENDPOINT)
  const posthogHost = trimmed(env.POSTHOG_HOST)
  const pyroscopeServerAddress = trimmed(env.PYROSCOPE_SERVER_ADDRESS)

  if (databaseUrl === undefined) {
    if (isProduction) {
      issues.push(
        "DATABASE_URL is required in production (PostgreSQL connection URL; PGlite fallback is disabled)",
      )
    }
  } else if (!isValidPostgresUrl(databaseUrl)) {
    issues.push(
      "DATABASE_URL must be a valid postgres:// or postgresql:// URL including host and database name",
    )
  }

  if (openAlexMailto === undefined) {
    if (isProduction) {
      issues.push(
        "OPENALEX_MAILTO is required in production to identify requests in OpenAlex's polite pool",
      )
    }
  } else if (!emailPattern.test(openAlexMailto)) {
    issues.push("OPENALEX_MAILTO must be a valid email address")
  }

  if (authOrigins.length === 0) {
    if (isProduction) {
      issues.push(
        "AUTH_ORIGINS is required in production (comma-separated allowed sign-in origins)",
      )
    }
  } else {
    for (const origin of authOrigins) {
      if (!originPattern.test(origin)) {
        issues.push(
          `AUTH_ORIGINS entry "${origin}" must be a bare http(s) origin without trailing slash or path`,
        )
      }
    }
  }

  if (isProduction) {
    if (resendApiKey === undefined) {
      issues.push(
        "RESEND_API_KEY is required in production for sign-in email delivery",
      )
    }
    if (mailFrom === undefined) {
      issues.push(
        "MAIL_FROM is required in production (e.g. \"AcademiTok <desk@academitok.example>\")",
      )
    }
  } else if ((resendApiKey === undefined) !== (mailFrom === undefined)) {
    issues.push(
      "RESEND_API_KEY and MAIL_FROM must either both be set or both be omitted",
    )
  }

  if (mailFrom !== undefined && !mailFromEmailPattern.test(mailFrom)) {
    issues.push("MAIL_FROM must contain a valid sender email address")
  }

  for (const key of optionalHttpUrlVars) {
    const value = trimmed(env[key])
    if (value !== undefined && !isValidHttpUrl(value)) {
      issues.push(`${key} must be a valid http:// or https:// URL`)
    }
  }

  const rawSampleRate = trimmed(env.SENTRY_TRACES_SAMPLE_RATE)
  let sentryTracesSampleRate: number | undefined
  if (rawSampleRate !== undefined) {
    const parsed = Number(rawSampleRate)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
      issues.push(
        "SENTRY_TRACES_SAMPLE_RATE must be a finite number between 0 and 1",
      )
    } else {
      sentryTracesSampleRate = parsed
    }
  }

  if (issues.length > 0) {
    throw new ServerEnvError(issues)
  }

  return {
    nodeEnv,
    databaseUrl,
    authOrigins,
    openAlexMailto,
    resendApiKey,
    mailFrom,
    sentryDsn,
    sentryTracesSampleRate,
    otlpEndpoint,
    lokiOtlpEndpoint,
    posthogHost,
    pyroscopeServerAddress,
  }
}
