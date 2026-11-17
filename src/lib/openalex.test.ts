import type { Paper } from "@/api/paper-schema"
import { curatedPapers } from "@/data/papers"
import {
  collapseTitleDuplicates,
  estimateReadMinutes,
  fetchOpenAlexPapers,
  indexToText,
} from "@/lib/openalex"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.unstubAllGlobals())

const paperWithTitle = (title: string): Paper => ({
  id: title,
  title,
  authors: ["Ada Lovelace"],
  abstract: "An abstract.",
  summary: "An abstract.",
  year: 2024,
  venue: "OpenAlex",
  topics: ["Physics"],
  access: "open",
  citations: 0,
  readMinutes: 1,
  site: "OpenAlex",
  source: "openalex",
})

describe("OpenAlex abstract reconstruction", () => {
  it("preserves position order without duplicating words", () => {
    expect(indexToText({
      reliable: [3],
      feeds: [1],
      research: [2],
      AcademiTok: [0],
    }))
      .toBe("AcademiTok feeds research reliable")
  })

  it("reuses a catalog page instead of repeating upstream requests", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ results: [] })))
    )
    vi.stubGlobal("fetch", fetchMock)

    await fetchOpenAlexPapers("Psychology", "recommended", 0)
    await fetchOpenAlexPapers("Psychology", "recommended", 1_000)

    expect(fetchMock).toHaveBeenCalledOnce()
  })
})

const words = (count: number) => "word ".repeat(count).trim()

describe("Reading time", () => {
  it("measures the served text at 200 words per minute", () => {
    expect(estimateReadMinutes(words(40))).toBe(1)
    expect(estimateReadMinutes(words(200))).toBe(1)
    expect(estimateReadMinutes(words(900))).toBe(5)
    expect(estimateReadMinutes(words(4_000))).toBe(10)
  })

  it("never reports less than a minute for empty text", () => {
    expect(estimateReadMinutes("")).toBe(1)
  })

  it("derives every seed clipping's read time from its own abstract", () => {
    for (const paper of curatedPapers) {
      expect(paper.readMinutes).toBe(estimateReadMinutes(paper.abstract))
    }
  })
})

describe("Title near-duplicate collapse", () => {
  it("collapses titles differing only in case and punctuation to the first", () => {
    const first = paperWithTitle("Quantum Walks in Disordered Lattices")
    const second = paperWithTitle("quantum walks, in disordered lattices!")

    expect(collapseTitleDuplicates([first, second])).toEqual([first])
  })

  it("collapses titles sharing more than nine tenths of their tokens", () => {
    const first = paperWithTitle(
      "one two three four five six seven eight nine ten",
    )
    const second = paperWithTitle(
      "one two three four five six seven eight nine ten eleven",
    )

    expect(collapseTitleDuplicates([first, second])).toEqual([first])
  })

  it("keeps unrelated titles in input order", () => {
    const papers = [
      paperWithTitle("Glacial retreat in the Andes"),
      paperWithTitle("Neural scaling laws revisited"),
      paperWithTitle("Monetary policy under uncertainty"),
    ]

    expect(collapseTitleDuplicates(papers)).toEqual(papers)
  })

  it("keeps titles at the similarity boundary", () => {
    const first = paperWithTitle("a b c d e f g h i")
    const second = paperWithTitle("a b c d e f g h i trail")

    expect(collapseTitleDuplicates([first, second])).toEqual([first, second])
  })

  it("never collapses distinct one-token titles", () => {
    const first = paperWithTitle("Physics")
    const second = paperWithTitle("Biology")

    expect(collapseTitleDuplicates([first, second])).toEqual([first, second])
  })
})
