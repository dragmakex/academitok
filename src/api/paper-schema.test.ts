import {
  FeedPage,
  FeedRequest,
  OnboardProfileInput,
  Paper,
  TrackPaperViewInput,
  TrackPaperViewsInput,
} from "@/api/paper-schema"
import { curatedPapers } from "@/data/papers"
import * as Schema from "effect/Schema"
import { describe, expect, it } from "vitest"

const decodePaper = Schema.decodeUnknownSync(Paper)
const decodeFeedPage = Schema.decodeUnknownSync(FeedPage)
const decodeImpression = Schema.decodeUnknownSync(TrackPaperViewInput)
const decodeImpressions = Schema.decodeUnknownSync(TrackPaperViewsInput)
const decodeOnboarding = Schema.decodeUnknownSync(OnboardProfileInput)
const decodeFeedRequest = Schema.decodeUnknownSync(FeedRequest)

describe("paper feed contracts", () => {
  it("round-trips the fifteen offline onboarding candidates", () => {
    expect(curatedPapers).toHaveLength(15)
    const paper = curatedPapers[0]
    expect(paper).toBeDefined()
    expect(decodePaper(paper)).toEqual(paper)
  })

  it("accepts feed pages and measured impressions", () => {
    expect(decodeFeedPage({
      items: [],
      nextCursor: null,
      exploration: 0,
    }))
      .toMatchObject({ items: [], nextCursor: null, exploration: 0 })

    const impression = {
      paperId: "paper-1",
      kind: "dwell" as const,
      dwellMs: 4_200,
      position: 2,
      exploration: true,
    }
    expect(decodeImpression(impression).dwellMs).toBe(4_200)
    expect(decodeImpressions([impression])).toHaveLength(1)
  })

  it("requires five onboarding keeps unless onboarding is skipped", () => {
    expect(
      decodeOnboarding({
        keptPaperIds: ["1", "2", "3", "4", "5"],
        rejectedPaperIds: [
          "6",
          "7",
          "8",
          "9",
          "10",
          "11",
          "12",
          "13",
          "14",
          "15",
        ],
        skipped: false,
      })
        .skipped,
    )
      .toBe(false)
    expect(
      decodeOnboarding({
        keptPaperIds: [],
        rejectedPaperIds: [],
        skipped: true,
      })
        .skipped,
    )
      .toBe(true)
    expect(() =>
      decodeOnboarding({
        keptPaperIds: ["1", "2", "3", "4"],
        rejectedPaperIds: [],
        skipped: false,
      })
    )
      .toThrow()
  })

  it("pins at most ten edition ids on a feed request", () => {
    const request = {
      query: { topic: "All" as const, sort: "recommended" as const },
      cursor: null,
    }
    expect(decodeFeedRequest({ ...request, edition: ["paper-1", "paper-2"] }))
      .toMatchObject({ edition: ["paper-1", "paper-2"] })
    expect(() =>
      decodeFeedRequest({
        ...request,
        edition: curatedPapers.slice(0, 11).map((paper) => paper.id),
      })
    )
      .toThrow()
  })

  it("rejects invalid impression kinds", () => {
    expect(() =>
      decodeImpression({
        paperId: "paper-1",
        kind: "share",
        dwellMs: 0,
        position: 0,
        exploration: false,
      })
    )
      .toThrow()
  })
})
