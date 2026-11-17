import type {
  FeedSnapshot,
  Paper,
  ReactionKind,
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
 * Median dwell of the impressions that recorded one (SPEC §8.4).
 * @param dwells - Recorded dwells in milliseconds.
 * @returns Median dwell in milliseconds, or null when nothing was recorded.
 */
export function medianDwell(
  dwells: ReadonlyArray<number>,
): number | null {
  return median(dwells)
}

/**
 * Median estimated reading time behind the clippings the dwell is measured on,
 * so the dwell floor is read against what those clippings ask for (SPEC §16 P3).
 * @param papers - Clippings with an optional reading-time estimate.
 * @returns Median minutes, or null when no clipping carries a usable estimate.
 */
export function medianReadMinutes(
  papers: ReadonlyArray<{
    readonly readMinutes?: number | null | undefined
  }>,
): number | null {
  return median(
    papers
      .map((paper) => paper.readMinutes)
      .filter((minutes): minutes is number =>
        minutes !== null && minutes !== undefined && minutes > 0
      ),
  )
}

/**
 * Total estimated reading time a page asks for, so the dwell floor is judged
 * against comparable pages (SPEC §16 P3).
 * @param papers - Page clippings with an optional reading-time estimate.
 * @returns Summed minutes, or null when no clipping carries a usable estimate.
 */
export function pageReadMinutes(
  papers: ReadonlyArray<{
    readonly readMinutes?: number | null | undefined
  }>,
): number | null {
  let total: number | null = null
  for (const paper of papers) {
    const minutes = paper.readMinutes
    if (minutes === null || minutes === undefined || minutes <= 0) {
      continue
    }
    total = (total ?? 0) + minutes
  }
  return total
}

type ReactionWindow = {
  readonly views: number
  readonly hides: number
  readonly opens: number
  readonly saves: number
}

/**
 * Counts the reaction kinds inside the reader's most recent impression window.
 * @param kinds - Reaction kinds, newest first.
 * @param window - Impressions in the measurement window.
 * @returns Counts of the windowed views and the reactions they carry.
 */
const reactionWindow = (
  kinds: ReadonlyArray<ReactionKind>,
  window: number,
): ReactionWindow => {
  const counts = { views: 0, hides: 0, opens: 0, saves: 0 }
  for (const kind of kinds) {
    if (counts.views >= window) {
      break
    }
    switch (kind) {
      case "view":
        counts.views += 1
        break
      case "hide":
        counts.hides += 1
        break
      case "open-site":
        counts.opens += 1
        break
      case "bookmark":
        counts.saves += 1
        break
    }
  }
  return counts
}

export type ReactionRates = {
  readonly hideRate: number | null
  readonly openSourceRate: number | null
}

/**
 * Hide and open-source shares of the reader's most recent impressions (SPEC §8.4).
 * @param kinds - Reaction kinds, newest first.
 * @param window - Impressions in the measurement window.
 * @returns Shares of the window; both null when it holds no impression.
 */
export function reactionRates(
  kinds: ReadonlyArray<ReactionKind>,
  window: number,
): ReactionRates {
  const counts = reactionWindow(kinds, window)
  return {
    hideRate: counts.views === 0 ? null : counts.hides / counts.views,
    openSourceRate: counts.views === 0 ? null : counts.opens / counts.views,
  }
}

/**
 * Saves per 100 impressions over the reader's most recent impression window (SPEC §8.4).
 * @param kinds - Reaction kinds, newest first.
 * @param window - Impressions in the measurement window.
 * @returns Saves per hundred impressions, or null when the window holds no impression.
 */
export function savesPerHundred(
  kinds: ReadonlyArray<ReactionKind>,
  window: number,
): number | null {
  const counts = reactionWindow(kinds, window)
  return counts.views === 0 ? null : (counts.saves / counts.views) * 100
}

/**
 * Share of the reader's recent impressions that repeat a clipping already served
 * earlier in the same window (SPEC §8.4).
 * @param paperIds - Viewed paper ids, newest first.
 * @param window - Impressions in the measurement window.
 * @returns Repeat share of the window, or null when the window holds no impression.
 */
export function duplicateRate(
  paperIds: ReadonlyArray<string>,
  window: number,
): number | null {
  const viewed = paperIds.slice(0, window)
  return viewed.length === 0
    ? null
    : (viewed.length - new Set(viewed).size) / viewed.length
}

/**
 * Median reading completion of the clippings that could be measured (SPEC §16 P3).
 * @param values - Per-clip ratios; null marks a clipping without a usable estimate.
 * @returns Median ratio, or null when nothing was measurable.
 */
export function medianCompletion(
  values: ReadonlyArray<number | null>,
): number | null {
  return median(values.filter((value): value is number => value !== null))
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
 * Clippings whose text matched no beat, so `detectTopics` did not file them from
 * the keyword table; the count is `concept + education` of `beatSourceCounts`
 * (SPEC §17.2).
 * @param papers - Page clippings.
 * @returns Count of clippings the keyword table missed; 0 for an empty page.
 */
export function unmatchedBeatCount(
  papers: ReadonlyArray<Pick<Paper, "title" | "abstract">>,
): number {
  return papers
    .filter((paper) => matchedTopics(paper.title, paper.abstract).length === 0)
    .length
}

export type BeatSourceCounts = {
  readonly keyword: number
  readonly concept: number
  readonly education: number
}

/**
 * Splits a page by the path `detectTopics` took to file each clipping: the beat
 * keyword table, the source concept map, or the Education fallback (SPEC §17.2).
 * @param papers - Page clippings, with the beat they were stored under.
 * @returns Counts per path, summing to the page size.
 */
export function beatSourceCounts(
  papers: ReadonlyArray<Pick<Paper, "title" | "abstract" | "topics">>,
): BeatSourceCounts {
  const counts = { keyword: 0, concept: 0, education: 0 }
  for (const paper of papers) {
    const beat = paper.topics[0]
    if (matchedTopics(paper.title, paper.abstract).length > 0) {
      counts.keyword += 1
    } else if (beat !== undefined && beat !== "Education") {
      counts.concept += 1
    } else {
      counts.education += 1
    }
  }
  return counts
}

/**
 * Primary beats whose every clipping on the page arrived without a keyword
 * match, so the keyword table alone could not name that beat (SPEC §17.2).
 * @param papers - Page clippings, with the beat they were stored under.
 * @returns Beats in first-appearance order, no duplicates; empty for an empty page.
 */
export function conceptOnlyBeats(
  papers: ReadonlyArray<Pick<Paper, "title" | "abstract" | "topics">>,
): ReadonlyArray<Topic> {
  const keywordOnly = new Map<Topic, boolean>()
  for (const paper of papers) {
    const beat = paper.topics[0]
    if (beat === undefined) {
      continue
    }
    const keyword = matchedTopics(paper.title, paper.abstract).length > 0
    keywordOnly.set(beat, (keywordOnly.get(beat) ?? true) && !keyword)
  }
  return [...keywordOnly]
    .filter(([, conceptOnly]) => conceptOnly)
    .map(([beat]) => beat)
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
 * Shannon entropy in nats of each beat's share of the recorded dwell, so a
 * window mixed by attention is told apart from one mixed by count (SPEC §8.4).
 * @param pairs - Per-clipping primary beat and the dwell it recorded.
 * @returns Entropy; 0 for an empty set, a single beat or no usable dwell.
 */
export function dwellEntropy(
  pairs: ReadonlyArray<{
    readonly topics: ReadonlyArray<Topic>
    readonly dwellMs?: number | null | undefined
  }>,
): number {
  const dwells = new Map<Topic, number>()
  for (const pair of pairs) {
    const beat = pair.topics[0]
    const dwellMs = pair.dwellMs
    if (
      beat === undefined
      || dwellMs === null
      || dwellMs === undefined
      || dwellMs <= 0
    ) {
      continue
    }
    dwells.set(beat, (dwells.get(beat) ?? 0) + dwellMs)
  }
  const total = [...dwells.values()].reduce((sum, dwell) => sum + dwell, 0)
  if (total === 0) {
    return 0
  }
  return [...dwells.values()].reduce((entropy, dwell) => {
    const share = dwell / total
    return entropy - share * Math.log(share)
  }, 0)
}

export type TopDwellBeat = {
  readonly topic: Topic
  readonly share: number
}

/**
 * The primary beat holding the largest share of the recorded dwell, so a reader
 * can tell which beat takes the window's attention (SPEC §17.2).
 * @param pairs - Per-clipping primary beat and the dwell it recorded.
 * @returns Dominant beat and its 0–1 share, or null when nothing recorded a positive dwell.
 */
export function topDwellBeat(
  pairs: ReadonlyArray<{
    readonly topics: ReadonlyArray<Topic>
    readonly dwellMs?: number | null | undefined
  }>,
): TopDwellBeat | null {
  const dwells = new Map<Topic, number>()
  for (const pair of pairs) {
    const beat = pair.topics[0]
    const dwellMs = pair.dwellMs
    if (
      beat === undefined
      || dwellMs === null
      || dwellMs === undefined
      || dwellMs <= 0
    ) {
      continue
    }
    dwells.set(beat, (dwells.get(beat) ?? 0) + dwellMs)
  }
  const total = [...dwells.values()].reduce((sum, dwell) => sum + dwell, 0)
  if (total === 0) {
    return null
  }
  let top: TopDwellBeat | null = null
  let best = 0
  for (const [topic, dwell] of dwells) {
    if (top === null || dwell > best) {
      top = { topic, share: dwell / total }
      best = dwell
    }
  }
  return top
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
  const beats = beatSourceCounts(papers)
  void trackFeedHealthEvent("feed.next", {
    cursor: cursor ?? "first",
    origin: snapshot.origin,
    item_count: ids.length,
    duplicate_count: ids.length - new Set(ids).size,
    exploration_count: snapshot.exploration,
    median_year: medianYear(papers.map((paper) => paper.year)),
    older_citation_median: skew.olderCitations,
    newer_citation_median: skew.newerCitations,
    unmatched_beat_count: unmatchedBeatCount(papers),
    concept_beat_count: beats.concept,
    education_beat_count: beats.education,
    topic_entropy: topicEntropy(papers),
    page_read_minutes: pageReadMinutes(papers),
    topic: snapshot.selectedTopic,
    sort: snapshot.selectedSort,
    cold_start: snapshot.profile === null,
  })
}
