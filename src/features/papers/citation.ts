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
