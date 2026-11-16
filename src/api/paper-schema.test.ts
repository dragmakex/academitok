import { FeedPage, Paper, TrackPaperViewInput } from "@/api/paper-schema"
import { curatedPapers } from "@/data/papers"
import * as Schema from "effect/Schema"
import { describe, expect, it } from "vitest"

const decodePaper = Schema.decodeUnknownSync(Paper)
const decodeFeedPage = Schema.decodeUnknownSync(FeedPage)
const decodeImpression = Schema.decodeUnknownSync(TrackPaperViewInput)

describe("paper feed contracts", () => {
  it("round-trips paper metadata", () => {
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

    expect(
      decodeImpression({
        paperId: "paper-1",
        kind: "dwell",
        dwellMs: 4_200,
        position: 2,
        exploration: true,
      })
        .dwellMs,
    )
      .toBe(4_200)
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
