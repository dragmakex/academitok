/**
 * Upstream politeness guard: bounded retries and a per-source circuit breaker.
 *
 * Holds no module state so the schedule and the breaker can be driven by an
 * injected clock, and so the arXiv/Crossref clients can wrap their own request
 * instead of growing a second, weaker copy of this policy.
 *
 * @see SPEC.md §7
 */

const baseAttemptDelayMs = 1_000
const maxAttemptDelayMs = 8_000

/** Tries per request, including the first one. */
export const maxAttempts = 3

/** Consecutive failures that open the breaker. */
export const breakerFailureThreshold = 3

/** How long an open breaker refuses requests without touching the source. */
export const breakerCooldownMs = 15 * 60 * 1_000

/**
 * Delay before retry `index`, doubling from one second and capped at eight.
 * @param index - Zero-based retry index.
 * @returns Milliseconds to wait before the next attempt.
 */
export const attemptDelay = (index: number): number =>
  Math.min(baseAttemptDelayMs * 2 ** index, maxAttemptDelayMs)

export type SourceGuard = {
  /**
   * Runs `send` under the retry schedule and breaker.
   * @param send - One request to the upstream source.
   * @param now - Boundary-supplied current time for breaker expiry.
   * @returns The first successful response.
   */
  readonly run: (
    send: () => Promise<Response>,
    now: number,
  ) => Promise<Response>
  /**
   * Reports whether the breaker currently refuses requests.
   * @param now - Boundary-supplied current time for breaker expiry.
   * @returns True while the breaker holds the source shut.
   */
  readonly isOpen: (now: number) => boolean
}

/**
 * Builds the guard for one upstream source.
 * @param sleep - Millisecond waiter, injected so tests do not wait.
 * @returns Retry schedule and breaker state machine.
 */
export const createSourceGuard = (
  sleep: (milliseconds: number) => Promise<void>,
): SourceGuard => {
  let consecutiveFailures = 0
  let openedAt: number | null = null

  const isOpen = (now: number): boolean =>
    openedAt !== null && now - openedAt < breakerCooldownMs

  /**
   * Counts a failure and arms the breaker when the streak is long enough.
   * @param error - Upstream rejection.
   * @param now - Boundary-supplied current time.
   * @returns The rejection as an Error for the caller to rethrow.
   */
  const recordFailure = (error: unknown, now: number): Error => {
    consecutiveFailures += 1
    if (consecutiveFailures >= breakerFailureThreshold) {
      openedAt = now
    }
    return error instanceof Error ? error : new Error("Upstream request failed")
  }

  const run = async (
    send: () => Promise<Response>,
    now: number,
  ): Promise<Response> => {
    if (isOpen(now)) {
      throw new Error("Upstream source is circuit-broken")
    }

    let failure = new Error("Upstream request failed")
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await send()
        if (!response.ok) {
          throw new Error(`Upstream responded with status ${response.status}`)
        }
        consecutiveFailures = 0
        openedAt = null
        return response
      } catch (error) {
        failure = recordFailure(error, now)
        if (isOpen(now)) {
          break
        }
        if (attempt < maxAttempts - 1) {
          await sleep(attemptDelay(attempt))
        }
      }
    }

    throw failure
  }

  return { run, isOpen }
}
