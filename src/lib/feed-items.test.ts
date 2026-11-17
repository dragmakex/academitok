import type { FeedItem } from "@/api/paper-schema"
import { curatedPapers } from "@/data/papers"
import { appendPaperPage, removeItemAt, restoreItem } from "@/lib/feed-items"
import { describe, expect, it } from "vitest"

const page = ["a", "b", "c"] as const

const item = (id: string): FeedItem => ({
  paper: curatedPapers.find((paper) => paper.id === id) ?? {
    ...curatedPapers[0]!,
    id,
  },
  score: 1,
  rationale: ["fresh"],
  accessible: true,
  liked: false,
  bookmarked: false,
  hidden: false,
  exploration: false,
  again: false,
})

describe("removeItemAt", () => {
  it("reports the item and the index it left", () => {
    expect(removeItemAt(page, 1)).toEqual({
      items: ["a", "c"],
      removed: { item: "b", index: 1 },
    })
  })

  it("leaves the page untouched for an empty slot", () => {
    expect(removeItemAt(page, 3)).toEqual({ items: page, removed: null })
  })
})

describe("restoreItem", () => {
  it("round-trips a three-item page from every slot", () => {
    for (const index of [0, 1, 2]) {
      const result = removeItemAt(page, index)
      expect(result.removed).not.toBeNull()
      if (result.removed === null) {
        continue
      }
      expect(restoreItem(result.items, result.removed)).toEqual([...page])
    }
  })

  it("clamps a slot past the end of the page", () => {
    expect(restoreItem(["a"], { item: "z", index: 7 })).toEqual(["a", "z"])
  })
})

describe("appendPaperPage", () => {
  const snapshot = {
    origin: "seed",
    pinned: true,
    alsoKeptBy: {
      a: 1,
    } as Record<string, number>,
    profile: null,
    selectedTopic: "All",
    selectedSort: "recommended",
    stats: {
      total: 0,
      openAccess: 0,
      institutionAccess: 0,
      liked: 0,
      bookmarked: 0,
      medianDwellMs: null,
      medianCompletion: null,
      hideRate: null,
      openSourceRate: null,
      savesPerHundred: null,
      windowTopicEntropy: null,
      windowMedianYear: null,
      windowOlderCitations: null,
      windowNewerCitations: null,
      windowDuplicateRate: null,
      windowMedianReadMinutes: null,
      windowDwellEntropy: null,
      windowTopDwellBeat: null,
    },
    items: [item("a")],
    nextCursor: "cursor-1",
    exploration: 0,
  } as const

  it("keeps the first page's origin and pinned flag", () => {
    const next = appendPaperPage(snapshot, {
      ...snapshot,
      pinned: false,
      items: [item("b")],
      nextCursor: null,
    })

    expect(next.origin).toBe("seed")
    expect(next.pinned).toBe(true)
    expect(next.items.map((entry) => entry.paper.id)).toEqual(["a", "b"])
  })

  it("merges the filing counts of both pages", () => {
    const next = appendPaperPage(snapshot, {
      ...snapshot,
      alsoKeptBy: { b: 2 },
      items: [item("b")],
      nextCursor: null,
    })

    expect(next.alsoKeptBy).toEqual({ a: 1, b: 2 })
  })

  it("does not repeat a clipping already on the deck", () => {
    const next = appendPaperPage(snapshot, {
      ...snapshot,
      items: [item("a"), item("b")],
      nextCursor: null,
    })

    expect(next.items.map((entry) => entry.paper.id)).toEqual(["a", "b"])
  })
})
