/**
 * PostHog Server-Side Integration
 *
 * This file configures PostHog for server-side event tracking and feature flags.
 */

import { PostHog } from 'posthog-node'
import { Effect, Layer } from 'effect'

/**
 * Configuration options for PostHog server
 */
export interface PostHogServerConfig {
  apiKey: string
  host?: string
  enableDebug?: boolean
}

/**
 * PostHog service tag
 */
export class PostHogService extends Effect.Tag('PostHogService')<
  PostHogService,
  PostHog
>() {}

/**
 * Create a PostHog client instance
 */
export function createPostHogClient(config: PostHogServerConfig): PostHog {
  if (!config.apiKey) {
    throw new Error('PostHog API key is required')
  }

  return new PostHog(config.apiKey, {
    host: config.host || 'https://app.posthog.com',
    flushAt: 10, // Batch size for events
    flushInterval: 10000, // 10 seconds
    enable: true,
  })
}

/**
 * Create a Layer that provides PostHog service
 *
 * Example usage:
 * ```ts
 * const PostHogLive = createPostHogLayer({
 *   apiKey: process.env.POSTHOG_API_KEY!,
 *   host: "http://localhost:8001",
 * })
 *
 * const program = Effect.gen(function* () {
 *   const posthog = yield* PostHogService
 *   yield* trackServerEvent(posthog, "user_signed_up", {
 *     userId: "123",
 *     email: "user@example.com",
 *   })
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(PostHogLive)))
 * ```
 */
export function createPostHogLayer(config: PostHogServerConfig): Layer.Layer<PostHogService> {
  return Layer.succeed(PostHogService, createPostHogClient(config))
}

/**
 * Track a server-side event using Effect
 *
 * Example usage:
 * ```ts
 * const program = Effect.gen(function* () {
 *   yield* trackServerEvent("user_login", {
 *     userId: "user-123",
 *     method: "password",
 *   })
 * })
 * ```
 */
export function trackServerEvent(
  eventName: string,
  properties?: {
    distinctId?: string
    [key: string]: unknown
  }
): Effect.Effect<void, never, PostHogService> {
  return Effect.gen(function* () {
    const posthog = yield* PostHogService
    const distinctId = properties?.distinctId || 'server'

    posthog.capture({
      distinctId,
      event: eventName,
      properties: {
        ...properties,
        $lib: 'posthog-node',
      },
    })

    yield* Effect.log(`Tracked event: ${eventName}`, properties)
  })
}

/**
 * Identify a user on the server
 *
 * Example usage:
 * ```ts
 * const program = Effect.gen(function* () {
 *   yield* identifyServerUser("user-123", {
 *     email: "user@example.com",
 *     name: "John Doe",
 *     plan: "pro",
 *   })
 * })
 * ```
 */
export function identifyServerUser(
  distinctId: string,
  properties?: Record<string, unknown>
): Effect.Effect<void, never, PostHogService> {
  return Effect.gen(function* () {
    const posthog = yield* PostHogService

    posthog.identify({
      distinctId,
      properties,
    })

    yield* Effect.log(`Identified user: ${distinctId}`, properties)
  })
}

/**
 * Get a feature flag value for a user
 *
 * Example usage:
 * ```ts
 * const program = Effect.gen(function* () {
 *   const isEnabled = yield* getServerFeatureFlag(
 *     "new_feature",
 *     "user-123"
 *   )
 *
 *   if (isEnabled) {
 *     // Execute new feature logic
 *   }
 * })
 * ```
 */
export function getServerFeatureFlag(
  flagKey: string,
  distinctId: string,
  defaultValue: boolean | string = false
): Effect.Effect<boolean | string, never, PostHogService> {
  return Effect.gen(function* () {
    const posthog = yield* PostHogService

    const flagValue = yield* Effect.promise(() =>
      posthog.getFeatureFlag(flagKey, distinctId)
    )

    return flagValue ?? defaultValue
  })
}

/**
 * Check if a feature flag is enabled for a user
 *
 * Example usage:
 * ```ts
 * const program = Effect.gen(function* () {
 *   const canAccessBeta = yield* isServerFeatureFlagEnabled(
 *     "beta_access",
 *     "user-123"
 *   )
 *
 *   if (canAccessBeta) {
 *     yield* Effect.log("User has beta access")
 *   }
 * })
 * ```
 */
export function isServerFeatureFlagEnabled(
  flagKey: string,
  distinctId: string
): Effect.Effect<boolean, never, PostHogService> {
  return Effect.gen(function* () {
    const posthog = yield* PostHogService

    const isEnabled = yield* Effect.promise(() =>
      posthog.isFeatureEnabled(flagKey, distinctId)
    )

    return isEnabled ?? false
  })
}

/**
 * Flush all pending events (useful before shutdown)
 *
 * Example usage:
 * ```ts
 * const program = Effect.gen(function* () {
 *   yield* trackServerEvent("app_shutdown", {})
 *   yield* flushPostHog()
 * })
 * ```
 */
export function flushPostHog(): Effect.Effect<void, never, PostHogService> {
  return Effect.gen(function* () {
    const posthog = yield* PostHogService

    yield* Effect.promise(() => posthog.flush())
    yield* Effect.log('PostHog events flushed')
  })
}

/**
 * Shutdown PostHog client (call this on application shutdown)
 *
 * Example usage:
 * ```ts
 * const program = Effect.gen(function* () {
 *   // ... your application logic
 *   yield* shutdownPostHog()
 * })
 * ```
 */
export function shutdownPostHog(): Effect.Effect<void, never, PostHogService> {
  return Effect.gen(function* () {
    const posthog = yield* PostHogService

    yield* Effect.promise(() => posthog.shutdown())
    yield* Effect.log('PostHog client shutdown')
  })
}
