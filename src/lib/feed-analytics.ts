import type {
  FeedSnapshot,
  Paper,
  ReactToPaperInput,
  Topic,
  TrackPaperViewInput,
} from "@/api/paper-schema"
import { getPostHogClient } from "@/lib/client-init"
import { matchedTopics } from "@/lib/topic-beats"

export type FeedHealthEvent =
  | "impression"
  | "dwell"
  | "reaction"
  | "feed.next"

let readerIdHash: Promise<string> | undefined

/**
 * Hashes the browser's pseudonymous PostHog identifier before attaching it to
 * feed-health events.
 * @param value - Pseudonymous reader identifier.
 * @returns Lowercase SHA-256 digest.
 */
export async function hashReaderId(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Sends a feed-health event without allowing analytics failures to affect the feed.
 * @param event - Stable feed event name.
 * @param properties - Non-identifying event properties.
 */
export async function trackFeedHealthEvent(
  event: FeedHealthEvent,
  properties: Readonly<Record<string, unknown>>,
): Promise<void> {
  if (typeof window === "undefined" || !import.meta.env.VITE_POSTHOG_KEY) {
    return
  }

  try {
    const posthog = await getPostHogClient()
    if (posthog === null) {
      return
    }
    readerIdHash ??= hashReaderId(posthog.get_distinct_id())
    posthog.capture(event, {
      ...properties,
      reader_id_hash: await readerIdHash,
    })
  } catch {
    return
  }
}

/**
 * Share of a clipping's estimated reading time that was actually spent.
 * @param dwellMs - Measured dwell in milliseconds.
 * @param readMinutes - Estimated reading time in minutes, when known.
 * @returns Ratio clamped to 1, or null when there is no usable estimate.
 */
export function readingCompletion(
  dwellMs: number,
  readMinutes: number | null | undefined,
): number | null {
  if (readMinutes === null || readMinutes === undefined || readMinutes <= 0) {
    return null
  }
  return Math.min(1, Math.max(0, dwellMs) / (readMinutes * 60_000))
}

/**
 * Tracks an impression or dwell event.
 * @param input - Persisted view event.
 * @param topics - Paper topics used for entropy metrics.
 * @param readMinutes - Estimated reading time shown on the clipping, when known.
 */
export function trackPaperViewEvent(
  input: TrackPaperViewInput,
  topics: ReadonlyArray<Topic>,
  readMinutes?: number | null,
): void {
  void trackFeedHealthEvent(
    input.kind === "view" ? "impression" : "dwell",
    {
      paper_id: input.paperId,
      position: input.position,
      exploration: input.exploration,
      topics,
      ...(input.kind === "dwell"
        ? {
          dwell_ms: input.dwellMs,
          read_minutes: readMinutes ?? null,
          completion: readingCompletion(input.dwellMs, readMinutes),
        }
        : {}),
    },
  )
}

/**
 * Tracks the persisted outcome of a paper reaction.
 * @param input - Requested reaction.
 * @param active - Persisted toggle state.
 */
export function trackPaperReactionEvent(
  input: ReactToPaperInput,
  active: boolean,
): void {
  void trackFeedHealthEvent("reaction", {
    paper_id: input.paperId,
    kind: input.kind,
    active,
  })
}

/**
 * Median of a numeric sample.
 * @param values - Sample values.
 * @returns Median, averaging the middle pair on even-sized samples, or null when empty.
 */
function median(values: ReadonlyArray<number>): number | null {
  if (values.length === 0) {
    return null
  }
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

/**
 * Median publication year of a page, the archival-drift signal (SPEC §17.3).
 * @param years - Page publication years.
 * @returns Median year, averaging the middle pair on even-sized pages, or null when empty.
 */
export function medianYear(years: ReadonlyArray<number>): number | null {
  return median(years)
}

export type CitationAgeSkew = {
  readonly olderCitations: number | null
  readonly newerCitations: number | null
}

/**
 * Median citation count either side of the page's median year, the half of the
 * archival bias that citation damping is meant to offset (SPEC §17.3).
 * @param papers - Page clippings with publication year and citation count.
 * @returns Median citation counts; null for an empty side or an empty page.
 */
export function citationAgeSkew(
  papers: ReadonlyArray<Pick<Paper, "year" | "citations">>,
): CitationAgeSkew {
  const pageMedian = median(papers.map((paper) => paper.year))
  if (pageMedian === null) {
    return { olderCitations: null, newerCitations: null }
  }
  const citationsOn = (older: boolean) =>
    median(
      papers
        .filter((paper) =>
          older ? paper.year < pageMedian : paper.year >= pageMedian
        )
        .map((paper) => paper.citations),
    )
  return {
    olderCitations: citationsOn(true),
    newerCitations: citationsOn(false),
  }
}

export type ArchivalDrift = {
  readonly medianYear: number | null
  readonly newestYear: number | null
  readonly olderThanDecade: number
  readonly total: number
}

/**
 * Median year plus how many clippings lag the newest one by more than a decade (SPEC §17.3).
 * @param years - Page publication years.
 * @returns Drift readout; `medianYear` and `newestYear` are null when the page has no years.
 */
export function archivalDrift(years: ReadonlyArray<number>): ArchivalDrift {
  const newestYear = years.length === 0 ? null : Math.max(...years)
  return {
    medianYear: medianYear(years),
    newestYear,
    olderThanDecade: newestYear === null
      ? 0
      : years.filter((year) => newestYear - year > 10).length,
    total: years.length,
  }
}

/**
 * Clippings whose text matched no beat, so `detectTopics` filed them under its
 * Education fallback (SPEC §17.2).
 * @param papers - Page clippings.
 * @returns Count of fallback clippings; 0 for an empty page.
 */
export function unmatchedBeatCount(
  papers: ReadonlyArray<Pick<Paper, "title" | "abstract">>,
): number {
  return papers
    .filter((paper) => matchedTopics(paper.title, paper.abstract).length === 0)
    .length
}

/**
 * Shannon entropy in nats of a page's primary beat per clipping (SPEC §8.4).
 * @param papers - Page clippings.
 * @returns Entropy; 0 for an empty page or a page sharing one beat.
 */
export function topicEntropy(
  papers: ReadonlyArray<Pick<Paper, "topics">>,
): number {
  const counts = new Map<Topic, number>()
  for (const paper of papers) {
    const beat = paper.topics[0]
    if (beat !== undefined) {
      counts.set(beat, (counts.get(beat) ?? 0) + 1)
    }
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0)
  if (total === 0) {
    return 0
  }
  return [...counts.values()].reduce((entropy, count) => {
    const share = count / total
    return entropy - share * Math.log(share)
  }, 0)
}

/**
 * Tracks one ranked page returned to the reader.
 * @param snapshot - Ranked page response.
 * @param cursor - Requested cursor, or null for the first page.
 */
export function trackFeedPageEvent(
  snapshot: FeedSnapshot,
  cursor: string | null,
): void {
  const papers = snapshot.items.map((item) => item.paper)
  const ids = papers.map((paper) => paper.id)
  const skew = citationAgeSkew(papers)
  void trackFeedHealthEvent("feed.next", {
    cursor: cursor ?? "first",
    item_count: ids.length,
    duplicate_count: ids.length - new Set(ids).size,
    exploration_count: snapshot.exploration,
    median_year: medianYear(papers.map((paper) => paper.year)),
    older_citation_median: skew.olderCitations,
    newer_citation_median: skew.newerCitations,
    unmatched_beat_count: unmatchedBeatCount(papers),
    topic_entropy: topicEntropy(papers),
    topic: snapshot.selectedTopic,
    sort: snapshot.selectedSort,
    cold_start: snapshot.profile === null,
  })
}
