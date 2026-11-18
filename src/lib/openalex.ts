import type {
  FeedSort,
  Paper,
  PaperSite,
  Topic,
  TopicFilter,
} from "@/api/paper-schema"
import { curatedPapers } from "@/data/papers"
import { conceptTopics, matchedTopics } from "@/lib/research-topics"
import { createSourceGuard } from "@/lib/source-guard"

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
  Anthropology: "anthropology",
  Archaeology: "archaeology",
  Astronomy: "astronomy",
  Chemistry: "chemistry",
  "Computer Science": "computer science",
  Ecology: "ecology",
  Engineering: "engineering",
  Geology: "geology",
  History: "historical research",
  Linguistics: "linguistics",
  Mathematics: "mathematics",
  Neuroscience: "neuroscience",
  Philosophy: "philosophy",
  "Political Science": "political science",
  Sociology: "sociology",
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

type OpenAlexConcept = {
  readonly display_name?: string
}

type OpenAlexWork = {
  readonly id?: string
  readonly title?: string
  readonly authorships?: ReadonlyArray<OpenAlexAuthor>
  readonly concepts?: ReadonlyArray<OpenAlexConcept>
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
 * Maps text onto research topics, falling back to the source concepts and then to
 * Education (SPEC §17.2).
 * @param title - Paper title.
 * @param abstract - Paper abstract.
 * @param concepts - Concept display names from the source.
 * @returns Matching topics, or the Education fallback.
 */
export function detectTopics(
  title: string,
  abstract: string,
  concepts: ReadonlyArray<string> = [],
): ReadonlyArray<Topic> {
  const matches = matchedTopics(title, abstract)
  if (matches.length > 0) {
    return matches
  }

  const conceptMatches = conceptTopics(concepts)
  return conceptMatches.length > 0 ? conceptMatches : ["Education"]
}

/**
 * Estimates reading time from the served text at 200 words per minute.
 * @param text - Abstract text.
 * @returns Whole minutes, 1 to 10.
 */
export function estimateReadMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.min(10, Math.max(1, Math.ceil(words / 200)))
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

  const concepts = (work.concepts ?? [])
    .map((concept) => concept.display_name?.trim())
    .filter((value): value is string =>
      typeof value === "string" && value.length > 0
    )

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
    topics: [...detectTopics(title, abstract, concepts)],
    access: work.open_access?.is_oa === true ? "open" : "institution",
    citations: work.cited_by_count ?? 0,
    readMinutes: estimateReadMinutes(abstract),
    site: inferSite(externalUrl),
    source: "openalex",
    externalUrl,
  }
}

/** Jaccard similarity above which two titles are the same work. */
const titleCollapseThreshold = 0.9

/**
 * Normalises a title into lowercase alphanumeric tokens.
 * @param title - Paper title.
 * @returns The title's token set.
 */
function titleTokens(title: string): Set<string> {
  return new Set(title.toLowerCase().match(/[a-z0-9]+/g) ?? [])
}

/**
 * Jaccard similarity of two token sets.
 * @param left - First token set.
 * @param right - Second token set.
 * @returns Similarity, or 0 when either set is empty.
 */
function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0
  }
  let shared = 0
  for (const token of left) {
    if (right.has(token)) {
      shared += 1
    }
  }
  return shared / (left.size + right.size - shared)
}

/**
 * Collapses near-duplicate titles, keeping input order and the first of each group.
 * @param papers - Candidate papers.
 * @returns Deduplicated papers.
 */
export function collapseTitleDuplicates(
  papers: ReadonlyArray<Paper>,
): ReadonlyArray<Paper> {
  const kept: Array<Set<string>> = []
  return papers.filter((paper) => {
    const tokens = titleTokens(paper.title)
    if (
      kept.some((existing) =>
        jaccard(existing, tokens) > titleCollapseThreshold
      )
    ) {
      return false
    }
    kept.push(tokens)
    return true
  })
}

/**
 * Fetches one bounded OpenAlex page while serializing requests to the host and
 * holding the retry schedule and circuit breaker from `sourceGuard`.
 * @param topic - Requested topic.
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

  return collapseTitleDuplicates([...mapped, ...curatedPapers]).slice(0, 58)
}

/**
 * Fetches cached OpenAlex metadata without concurrent requests to the host.
 * @param topic - Requested topic.
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
