import { fetchOpenAlexPapers, indexToText } from "@/lib/openalex"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.unstubAllGlobals())

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
