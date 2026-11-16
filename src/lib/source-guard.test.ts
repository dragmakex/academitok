import {
  attemptDelay,
  breakerCooldownMs,
  createSourceGuard,
} from "@/lib/source-guard"
import { describe, expect, it, vi } from "vitest"

const ok = () => Promise.resolve(new Response(null, { status: 200 }))

const harness = () => {
  let clock = 0
  const sleep = vi.fn((milliseconds: number) => {
    clock += milliseconds
    return Promise.resolve()
  })
  const guard = createSourceGuard(sleep)
  return {
    run: (send: () => Promise<Response>) => guard.run(send, clock),
    isOpen: () => guard.isOpen(clock),
    sleep,
    advance: (milliseconds: number) => {
      clock += milliseconds
    },
  }
}

const failure = (promise: Promise<unknown>) =>
  promise.then(() => null, (error: unknown) => error)

describe("source guard", () => {
  it("doubles the retry delay from one second and caps it at eight", () => {
    expect([0, 1, 2, 3, 9].map(attemptDelay))
      .toEqual([1_000, 2_000, 4_000, 8_000, 8_000])
  })

  it("retries a failing request on the doubling schedule", async () => {
    const guard = harness()
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"))
      .mockImplementation(ok)

    await guard.run(send)

    expect(send).toHaveBeenCalledTimes(3)
    expect(guard.sleep.mock.calls).toEqual([[1_000], [2_000]])
  })

  it("throws the upstream error once every attempt fails", async () => {
    const guard = harness()
    const send = vi.fn(() => Promise.reject(new Error("offline")))

    expect(await failure(guard.run(send))).toEqual(new Error("offline"))
    expect(send).toHaveBeenCalledTimes(3)
    expect(guard.sleep).toHaveBeenCalledTimes(2)
  })

  it("treats a non-ok response as a failure", async () => {
    const guard = harness()
    const send = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 503 }))
    )

    expect(await failure(guard.run(send)))
      .toEqual(new Error("Upstream responded with status 503"))
  })

  it("opens the breaker after three consecutive failures and skips the next fetch", async () => {
    const guard = harness()
    const send = vi.fn(() => Promise.reject(new Error("offline")))

    await failure(guard.run(send))
    expect(guard.isOpen()).toBe(true)

    send.mockClear()
    await failure(guard.run(send))
    expect(send).not.toHaveBeenCalled()
  })

  it("lets requests through again after the cooldown", async () => {
    const guard = harness()
    const send = vi.fn(() => Promise.reject(new Error("offline")))

    await failure(guard.run(send))
    guard.advance(breakerCooldownMs)

    await expect(guard.run(ok)).resolves.toBeInstanceOf(Response)
    expect(guard.isOpen()).toBe(false)
  })

  it("resets the streak on a single success", async () => {
    const guard = harness()
    const recovers = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"))
      .mockImplementation(ok)

    await guard.run(recovers)
    expect(guard.isOpen()).toBe(false)

    // Those two failures plus one more would open the breaker and cut this run
    // short, so reaching the second call proves the success reset the streak.
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockImplementation(ok)
    await expect(guard.run(send)).resolves.toBeInstanceOf(Response)
    expect(send).toHaveBeenCalledTimes(2)
    expect(guard.isOpen()).toBe(false)
  })
})
