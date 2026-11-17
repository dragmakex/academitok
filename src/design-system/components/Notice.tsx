/** The single action a notice may offer. */
export type NoticeAction = {
  readonly label: string
  readonly onAction: () => void
}

type NoticeProps = {
  readonly label: string
  readonly action?: NoticeAction | undefined
}

/**
 * Renders a transient notice line above the deck's bottom safe-area inset.
 * @param props - Notice props.
 * @param props.label - Mono caps message, announced politely.
 * @param props.action - Optional action, such as undoing the last reaction.
 * @returns Fixed notice line over the paper ground.
 */
export function Notice({ action, label }: NoticeProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-m pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="pointer-events-auto flex w-full max-w-[24rem] items-center justify-between gap-m border-2 border-ink bg-paper px-s py-xs">
        <p
          role="status"
          className="m-0 font-label text-[0.62rem] uppercase tracking-[0.16em] text-ink"
        >
          {label}
        </p>
        {action === undefined ? null : (
          <button
            className="min-h-9 shrink-0 border-0 bg-transparent px-xs font-label text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink underline underline-offset-4 cursor-pointer hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-ink"
            type="button"
            onClick={action.onAction}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}
