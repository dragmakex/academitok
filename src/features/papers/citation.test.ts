import { curatedPapers } from "@/data/papers"
import { describe, expect, it } from "vitest"
import { formatBibtex, formatCitation, formatEdition } from "./citation"

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

describe("formatEdition", () => {
  const fixture = curatedPapers.slice(0, 3)

  it("renders one masthead line and one line per clipping in page order", () => {
    const lines = formatEdition(fixture, "Evening Edition").split("\n")

    expect(lines).toHaveLength(4)
    expect(lines[0]).toBe("AcademiTok · Evening Edition · Folio 001")
    expect(lines.slice(1).map((line) => line.split(" — ")[1])).toEqual(
      fixture.map((paper) => paper.title),
    )
    for (const [index, paper] of fixture.entries()) {
      const line = lines[index + 1] ?? ""
      expect(line.startsWith(paper.topics[0] ?? "Research")).toBe(true)
      expect(line).toContain((paper.authors[0] ?? "") + ` (${paper.year})`)
      expect(line.endsWith(paper.externalUrl ?? paper.id)).toBe(true)
    }
  })

  it("prints the folio number and falls back to the paper id", () => {
    const paper = fixture[0]
    if (paper === undefined) {
      throw new Error("missing curated paper fixture")
    }
    const lines = formatEdition(
      [{ ...paper, externalUrl: undefined }],
      "Morning Edition",
      12,
    )
      .split("\n")

    expect(lines[0]).toBe("AcademiTok · Morning Edition · Folio 012")
    expect(lines[1]?.endsWith(paper.id)).toBe(true)
  })

  it("renders an empty notice for an empty page", () => {
    expect(formatEdition([], "Evening Edition")).toBe("")
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
