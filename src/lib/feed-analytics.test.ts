// @vitest-environment node

import type { FeedSnapshot } from "@/api/paper-schema"
import { curatedPapers } from "@/data/papers"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  hashReaderId,
  reactionFailureNotice,
  readingCompletion,
  trackFeedHealthEvent,
  trackFeedPageEvent,
  trackPaperViewEvent,
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

/**
 * Builds a snapshot carrying only the fields the page event reads.
 * @param origin - Catalogue path the page was served from.
 * @param papers - Papers on the page.
 * @returns Snapshot fixture.
 */
const snapshotWith = (
  origin: FeedSnapshot["origin"],
  papers: ReadonlyArray<FeedSnapshot["items"][number]["paper"]>,
): FeedSnapshot => ({
  origin,
  pinned: false,
  alsoKeptBy: {},
  alsoLikedBy: {},
  profile: null,
  selectedTopic: "All",
  selectedSort: "recommended",
  items: papers.map((paper) => ({
    paper,
    score: 0,
    accessible: true,
    liked: false,
    bookmarked: false,
    hidden: false,
    exploration: false,
    again: false,
  })),
  nextCursor: null,
  exploration: 0,
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

  it("reports the share of a one-minute clipping read for half a minute", () => {
    expect(readingCompletion(30_000, 1)).toBe(0.5)
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

describe("reactionFailureNotice", () => {
  it("names the reaction the desk refused", () => {
    expect(reactionFailureNotice("like")).toBe("Could not record the like")
    expect(reactionFailureNotice("bookmark")).toBe(
      "Could not file the clipping",
    )
    expect(reactionFailureNotice("hide")).toBe(
      "Could not hide the clipping",
    )
    expect(reactionFailureNotice("open-site")).toBe(
      "Could not record the opening",
    )
  })
})

describe("trackFeedPageEvent", () => {
  it("sends the edition the page was served from", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "test-key")
    vi.stubGlobal("window", {})

    for (const origin of ["pool", "live", "seed"] as const) {
      trackFeedPageEvent(snapshotWith(origin, curatedPapers.slice(0, 2)), null)
    }
    await vi.waitFor(() => expect(capture).toHaveBeenCalledTimes(3))
    expect(capture.mock.calls.map((call) => call[1])).toEqual([
      expect.objectContaining({ origin: "pool" }),
      expect.objectContaining({ origin: "live" }),
      expect.objectContaining({ origin: "seed" }),
    ])
  })

  it("still sends the origin for an empty page", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "test-key")
    vi.stubGlobal("window", {})

    trackFeedPageEvent(snapshotWith("seed", []), "cursor-1")
    await vi.waitFor(() => expect(capture).toHaveBeenCalledTimes(1))
    expect(capture).toHaveBeenCalledWith(
      "feed.next",
      expect.objectContaining({
        origin: "seed",
        cursor: "cursor-1",
        item_count: 0,
        cold_start: true,
      }),
    )
  })

  it("sends nothing while PostHog stays unconfigured", async () => {
    vi.stubGlobal("window", {})

    trackFeedPageEvent(snapshotWith("seed", []), null)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(capture).not.toHaveBeenCalled()
  })
})
