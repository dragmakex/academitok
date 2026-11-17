// @vitest-environment node

import type { Topic } from "@/api/paper-schema"
import * as EffectArray from "effect/Array"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  archivalDrift,
  citationAgeSkew,
  hashReaderId,
  medianCompletion,
  medianDwell,
  medianYear,
  reactionRates,
  readingCompletion,
  savesPerHundred,
  topicEntropy,
  trackFeedHealthEvent,
  trackPaperViewEvent,
  unmatchedBeatCount,
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

describe("readingCompletion", () => {
  it("reports the share of a two-minute clipping read for a minute", () => {
    expect(readingCompletion(60_000, 2)).toBe(0.5)
  })

  it("clamps over-reading to a full completion", () => {
    expect(readingCompletion(900_000, 2)).toBe(1)
  })

  it("reports nothing without a usable estimate", () => {
    expect(readingCompletion(60_000, null)).toBeNull()
    expect(readingCompletion(60_000, undefined)).toBeNull()
    expect(readingCompletion(60_000, 0)).toBeNull()
  })

  it("sends read time and completion on the dwell event only", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "test-key")
    vi.stubGlobal("window", {})
    const view = {
      paperId: "paper-1",
      position: 0,
      exploration: false,
    }

    trackPaperViewEvent({ ...view, kind: "dwell", dwellMs: 60_000 }, [], 2)
    trackPaperViewEvent({ ...view, kind: "view", dwellMs: 0 }, [], 2)
    await vi.waitFor(() => expect(capture).toHaveBeenCalledTimes(2))

    expect(capture).toHaveBeenCalledWith(
      "dwell",
      expect.objectContaining({
        dwell_ms: 60_000,
        read_minutes: 2,
        completion: 0.5,
      }),
    )
    expect(capture.mock.calls[1]?.[0]).toBe("impression")
    expect(capture.mock.calls[1]?.[1]).not.toHaveProperty("read_minutes")
  })
})

describe("medianDwell", () => {
  it("reports the middle dwell of an odd-sized sample", () => {
    expect(medianDwell([4_000, 6_000, 20_000])).toBe(6_000)
  })

  it("averages the two middle dwells of an even-sized sample", () => {
    expect(medianDwell([4_000, 6_000, 20_000, 30_000])).toBe(13_000)
  })

  it("reports no median when nothing was recorded", () => {
    expect(medianDwell([])).toBeNull()
  })
})

const windowKinds = (hides: number, opens: number) =>
  [
    ...Array<"hide">(hides).fill("hide"),
    ...Array<"open-site">(opens).fill("open-site"),
    ...Array<"view">(50).fill("view"),
  ] as const

describe("reactionRates", () => {
  it("reports the hide and open-source shares of the view window", () => {
    expect(reactionRates(windowKinds(1, 6), 50)).toEqual({
      hideRate: 0.02,
      openSourceRate: 0.12,
    })
  })

  it("ignores reactions older than the view window", () => {
    const kinds = [
      ...Array<"view">(50).fill("view"),
      "hide",
      "open-site",
    ] as const
    expect(reactionRates(kinds, 50)).toEqual({
      hideRate: 0,
      openSourceRate: 0,
    })
  })

  it("reports no rate when the window holds no impression", () => {
    expect(reactionRates([], 50)).toEqual({
      hideRate: null,
      openSourceRate: null,
    })
    expect(reactionRates(["hide", "open-site"], 50)).toEqual({
      hideRate: null,
      openSourceRate: null,
    })
  })
})

describe("savesPerHundred", () => {
  it("reports the saves per hundred impressions of the view window", () => {
    const kinds = [
      ...Array<"bookmark">(2).fill("bookmark"),
      ...Array<"view">(50).fill("view"),
    ] as const
    expect(savesPerHundred(kinds, 50)).toBeCloseTo(4, 5)
  })

  it("reports zero when the window holds views but no save", () => {
    expect(savesPerHundred(Array<"view">(50).fill("view"), 50)).toBe(0)
  })

  it("ignores saves older than the view window", () => {
    const kinds = [
      ...Array<"view">(50).fill("view"),
      "bookmark",
    ] as const
    expect(savesPerHundred(kinds, 50)).toBe(0)
  })

  it("reports no rate when the window holds no impression", () => {
    expect(savesPerHundred([], 50)).toBeNull()
    expect(savesPerHundred(["bookmark"], 50)).toBeNull()
  })
})

