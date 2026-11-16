import type {
  FeedSort,
  Paper,
  PaperSite,
  Topic,
  TopicFilter,
} from "@/api/paper-schema"
import { curatedPapers } from "@/data/papers"
import { createSourceGuard } from "@/lib/source-guard"
import { matchedTopics } from "@/lib/topic-beats"

const baseUrl = "https://api.openalex.org/works"
const cacheTtlMs = 24 * 60 * 60 * 1_000
const catalogCache = new Map<
  string,
  {
    readonly expiresAt: number
    readonly promise: Promise<ReadonlyArray<Paper>>
  }
>()
let openAlexRequestQueue: Promise<void> = Promise.resolve()

const catalogGuard = createSourceGuard((milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
)

const topicSearchTerms: Record<TopicFilter, string> = {
  All: "research discovery scholarly paper",
  AI: "artificial intelligence machine learning",
  Biology: "biology genomics protein",
  Climate: "climate sustainability carbon",
  Education: "education learning pedagogy",
  Economics: "economics markets policy",
  Health: "health medicine clinical",
  Physics: "physics quantum materials",
  Psychology: "psychology cognition behavior",
  Robotics: "robotics autonomous systems",
}

type OpenAlexAuthor = {
  readonly author?: {
    readonly display_name?: string
  }
}

type OpenAlexLocation = {
  readonly pdf_url?: string | null
  readonly landing_page_url?: string | null
  readonly source?: {
    readonly display_name?: string | null
  }
}

type OpenAlexWork = {
  readonly id?: string
  readonly title?: string
  readonly authorships?: ReadonlyArray<OpenAlexAuthor>
  readonly abstract_inverted_index?: Record<string, ReadonlyArray<number>>
  readonly publication_year?: number
  readonly primary_location?: OpenAlexLocation | null
  readonly best_oa_location?: OpenAlexLocation | null
  readonly open_access?: {
    readonly is_oa?: boolean
  }
  readonly cited_by_count?: number
}

type OpenAlexResponse = {
  readonly results?: ReadonlyArray<OpenAlexWork>
}

/**
 * Reconstructs an OpenAlex abstract.
 * @param index - Inverted word index.
 * @returns Ordered abstract text.
 */
export function indexToText(
  index: Record<string, ReadonlyArray<number>> | undefined,
): string {
  if (index === undefined) {
    return ""
  }

  return Object
    .entries(index)
    .flatMap(([word, positions]) =>
      positions.map((position) => ({ position, word }))
    )
    .sort((left, right) => left.position - right.position)
    .map((item) => item.word)
    .join(" ")
}

/**
 * Maps text onto fixed beats, filing anything unmatched under Education (SPEC §17.2).
 * @param title - Paper title.
 * @param abstract - Paper abstract.
 * @returns Matching beats, or the Education fallback.
 */
export function detectTopics(
  title: string,
  abstract: string,
): ReadonlyArray<Topic> {
  const matches = matchedTopics(title, abstract)
  return matches.length > 0 ? matches : ["Education"]
}

/**
 * Estimates reading time.
 * @param text - Abstract text.
 * @returns Bounded minutes.
 */
function estimateReadMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(4, Math.min(18, Math.round(words / 180) || 6))
}

/**
 * Identifies a metadata source.
 * @param url - Landing URL.
 * @returns Known source label.
 */
function inferSite(url: string | undefined): PaperSite {
  if (url === undefined) {
    return "OpenAlex"
  }

  if (url.includes("arxiv.org")) {
    return "arXiv"
  }
  if (url.includes("biorxiv.org")) {
    return "bioRxiv"
  }
  if (url.includes("pmc.ncbi.nlm.nih.gov")) {
    return "PubMed Central"
  }
  if (url.includes("openreview.net")) {
    return "OpenReview"
  }
  if (url.includes("hal.science")) {
    return "HAL"
  }

  return "OpenAlex"
}

/**
 * Converts an OpenAlex work.
 * @param work - Source work.
 * @returns Paper metadata or null when incomplete.
 */
