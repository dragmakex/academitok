import { curatedPapers } from "@/data/papers"
import { describe, expect, it } from "vitest"
import { formatCitation } from "./citation"

describe("formatCitation", () => {
  it("prints authors, year, title, venue and source URL", () => {
    const paper = curatedPapers[0]
    if (paper === undefined) {
      throw new Error("missing curated paper fixture")
    }

    expect(formatCitation(paper)).toBe(
      "Leah Ortiz; Min Park; Rohan Iyer (2025). "
        + "Attention Maps for Transparent Scientific Discovery Agents. "
        + "NeurIPS Workshop on AI for Science. https://arxiv.org/",
    )
  })

  it("falls back to the paper id when no source URL exists", () => {
    const paper = curatedPapers[0]
    if (paper === undefined) {
      throw new Error("missing curated paper fixture")
    }

    expect(formatCitation({ ...paper, externalUrl: undefined })).toContain(
      `. ${paper.id}`,
    )
  })
})
