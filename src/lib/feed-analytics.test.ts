// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  hashReaderId,
  medianYear,
  trackFeedHealthEvent,
} from "./feed-analytics"

const { capture } = vi.hoisted(() => ({ capture: vi.fn() }))

vi.mock("@/lib/client-init", () => ({
  getPostHogClient: vi.fn(() =>
    Promise.resolve({
      capture,
      get_distinct_id: vi.fn(() => "reader-123"),
    })
  ),
}))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  capture.mockClear()
})

describe("feed analytics", () => {
  it("hashes reader identifiers with SHA-256", async () => {
    expect(await hashReaderId("reader-123")).toBe(
      "b350a39385fccf30e4534d91b026b5317a3b9cc4e48f855c0a15aed315517c66",
    )
  })

  it("attaches only the hashed reader identifier", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "test-key")
    vi.stubGlobal("window", {})

    await trackFeedHealthEvent("impression", { paper_id: "paper-1" })

    expect(capture).toHaveBeenCalledWith("impression", {
      paper_id: "paper-1",
      reader_id_hash:
        "b350a39385fccf30e4534d91b026b5317a3b9cc4e48f855c0a15aed315517c66",
    })
  })
})

describe("medianYear", () => {
  it("reports the middle year of an odd-sized page", () => {
    expect(medianYear([2024, 2019, 2022])).toBe(2022)
  })

  it("averages the two middle years of an even-sized page", () => {
    expect(medianYear([2019, 2024, 2022, 2020])).toBe(2021)
  })

  it("reports no median for an empty page", () => {
    expect(medianYear([])).toBeNull()
  })
})