function mapWorkToPaper(work: OpenAlexWork): Paper | null {
  const title = work.title?.trim() ?? ""
  const abstract = indexToText(work.abstract_inverted_index).trim()
  if (
    title.length === 0 || abstract.length === 0 || work
        .publication_year === undefined
  ) {
    return null
  }

  const authors = (work.authorships ?? [])
    .map((authorship) => authorship.author?.display_name?.trim())
    .filter((value): value is string =>
      typeof value === "string" && value.length > 0
    )
    .slice(0, 6)

  const externalUrl = work.best_oa_location?.landing_page_url
    ?? work.primary_location?.landing_page_url
    ?? work.id

  return {
    id: work.id
      ?? `openalex-${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`,
    title,
    authors: authors.length > 0 ? authors : ["Unknown authors"],
    abstract,
    summary: abstract.length > 220 ? `${abstract.slice(0, 217)}...` : abstract,
    year: work.publication_year,
    venue: work.primary_location?.source?.display_name?.trim() || "OpenAlex",
    topics: [...detectTopics(title, abstract)],
    access: work.open_access?.is_oa === true ? "open" : "institution",
    citations: work.cited_by_count ?? 0,
    readMinutes: estimateReadMinutes(abstract),
    site: inferSite(externalUrl),
    source: "openalex",
    externalUrl,
  }
}

/**
 * Removes exact title duplicates.
 * @param papers - Candidate papers.
 * @returns Deduplicated papers.
 */
function dedupeByTitle(papers: ReadonlyArray<Paper>): ReadonlyArray<Paper> {
  const seen = new Set<string>()
  return papers.filter((paper) => {
    const key = paper.title.toLowerCase()
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

/**
 * Fetches one bounded OpenAlex page while serializing requests to the host and
 * holding the retry schedule and circuit breaker from `sourceGuard`.
 * @param topic - Requested beat.
 * @param sort - Requested ordering.
 * @param now - Boundary-supplied current time.
 * @returns Paper metadata.
 */
async function requestOpenAlexPapers(
  topic: TopicFilter,
  sort: FeedSort,
  now: number,
): Promise<ReadonlyArray<Paper>> {
  const params = new URLSearchParams({
    search: topicSearchTerms[topic],
    per_page: "50",
    page: "1",
    sort: sort === "citations"
      ? "cited_by_count:desc"
      : "publication_date:desc",
    filter:
      "is_paratext:false,language:en,has_abstract:true,type:article|preprint",
  })
  const mailto = process.env.OPENALEX_MAILTO
  if (mailto !== undefined && mailto.length > 0) {
    params.set("mailto", mailto)
  }

  const request = openAlexRequestQueue.then(() =>
    catalogGuard.run(
      () =>
        fetch(`${baseUrl}?${params.toString()}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(10_000),
        }),
      now,
    )
  )
  openAlexRequestQueue = request.then(
    () => undefined,
    () => undefined,
  )
  const response = await request
  const json = await response.json() as OpenAlexResponse
  const mapped = (json.results ?? [])
    .map(mapWorkToPaper)
    .filter((paper): paper is Paper => paper !== null)

  return dedupeByTitle([...mapped, ...curatedPapers]).slice(0, 58)
}

/**
 * Fetches cached OpenAlex metadata without concurrent requests to the host.
 * @param topic - Requested beat.
 * @param sort - Requested ordering.
 * @param now - Boundary-supplied current time.
 * @returns Paper metadata.
 */
export function fetchOpenAlexPapers(
  topic: TopicFilter,
  sort: FeedSort,
  now: number,
): Promise<ReadonlyArray<Paper>> {
  const key = `${topic}:${sort}`
  const cached = catalogCache.get(key)
  if (cached !== undefined && cached.expiresAt > now) {
    return cached.promise
  }

  const promise = requestOpenAlexPapers(topic, sort, now).catch(
    (error: unknown) => {
      catalogCache.delete(key)
      throw error
    },
  )
  catalogCache.set(key, { expiresAt: now + cacheTtlMs, promise })
  return promise
}
