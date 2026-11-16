import { curatedPapers } from "@/data/papers"
import { describe, expect, it } from "vitest"
import { formatBibtex, formatCitation } from "./citation"

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

describe("formatBibtex", () => {
  const fixture = curatedPapers.slice(0, 3)

  it("renders three parseable entries with stable keys", () => {
    const bib = formatBibtex(fixture)
    const entries = bib.split("\n\n")

    expect(entries).toHaveLength(3)
    expect(bib).toBe(formatBibtex(fixture))
    for (const entry of entries) {
      expect(entry.startsWith("@article{")).toBe(true)
      expect(entry.endsWith("}")).toBe(true)
      expect((entry.match(/{/g) ?? []).length).toBe(
        (entry.match(/}/g) ?? []).length,
      )
      expect(entry).toContain("  title = {")
      expect(entry).toContain("  year = {")
    }
    expect(entries.map((entry) => entry.split("{")[1]?.split(",")[0]))
      .toEqual(["Ortiz2025attention", "Chen2024fast", "Salgado2025carbon"])
  })

  it("maps doi.org sources to the doi field", () => {
    const paper = curatedPapers[0]
    if (paper === undefined) {
      throw new Error("missing curated paper fixture")
    }

    const bib = formatBibtex([{
      ...paper,
      externalUrl: "https://doi.org/10.1145/1234.5678",
    }])

    expect(bib).toContain("  doi = {10.1145/1234.5678}")
    expect(bib).toContain("@article{Ortiz2025attention,")
  })

  it("disambiguates colliding keys and escapes braces", () => {
    const paper = curatedPapers[0]
    if (paper === undefined) {
      throw new Error("missing curated paper fixture")
    }

    const bib = formatBibtex([
      { ...paper, title: "Braces {and} \\ backslash" },
      { ...paper, id: "duplicate", title: "Braces {and} \\ backslash" },
    ])

    expect(bib).toContain("@article{Ortiz2025braces,")
    expect(bib).toContain("@article{Ortiz2025braces2,")
    expect(bib).toContain(String.raw`title = {Braces \{and\} \\ backslash}`)
  })

  it("falls back to the paper id when metadata yields no key", () => {
    const paper = curatedPapers[0]
    if (paper === undefined) {
      throw new Error("missing curated paper fixture")
    }

    const bib = formatBibtex([{
      ...paper,
      authors: [],
      title: "!!!",
      id: "fallback-id",
    }])

    expect(bib).toContain("@article{fallbackid,")
  })

  it("renders an empty document for an empty set", () => {
    expect(formatBibtex([])).toBe("")
  })
})
