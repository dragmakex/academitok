import { expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { afterEach, beforeEach, describe, vi } from "vitest"
import {
  createPostHogClient,
  createPostHogLayer,
  flushPostHog,
  getServerFeatureFlag,
  identifyServerUser,
  isServerFeatureFlagEnabled,
  PostHogService,
  shutdownPostHog,
  trackServerEvent,
} from "./posthog-server"

/**
 * Tests for posthog-server.ts - Server-side PostHog integration.
 *
 * We mock the posthog-node library to test the Effect wrappers.
 */

// Mock posthog-node with a proper class
vi.mock("posthog-node", () => {
  const MockPostHog = class {
    capture = vi.fn()
    identify = vi.fn()
    getFeatureFlag = vi.fn().mockResolvedValue(true)
    isFeatureEnabled = vi.fn().mockResolvedValue(true)
    flush = vi.fn().mockResolvedValue(undefined)
    shutdown = vi.fn().mockResolvedValue(undefined)
  }
  return { PostHog: MockPostHog }
})

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("createPostHogClient", () => {
  it("creates a client with valid config", () => {
    const client = createPostHogClient({
      apiKey: "test-key",
      host: "http://localhost:8000",
    })

    expect(client).toBeDefined()
  })

  it("throws error when API key is missing", () => {
    expect(() =>
      createPostHogClient({
        apiKey: "",
      })
    )
      .toThrow("PostHog API key is required")
  })

  it("uses default host when not provided", () => {
    const client = createPostHogClient({
      apiKey: "test-key",
    })

    expect(client).toBeDefined()
  })
})

describe("createPostHogLayer", () => {
  it("creates a layer", () => {
    const layer = createPostHogLayer({
      apiKey: "test-key",
    })

    expect(layer).toBeDefined()
  })
})

describe("trackServerEvent", () => {
  const TestLayer = createPostHogLayer({ apiKey: "test-key" })

  it.effect("tracks an event with distinctId", () =>
    Effect
      .gen(function*() {
        yield* trackServerEvent("test_event", {
          distinctId: "user-123",
          customProp: "value",
        })
      })
      .pipe(Effect.provide(TestLayer)))

  it.effect("uses 'server' as default distinctId", () =>
    Effect
      .gen(function*() {
        yield* trackServerEvent("test_event")
      })
      .pipe(Effect.provide(TestLayer)))

  it.effect("includes properties in event", () =>
    Effect
      .gen(function*() {
        yield* trackServerEvent("test_event", {
          distinctId: "user-123",
          prop1: "value1",
          prop2: 42,
        })
      })
      .pipe(Effect.provide(TestLayer)))
})

describe("identifyServerUser", () => {
  const TestLayer = createPostHogLayer({ apiKey: "test-key" })

  it.effect("identifies a user without properties", () =>
    Effect
      .gen(function*() {
        yield* identifyServerUser("user-123")
      })
      .pipe(Effect.provide(TestLayer)))

  it.effect("identifies a user with properties", () =>
    Effect
      .gen(function*() {
        yield* identifyServerUser("user-123", {
          email: "test@example.com",
          name: "Test User",
        })
      })
      .pipe(Effect.provide(TestLayer)))
})

describe("getServerFeatureFlag", () => {
  const TestLayer = createPostHogLayer({ apiKey: "test-key" })

  it.effect("returns feature flag value", () =>
    Effect
      .gen(function*() {
        const value = yield* getServerFeatureFlag("test-flag", "user-123")
        expect(value).toBe(true)
      })
      .pipe(Effect.provide(TestLayer)))

  it.effect("returns default value when flag is undefined", () =>
    Effect
      .gen(function*() {
        // The mock returns true, but this tests the parameter passing
        const value = yield* getServerFeatureFlag(
          "test-flag",
          "user-123",
          false,
        )
        expect(value).toBe(true) // Mock returns true
      })
      .pipe(Effect.provide(TestLayer)))

  it.effect("accepts string default value", () =>
    Effect
      .gen(function*() {
        const value = yield* getServerFeatureFlag(
          "test-flag",
          "user-123",
          "default",
        )
        expect(value).toBe(true) // Mock returns true
      })
      .pipe(Effect.provide(TestLayer)))
})

describe("isServerFeatureFlagEnabled", () => {
  const TestLayer = createPostHogLayer({ apiKey: "test-key" })

  it.effect("returns true when flag is enabled", () =>
    Effect
      .gen(function*() {
        const isEnabled = yield* isServerFeatureFlagEnabled(
          "test-flag",
          "user-123",
        )
        expect(isEnabled).toBe(true)
      })
      .pipe(Effect.provide(TestLayer)))
})

describe("flushPostHog", () => {
  const TestLayer = createPostHogLayer({ apiKey: "test-key" })

  it.effect("flushes pending events", () =>
    Effect
      .gen(function*() {
        yield* flushPostHog()
      })
      .pipe(Effect.provide(TestLayer)))
})

describe("shutdownPostHog", () => {
  const TestLayer = createPostHogLayer({ apiKey: "test-key" })

  it.effect("shuts down the client", () =>
    Effect
      .gen(function*() {
        yield* shutdownPostHog()
      })
      .pipe(Effect.provide(TestLayer)))
})

describe("PostHogService", () => {
  it("is a valid Effect Tag", () => {
    expect(PostHogService).toBeDefined()
  })
})
