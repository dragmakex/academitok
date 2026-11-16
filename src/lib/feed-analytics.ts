import type {
  FeedSnapshot,
  ReactToPaperInput,
  Topic,
  TrackPaperViewInput,
} from "@/api/paper-schema"
import { getPostHogClient } from "@/lib/client-init"

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
 * Tracks an impression or dwell event.
 * @param input - Persisted view event.
 * @param topics - Paper topics used for entropy metrics.
 */
export function trackPaperViewEvent(
  input: TrackPaperViewInput,
  topics: ReadonlyArray<Topic>,
): void {
  void trackFeedHealthEvent(
    input.kind === "view" ? "impression" : "dwell",
    {
      paper_id: input.paperId,
      position: input.position,
      exploration: input.exploration,
      topics,
      ...(input.kind === "dwell" ? { dwell_ms: input.dwellMs } : {}),
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
 * Tracks one ranked page returned to the reader.
 * @param snapshot - Ranked page response.
 * @param cursor - Requested cursor, or null for the first page.
 */
export function trackFeedPageEvent(
  snapshot: FeedSnapshot,
  cursor: string | null,
): void {
  const ids = snapshot.items.map((item) => item.paper.id)
  void trackFeedHealthEvent("feed.next", {
    cursor: cursor ?? "first",
    item_count: ids.length,
    duplicate_count: ids.length - new Set(ids).size,
    exploration_count: snapshot.exploration,
    topic: snapshot.selectedTopic,
    sort: snapshot.selectedSort,
    cold_start: snapshot.profile === null,
  })
}
