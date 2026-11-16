import type { ReaderState } from "@/api/paper-schema"
import { curatedPapers } from "@/data/papers"
import {
  buildFeedItems,
  buildFeedPage,
  buildFeedStats,
} from "@/features/papers/recommendation"
import { describe, expect, it } from "vitest"

const baseState: ReaderState = {
  profile: {
    name: "Ada",
    institution: "MIT",
    interests: ["AI", "Health"],
  },
  reactions: [],
}

describe("paper recommendation", () => {
  it("boosts papers that match interests", () => {
    const items = buildFeedItems(baseState, curatedPapers, "All", "recommended")
    expect(items[0]?.paper.topics.includes("AI")).toBe(true)
  })

  it("never resurfaces hidden papers in another ordering", () => {
    const target = curatedPapers[0]
    if (target === undefined) {
      throw new Error("missing curated paper fixture")
    }

    for (const sort of ["recommended", "latest", "citations"] as const) {
      const items = buildFeedItems(
        {
          ...baseState,
          reactions: [{
            paperId: target.id,
            kind: "hide",
            active: true,
            timestamp: Date.now(),
          }],
        },
        curatedPapers,
        "All",
        sort,
      )

      expect(items.some((item) => item.paper.id === target.id)).toBe(false)
    }
  })

  it("uses the newest toggle event as the current state", () => {
    const target = curatedPapers[0]
    if (target === undefined) {
      throw new Error("missing curated paper fixture")
    }

    const items = buildFeedItems(
      {
        ...baseState,
        reactions: [
          {
            paperId: target.id,
            kind: "hide",
            active: false,
            timestamp: Date.now(),
          },
          {
            paperId: target.id,
            kind: "hide",
            active: true,
            timestamp: Date.now() - 1,
          },
        ],
      },
      curatedPapers,
      "All",
      "recommended",
    )

    expect(items.some((item) => item.paper.id === target.id)).toBe(true)
  })

  it("reports accessible paper counts", () => {
    const items = buildFeedItems(baseState, curatedPapers, "All", "recommended")
    const stats = buildFeedStats(items)
    expect(stats.total).toBe(items.length)
    expect(stats.institutionAccess).toBeGreaterThan(0)
  })

  it("boosts papers with deeper engagement signals", () => {
    const target = curatedPapers[0]
    if (target === undefined) {
      throw new Error("missing curated paper fixture")
    }

    const items = buildFeedItems(
      {
        ...baseState,
        reactions: [
          {
            paperId: target.id,
            kind: "view",
            active: true,
            timestamp: Date.now(),
          },
          {
            paperId: target.id,
            kind: "dwell",
            active: true,
            timestamp: Date.now(),
            dwellMs: 12_000,
          },
          {
            paperId: target.id,
            kind: "open-site",
            active: true,
            timestamp: Date.now(),
          },
        ],
      },
      curatedPapers,
      "All",
      "recommended",
    )

    expect(items[0]?.paper.id).toBe(target.id)
    expect(items[0]?.rationale).toContain("Held your attention")
  })

  it("rewards a long read more than a brief skip", () => {
    const target = curatedPapers[0]
    if (target === undefined) {
      throw new Error("missing curated paper fixture")
    }
    const scoreAfter = (dwellMs: number) =>
      buildFeedItems(
        {
          ...baseState,
          reactions: [{
            paperId: target.id,
            kind: "dwell",
            active: true,
            timestamp: Date.now(),
            dwellMs,
          }],
        },
        curatedPapers,
        "All",
        "recommended",
      )
        .find((item) => item.paper.id === target.id)
        ?.score ?? 0

    expect(scoreAfter(12_000)).toBeGreaterThan(scoreAfter(800))
  })

  it("pages without duplicate papers or topic monopolies", () => {
    const ranked = buildFeedItems(
      baseState,
      curatedPapers,
      "All",
      "recommended",
    )
    const first = buildFeedPage(ranked, null, 5)
    const second = buildFeedPage(ranked, first.nextCursor, 5)
    const ids = [...first.items, ...second.items].map((item) => item.paper.id)
    const primaryTopicCounts = first.items.reduce((counts, item) => {
      const topic = item.paper.topics[0]
      if (topic !== undefined) {
        counts.set(topic, (counts.get(topic) ?? 0) + 1)
      }
      return counts
    }, new Map<string, number>())

    expect(new Set(ids).size).toBe(ids.length)
    expect([...primaryTopicCounts.values()].every((count) => count <= 2)).toBe(
      true,
    )
    expect(first.items.filter((item) => item.exploration)).toHaveLength(1)
  })
})
