import type { TrackPaperViewInput } from "@/api/paper-schema"

export type ImpressionBuffer = {
  readonly batch: ReadonlyArray<TrackPaperViewInput>
  readonly queued: ReadonlyArray<TrackPaperViewInput>
}

/**
 * Adds an event and releases a batch at ten events or on demand.
 * @param queued - Events waiting for transport.
 * @param event - Optional new impression event.
 * @param flush - Whether to release a partial batch.
 * @returns The next queue and transport batch.
 */
export function bufferImpression(
  queued: ReadonlyArray<TrackPaperViewInput>,
  event: TrackPaperViewInput | undefined,
  flush: boolean,
): ImpressionBuffer {
  const next = event === undefined ? queued : [...queued, event]
  return flush || next.length >= 10
    ? { batch: next, queued: [] }
    : { batch: [], queued: next }
}

type VisibilitySource = {
  readonly visibilityState: DocumentVisibilityState
  addEventListener(type: "visibilitychange", listener: () => void): void
  removeEventListener(type: "visibilitychange", listener: () => void): void
}

/**
 * Flushes pending impressions when the page becomes hidden.
 * @param source - Document visibility event source.
 * @param onHidden - Dwell finalizer and queue flush callback.
 * @returns Listener cleanup.
 */
export function flushImpressionsOnHide(
  source: VisibilitySource,
  onHidden: () => void,
) {
  const onVisibilityChange = () => {
    if (source.visibilityState === "hidden") {
      onHidden()
    }
  }

  source.addEventListener("visibilitychange", onVisibilityChange)
  return () =>
    source.removeEventListener("visibilitychange", onVisibilityChange)
}