describe("medianCompletion", () => {
  it("reports the middle completion of a measurable sample", () => {
    expect(medianCompletion([0.5, 1, 0.25])).toBe(0.5)
  })

  it("drops clippings without a usable estimate instead of counting them as zero", () => {
    expect(medianCompletion([0.5, null, 0.5])).toBe(0.5)
  })

  it("reports no completion when nothing was measurable", () => {
    expect(medianCompletion([])).toBeNull()
    expect(medianCompletion([null, null])).toBeNull()
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

const clipping = (title: string, abstract: string) => ({ title, abstract })

describe("unmatchedBeatCount", () => {
  it("counts the clippings that matched no beat", () => {
    expect(
      unmatchedBeatCount([
        clipping("Potsherd stratigraphy", "Field notes from a dig."),
        clipping("Quantum sensors", "A material study."),
        clipping("Parish registers", "A list of names."),
      ]),
    )
      .toBe(2)
  })

  it("reports none when every clipping matched a beat", () => {
    expect(
      unmatchedBeatCount([
        clipping("Quantum sensors", "A material study."),
        clipping("Clinical medicine", "A patient study."),
      ]),
    )
      .toBe(0)
  })

  it("reports none for an empty page", () => {
    expect(unmatchedBeatCount([])).toBe(0)
  })
})

const dated = (year: number, citations: number) => ({ year, citations })

describe("citationAgeSkew", () => {
  it("splits the page on its median year and reports both medians", () => {
    expect(
      citationAgeSkew([dated(2010, 400), dated(2016, 50), dated(2024, 10)]),
    )
      .toEqual({ olderCitations: 400, newerCitations: 30 })
  })

  it("counts a clipping dated exactly the median year as newer", () => {
    expect(citationAgeSkew([dated(2010, 400), dated(2020, 7)])).toEqual({
      olderCitations: 400,
      newerCitations: 7,
    })
  })

  it("reports null for an empty page and for the empty side of one clipping", () => {
    expect(citationAgeSkew([])).toEqual({
      olderCitations: null,
      newerCitations: null,
    })
    expect(citationAgeSkew([dated(2020, 12)])).toEqual({
      olderCitations: null,
      newerCitations: 12,
    })
  })
})

const beat = (topics: ReadonlyArray<Topic>) => ({ topics })

describe("topicEntropy", () => {
  it("reports natural-log entropy for a page spread across beats", () => {
    expect(
      topicEntropy([beat(["AI"]), beat(["Biology"]), beat(["Physics"])]),
    )
      .toBeCloseTo(Math.log(3))
  })

  it("reports no entropy when every clipping shares one beat", () => {
    expect(topicEntropy(EffectArray.replicate(beat(["AI"]), 10)))
      .toBe(0)
  })

  it("reports no entropy for an empty page", () => {
    expect(topicEntropy([])).toBe(0)
  })
})

describe("archivalDrift", () => {
  it("reports the median and the clippings a decade behind the newest", () => {
    expect(archivalDrift([2010, 2016, 2024])).toEqual({
      medianYear: 2016,
      newestYear: 2024,
      olderThanDecade: 1,
      total: 3,
    })
  })

  it("does not count a clipping exactly ten years older", () => {
    expect(archivalDrift([2014, 2024])).toMatchObject({
      newestYear: 2024,
      olderThanDecade: 0,
    })
  })

  it("reports no year when the page has none", () => {
    expect(archivalDrift([])).toEqual({
      medianYear: null,
      newestYear: null,
      olderThanDecade: 0,
      total: 0,
    })
  })
})
