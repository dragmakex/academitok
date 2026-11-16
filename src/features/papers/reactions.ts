import type { ReactToPaperInput, TrackPaperViewInput } from "@/api/paper-schema"

type ReaderReactionRecord = {
  readonly paperId: string
  readonly kind: "view" | "dwell" | "like" | "bookmark" | "hide" | "open-site"
  readonly active: boolean
  readonly timestamp: number
  readonly dwellMs?: number | undefined
}

/**
 * Identifies toggle reactions.
 * @param kind - Reaction kind.
 * @returns Whether the reaction toggles.
 */
function isToggleReactionKind(
  kind: ReactToPaperInput["kind"] | TrackPaperViewInput["kind"],
): kind is Extract<ReactToPaperInput["kind"], "like" | "bookmark" | "hide"> {
  return kind === "like" || kind === "bookmark" || kind === "hide"
}

/**
 * Appends a bounded reader event.
 * @param reactions - Existing events.
 * @param input - New event.
 * @returns Updated bounded event list.
 */
export function recordReaderReaction(
  reactions: ReadonlyArray<ReaderReactionRecord>,
  input: ReactToPaperInput | TrackPaperViewInput,
) {
  if (!isToggleReactionKind(input.kind)) {
    const event = {
      paperId: input.paperId,
      kind: input.kind,
      active: true,
      timestamp: Date.now(),
      ...(input.kind === "dwell" ? { dwellMs: input.dwellMs } : {}),
    } as const

    return [event, ...reactions].slice(0, 300)
  }

  const current = reactions.find((reaction) =>
    reaction.paperId === input.paperId && reaction.kind === input.kind
  )
  const nextActive = !(current?.active === true)

  return [
    {
      paperId: input.paperId,
      kind: input.kind,
      active: nextActive,
      timestamp: Date.now(),
    } as const,
    ...reactions,
  ]
    .slice(0, 300)
}
