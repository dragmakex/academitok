import { describe, expect, it } from "vitest"
import { ServerEnvError, validateServerEnv } from "./server-env"

const validProductionEnv: Record<string, string> = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://academitok:secret@db.internal:5432/academitok",
  OPENALEX_MAILTO: "desk@academitok.example",
  SENTRY_DSN: "https://public@sentry.example/1",
  SENTRY_TRACES_SAMPLE_RATE: "0.25",
  OTLP_ENDPOINT: "https://tempo.internal:4318",
  LOKI_OTLP_ENDPOINT: "https://loki.internal:3100/otlp",
  POSTHOG_HOST: "https://eu.i.posthog.com",
  PYROSCOPE_SERVER_ADDRESS: "https://pyroscope.internal:4040",
}

describe("validateServerEnv", () => {
  it("accepts minimal development environment with defaults", () => {
    const result = validateServerEnv({})
    expect(result).toEqual({
      nodeEnv: "development",
      databaseUrl: undefined,
      openAlexMailto: undefined,
      sentryDsn: undefined,
      sentryTracesSampleRate: undefined,
      otlpEndpoint: undefined,
      lokiOtlpEndpoint: undefined,
      posthogHost: undefined,
      pyroscopeServerAddress: undefined,
    })
  })

  it("accepts a complete, well-formed production environment", () => {
    const result = validateServerEnv(validProductionEnv)
    expect(result.nodeEnv).toBe("production")
    expect(result.databaseUrl).toBe(validProductionEnv.DATABASE_URL)
    expect(result.openAlexMailto).toBe("desk@academitok.example")
    expect(result.sentryTracesSampleRate).toBe(0.25)
  })

  it("rejects production startup when required variables are missing", () => {
    expect(() => validateServerEnv({ NODE_ENV: "production" })).toThrow(
      ServerEnvError,
    )
    try {
      validateServerEnv({ NODE_ENV: "production" })
    } catch (error) {
      expect(error).toBeInstanceOf(ServerEnvError)
      const issues = (error as ServerEnvError).issues.join("\n")
      expect(issues).toContain("DATABASE_URL")
      expect(issues).toContain("OPENALEX_MAILTO")
    }
  })

  it("rejects unknown NODE_ENV values", () => {
    expect(() => validateServerEnv({ NODE_ENV: "staging" })).toThrow(
      /NODE_ENV must be one of/,
    )
  })

  it("rejects malformed DATABASE_URL values", () => {
    expect(() =>
      validateServerEnv({
        NODE_ENV: "development",
        DATABASE_URL: "mysql://user:pass@localhost:3306/db",
      })
    )
      .toThrow(/DATABASE_URL must be a valid postgres/)

    expect(() =>
      validateServerEnv({
        NODE_ENV: "development",
        DATABASE_URL: "not-a-url",
      })
    )
      .toThrow(/DATABASE_URL must be a valid postgres/)
  })

  it("rejects a malformed OPENALEX_MAILTO value", () => {
    expect(() =>
      validateServerEnv({
        ...validProductionEnv,
        OPENALEX_MAILTO: "not-an-email",
      })
    )
      .toThrow(/OPENALEX_MAILTO must be a valid email/)
  })

  it("validates optional observability URLs and sample rates when provided", () => {
    expect(() =>
      validateServerEnv({
        NODE_ENV: "development",
        SENTRY_DSN: "ftp://invalid.example/1",
        OTLP_ENDPOINT: "not-a-url",
        SENTRY_TRACES_SAMPLE_RATE: "1.5",
      })
    )
      .toThrow(/SENTRY_DSN must be a valid http/)

    expect(() =>
      validateServerEnv({
        NODE_ENV: "development",
        SENTRY_TRACES_SAMPLE_RATE: "-0.1",
      })
    )
      .toThrow(/SENTRY_TRACES_SAMPLE_RATE must be a finite number/)
  })
})
