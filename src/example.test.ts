import { expect, it } from "@effect/vitest"
import { Clock, Console, Effect, Exit, Random, TestClock } from "effect"

// Example 1: Testing a simple Effect function
/**
 * Divides two numbers.
 * @param a - The dividend.
 * @param b - The divisor.
 * @returns An `Effect` that succeeds with the quotient or fails with "Cannot divide by zero".
 */
function divide(a: number, b: number) {
  if (b === 0) {
    return Effect.fail("Cannot divide by zero")
  }
  return Effect.succeed(a / b)
}

it.effect(
  "divides two numbers successfully",
  /**
   * @remarks
   * This test divides two numbers successfully.
   * @returns {Effect<any, any, any>}
   */
  () =>
    Effect.gen(function*() {
      const result = yield* divide(10, 2)
      expect(result).toBe(5)
    }),
)

it.effect(
  "handles division by zero as Exit",
  /**
   * @remarks
   * This test handles division by zero as Exit.
   * @returns {Effect<any, any, any>}
   */
  () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(divide(10, 0))
      expect(result).toStrictEqual(Exit.fail("Cannot divide by zero"))
    }),
)

// Example 2: Using TestClock
it.effect(
  "uses TestClock to simulate time",
  /**
   * @remarks
   * This test uses TestClock to simulate time.
   * @returns {Effect<any, any, any>}
   */
  () =>
    Effect.gen(function*() {
      const before = yield* Clock.currentTimeMillis
      expect(before).toBe(0) // TestClock starts at 0

      yield* TestClock.adjust("1000 millis")

      const after = yield* Clock.currentTimeMillis
      expect(after).toBe(1000)
    }),
)

// Example 3: Using it.live for real environment
it.live(
  "runs with live environment",
  /**
   * @remarks
   * This test runs with a live environment.
   * @returns {Effect<any, any, any>}
   */
  () =>
    Effect.gen(function*() {
      const now = yield* Clock.currentTimeMillis
      // In live mode, this will be the actual current time
      expect(now).toBeGreaterThan(0)
    }),
)

// Example 4: Using it.scoped for resource management
it.scoped(
  "manages resources with scope",
  /**
   * @remarks
   * This test manages resources with a scope.
   * @returns {Effect<any, any, any>}
   */
  () =>
    Effect.gen(function*() {
      const resource = Effect.acquireRelease(
        Effect.succeed("resource acquired"),
        () => Console.log("resource released"),
      )

      const value = yield* resource
      expect(value).toBe("resource acquired")
    }),
)

// Example 5: Using it.flakyTest for tests that may fail randomly
it.effect(
  "handles flaky tests with retry",
  /**
   * @remarks
   * This test handles flaky tests with retry.
   * @returns {Effect<any, any, any>}
   */
  () => {
    const flaky = Effect.gen(function*() {
      const random = yield* Random.nextBoolean
      if (random) {
        return yield* Effect.fail("Random failure")
      }
      return "success"
    })

    return it.flakyTest(flaky, "5 seconds")
  },
)
