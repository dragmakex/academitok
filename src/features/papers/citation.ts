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
