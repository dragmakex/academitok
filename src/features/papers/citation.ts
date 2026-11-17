import type { Paper } from "@/api/paper-schema"

/**
 * Renders the plain-text citation for one paper.
 * @param paper - Paper metadata.
 * @returns Authors, year, title, venue and the DOI or source URL.
 */
export function formatCitation(paper: Paper): string {
  const authors = paper.authors.join("; ")
  const locator = paper.externalUrl ?? paper.id
  return `${authors} (${paper.year}). ${paper.title}. ${paper.venue}. ${locator}`
}

/**
 * Renders a loaded edition as a plain-text broadsheet notice.
 * @param papers - Page clippings in page order.
 * @param edition - Edition name printed in the masthead.
 * @param folio - Folio number of the loaded page.
 * @returns Masthead line plus one clipping line each, or an empty string when the page is empty.
 */
export function formatEdition(
  papers: ReadonlyArray<Paper>,
  edition: string,
  folio = 1,
): string {
  if (papers.length === 0) {
    return ""
  }

  return [
    `AcademiTok · ${edition} · Folio ${String(folio).padStart(3, "0")}`,
    ...papers.map((paper) =>
      [
        paper.topics[0] ?? "Research",
        paper.title,
        `${paper.authors[0] ?? "Unknown"} (${paper.year})`,
        paper.externalUrl ?? paper.id,
      ]
        .join(" — ")
    ),
  ]
    .join("\n")
}

/**
 * Renders a reopenable link for a loaded edition.
 * @param papers - Page clippings in page order.
 * @param baseUrl - Origin the link points at.
 * @returns Parametric feed link, or an empty string when the page is empty.
 */
export function formatEditionLink(
  papers: ReadonlyArray<Paper>,
  baseUrl: string,
): string {
  return papers.length === 0
    ? ""
    : `${baseUrl}/?edition=${papers.map((paper) => paper.id).join(",")}`
}

/**
 * Escapes a value for a braced BibTeX field.
 * @param value - Raw metadata.
 * @returns Single-line value with braces and backslashes escaped.
 */
function bibtexValue(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim().replaceAll(
    /[\\{}]/g,
    (match) => `\\${match}`,
  )
}

/**
 * Derives a readable key from the first author's surname, year and first title word.
 * @param paper - Paper metadata.
 * @returns Stable alphanumeric key.
 */
function bibtexKey(paper: Paper): string {
  const surname = paper.authors[0]?.trim().split(/\s+/).at(-1) ?? ""
  const titleWord = paper.title.toLowerCase().match(/[a-z0-9]+/)?.[0] ?? ""
  if (surname === "" && titleWord === "") {
    return paper.id.replaceAll(/[^a-zA-Z0-9]/g, "") || "paper"
  }
  return `${surname}${paper.year}${titleWord}`.replaceAll(/[^a-zA-Z0-9]/g, "")
}

/**
 * Renders a BibTeX document, one `@article` per paper.
 * Keys are derived from metadata and disambiguated by input order.
 * @param papers - Papers to export, typically the saved set.
 * @returns `.bib` source, or an empty string when there is nothing saved.
 */
export function formatBibtex(papers: ReadonlyArray<Paper>): string {
  const used = new Set<string>()

  return papers
    .map((paper) => {
      const base = bibtexKey(paper)
      let key = base
      for (let suffix = 2; used.has(key); suffix++) {
        key = `${base}${suffix}`
      }
      used.add(key)

      const fields = [
        `  author = {${paper.authors.map(bibtexValue).join(" and ")}}`,
        `  title = {${bibtexValue(paper.title)}}`,
        `  journal = {${bibtexValue(paper.venue)}}`,
        `  year = {${paper.year}}`,
      ]
      const doi = paper.externalUrl === undefined
        ? undefined
        : /^https?:\/\/(?:dx\.)?doi\.org\/(.+)$/i.exec(paper.externalUrl)?.[1]
      if (doi !== undefined) {
        fields.push(`  doi = {${bibtexValue(doi)}}`)
      }
      if (paper.externalUrl !== undefined) {
        fields.push(`  url = {${bibtexValue(paper.externalUrl)}}`)
      }

      return `@article{${key},\n${fields.join(",\n")},\n}`
    })
    .join("\n\n")
}
