import type { FeedItem, Paper, ReaderState } from "@/api/paper-schema"
import { curatedPapers } from "@/data/papers"
import {
  buildContentCentroid,
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

const paperFixture = (
  id: string,
  abstract: string,
  overrides: Partial<Paper> = {},
): Paper => ({
  id,
  title: `Paper ${id}`,
  authors: [`Author ${id}`],
  abstract,
  summary: abstract,
  year: 2024,
  venue: "Test Journal",
  topics: ["AI"],
  access: "open",
  citations: 0,
  readMinutes: 5,
  site: "OpenAlex",
  source: "curated",
  ...overrides,
})

describe("paper recommendation", () => {
  it("builds a centroid from active source abstracts", () => {
    const papers = [
      paperFixture("left", "alpha alpha beta"),
      paperFixture("right", "alpha beta beta"),
      paperFixture("ignored", "gamma delta"),
    ]

    const centroid = buildContentCentroid(
      papers,
      new Set(["left", "right"]),
    )

    expect(centroid.get("alpha")).toBeCloseTo(centroid.get("beta") ?? 0)
    expect(centroid.has("gamma")).toBe(false)
  })

  it.each(["like", "bookmark"] as const)(
    "ranks abstracts similar to %sd content above unrelated abstracts",
    (kind) => {
      const papers = [
        paperFixture("source", "neural networks learn image representations"),
        paperFixture("similar", "neural networks learn visual representations"),
        paperFixture("unrelated", "ocean currents alter coastal sediment"),
      ]
      const items = buildFeedItems(
        {
          profile: null,
          reactions: [{
            paperId: "source",
            kind,
            active: true,
            timestamp: Date.now(),
          }],
        },
        papers,
        "All",
        "recommended",
      )
      const rank = (id: string) =>
        items.findIndex((item) => item.paper.id === id)

      expect(rank("similar")).toBeLessThan(rank("unrelated"))
    },
  )

  it("uses onboarding keeps for topic and content affinity", () => {
    const papers = [
      paperFixture("kept", "neural networks learn image representations"),
      paperFixture("similar", "neural networks learn visual representations"),
      paperFixture("unrelated", "ocean currents alter coastal sediment", {
        topics: ["Climate"],
      }),
      paperFixture("rejected", "neural networks classify images"),
    ]
    const items = buildFeedItems(
      {
        profile: {
          name: "Guest Reader",
          institution: "Guest",
          interests: [],
        },
        reactions: [
          {
            paperId: "kept",
            kind: "onboard-keep",
            active: true,
            timestamp: Date.now(),
          },
          {
            paperId: "rejected",
            kind: "onboard-reject",
            active: true,
            timestamp: Date.now(),
          },
        ],
      },
      papers,
      "All",
      "recommended",
    )
    const rank = (id: string) => items.findIndex((item) => item.paper.id === id)

    expect(rank("similar")).toBeLessThan(rank("unrelated"))
    expect(rank("rejected")).toBe(-1)
  })

  it("ranks later papers by a repeatedly liked author above unrelated work", () => {
    const papers = [
      paperFixture("source-left", "shared neutral abstract", {
        authors: ["Shared Author"],
        venue: "Journal One",
      }),
      paperFixture("source-right", "shared neutral abstract", {
        authors: ["Shared Author"],
        venue: "Journal Two",
      }),
      paperFixture("unrelated", "shared neutral abstract", {
        authors: ["Other Author"],
        venue: "Journal Three",
      }),
      paperFixture("later", "shared neutral abstract", {
        authors: ["Shared Author"],
        venue: "Journal Four",
      }),
    ]
    const timestamp = Date.now()
    const items = buildFeedItems(
      {
        profile: null,
        reactions: ["source-left", "source-right"].map((paperId) => ({
          paperId,
          kind: "like" as const,
          active: true,
          timestamp,
        })),
      },
      papers,
      "All",
      "recommended",
    )
    const rank = (id: string) => items.findIndex((item) => item.paper.id === id)

    expect(rank("later")).toBeLessThan(rank("unrelated"))
  })

  it("boosts papers that match interests", () => {
    const items = buildFeedItems(baseState, curatedPapers, "All", "recommended")
    expect(items[0]?.paper.topics.includes("AI")).toBe(true)
  })

  it("explains a cold-start paper with only its beat", () => {
    const paper = paperFixture("cold", "a neutral abstract", {
      topics: ["Climate"],
      citations: 500,
    })

    const [item] = buildFeedItems(
      { profile: null, reactions: [] },
      [paper],
      "All",
      "recommended",
    )

    expect(item?.rationale).toEqual(["Climate"])
  })

  it("explains the strongest affinity term that raised a paper's score", () => {
    const papers = [
      paperFixture("liked", "neural networks learn image representations"),
      paperFixture("similar", "neural networks learn visual representations", {
        topics: ["Climate"],
        venue: "Different Journal",
      }),
      paperFixture("unrelated", "ocean currents alter coastal sediment", {
        topics: ["Health"],
      }),
    ]

    const items = buildFeedItems(
      {
        profile: null,
        reactions: [{
          paperId: "liked",
          kind: "like",
          active: true,
          timestamp: Date.now(),
        }],
      },
      papers,
      "All",
      "recommended",
    )

    expect(items.find((item) => item.paper.id === "similar")?.rationale)
      .toEqual(["Similar to papers you liked or saved"])
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

  it("demotes a near-duplicate that raw score ranks ahead", () => {
    const candidates: ReadonlyArray<
      readonly [string, string, Paper["topics"][number], number]
    > = [
      ["leader", "neural networks classify medical images", "AI", 10],
      ["near", "neural networks classify medical images", "AI", 9.9],
      ["diverse", "ocean currents reshape coastal sediment", "Health", 9.8],
      ["explore", "forest fungi exchange soil nutrients", "Climate", 2],
      ["filler-left", "protein folding under pressure", "Biology", 1],
      ["filler-right", "quantum states in new materials", "Physics", 0.5],
    ]
    const ranked: ReadonlyArray<FeedItem> = candidates.map(
      ([id, abstract, topic, score]) => ({
        paper: paperFixture(id, abstract, { topics: [topic] }),
        score,
        rationale: [],
        accessible: true,
        liked: false,
        bookmarked: false,
        hidden: false,
        exploration: false,
      }),
    )

    expect(ranked.findIndex((item) => item.paper.id === "near")).toBeLessThan(
      ranked.findIndex((item) => item.paper.id === "diverse"),
    )

    const page = buildFeedPage(ranked, null, 4)
    expect(page.items.findIndex((item) => item.paper.id === "diverse"))
      .toBeLessThan(
        page.items.findIndex((item) => item.paper.id === "near"),
      )
  })

  it("pages without duplicate papers, topic monopolies, or repeated authors", () => {
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
    const authors = first.items.flatMap((item) => item.paper.authors)

    expect([...primaryTopicCounts.values()].every((count) => count <= 2)).toBe(
      true,
    )
    expect(new Set(authors).size).toBe(authors.length)
    expect(first.items.filter((item) => item.exploration)).toHaveLength(1)
  })

  it("skips papers the server session already emitted, even on a stale cursor", () => {
    const topics = ["AI", "Physics", "Biology"] as const
    const ids = ["p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"]
    const ranked: ReadonlyArray<FeedItem> = ids.map((id, index) => ({
      paper: paperFixture(id, `abstract ${id}`, {
        topics: [topics[index % topics.length] ?? "AI"],
      }),
      score: 9 - index,
      rationale: [],
      accessible: true,
      liked: false,
      bookmarked: false,
      hidden: false,
      exploration: false,
    }))

    const first = buildFeedPage(ranked, null, 3)
    const seen = first.items.map((item) => item.paper.id)
    const stale = buildFeedPage(ranked, null, 3, seen)

    expect(seen).toHaveLength(3)
    expect(stale.items.filter((item) => seen.includes(item.paper.id)))
      .toHaveLength(0)
  })
})
