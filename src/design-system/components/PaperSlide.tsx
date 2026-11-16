import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  EyeOff,
  Heart,
} from "lucide-react"
import { forwardRef } from "react"

const railButtonClass =
  "flex min-h-12 w-full flex-col items-center justify-center gap-2xs border-0 border-t border-rule bg-transparent px-2xs py-xs font-label text-[0.62rem] uppercase tracking-[0.12em] text-ink-muted cursor-pointer first:border-t-0 hover:text-stamp focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-[-2px] aria-pressed:text-stamp"

type ActionHandlers = {
  readonly onLike: () => void
  readonly onBookmark: () => void
  readonly onHide: () => void
  readonly onOpenSite: () => void
  readonly onPrevious: () => void
  readonly onNext: () => void
}

type PaperSlideProps = {
  readonly id: string
  readonly title: string
  readonly authors: string
  readonly venue: string
  readonly year: number
  readonly abstract: string
  readonly accessLabel: string
  readonly siteLabel: string
  readonly citations: number
  readonly readMinutes: number
  readonly rationale: ReadonlyArray<string>
  readonly topics: ReadonlyArray<string>
  readonly liked: boolean
  readonly bookmarked: boolean
  readonly externalUrl: string | undefined
  readonly actions: ActionHandlers
  readonly position: number
  readonly total: number
  readonly skeleton: boolean
}

export const PaperSlide = forwardRef<HTMLElement, PaperSlideProps>(
  function PaperSlide(
    {
      abstract,
      accessLabel,
      actions,
      authors,
      bookmarked,
      citations,
      externalUrl,
      id,
      liked,
      position,
      rationale,
      readMinutes,
      siteLabel,
      skeleton,
      title,
      topics,
      total,
      venue,
      year,
    },
    ref,
  ) {
    const headlineId = `paper-headline-${id.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`

    return (
      <article
        ref={ref}
        aria-labelledby={headlineId}
        className="grid h-[100dvh] min-h-[100dvh] snap-start snap-always grid-cols-[minmax(0,1fr)_4.25rem] overflow-hidden bg-paper text-ink"
        onDoubleClick={actions.onLike}
      >
        {skeleton
          ? (
            <div className="col-span-2 flex h-full items-center justify-center px-l font-label text-xs uppercase tracking-[0.18em] text-ink-muted">
              Setting the next clipping…
            </div>
          )
          : (
            <>
              <div className="flex min-w-0 flex-col px-[clamp(1.25rem,5vw,4rem)] py-[clamp(1rem,3vh,2rem)]">
                <header className="flex items-center justify-between gap-m border-b border-ink pb-xs font-label text-[0.62rem] uppercase tracking-[0.16em] text-ink-muted sm:text-[0.68rem]">
                  <strong className="text-ink">
                    AcademiTok
                  </strong>
                  <span>
                    Evening Edition · No. {String(position).padStart(3, "0")}
                  </span>
                </header>

                <div className="mx-auto flex w-full max-w-[62ch] flex-1 flex-col justify-center py-[clamp(1rem,4vh,3rem)]">
                  <p className="mb-m font-label text-[0.72rem] uppercase tracking-[0.18em] text-stamp">
                    {topics[0] ?? "Research"}
                  </p>
                  <h2
                    id={headlineId}
                    className="line-clamp-2 overflow-wrap-anywhere m-0 font-display text-[clamp(2rem,7vw,3.4rem)] leading-[1.02] font-bold tracking-[-0.035em]"
                  >
                    {title}
                  </h2>
                  <p className="mt-l line-clamp-5 max-w-[60ch] font-body text-[clamp(1rem,2.4vw,1.125rem)] leading-[1.45] text-ink first-letter:float-left first-letter:mr-xs first-letter:font-display first-letter:text-[3.2rem] first-letter:leading-[0.8] first-letter:text-stamp">
                    {abstract}
                  </p>

                  <div className="mt-l border-t border-rule pt-m">
                    <p className="m-0 font-body text-[0.85rem] font-semibold">
                      {authors}
                    </p>
                    <p className="mt-xs font-label text-[0.68rem] uppercase tracking-[0.08em] text-ink-muted">
                      {venue} · {year} · {siteLabel} · {citations} citations ·
                      {" "}
                      {readMinutes} min
                    </p>
                  </div>

                  <div className="mt-l flex items-end justify-between gap-m">
                    <div className="max-w-[25rem] -rotate-1 border-2 border-stamp px-m py-s text-stamp">
                      <p className="m-0 font-label text-[0.62rem] font-bold uppercase tracking-[0.16em]">
                        Why this
                      </p>
                      <p className="mt-2xs font-body text-[0.85rem] leading-tight">
                        {rationale.join(" · ")}
                      </p>
                    </div>
                    <span className="border border-rule px-xs py-2xs font-label text-[0.62rem] uppercase tracking-[0.12em] text-ink-muted">
                      {accessLabel}
                    </span>
                  </div>
                </div>

                <footer className="flex items-center justify-between border-t border-ink pt-xs font-label text-[0.62rem] uppercase tracking-[0.14em] text-ink-muted">
                  <span>
                    {position} of {total}
                  </span>
                  <span>
                    Metadata only · Source opens separately
                  </span>
                </footer>
              </div>

              <div
                role="group"
                aria-label="Paper actions"
                className="flex h-full flex-col border-l border-rule bg-paper-deep"
              >
                <button
                  className={railButtonClass}
                  type="button"
                  onClick={actions.onPrevious}
                  aria-label="Previous paper"
                >
                  <ChevronUp size={18} aria-hidden="true" /> Prev
                </button>
                <button
                  className={railButtonClass}
                  type="button"
                  onClick={actions.onNext}
                  aria-label="Next paper"
                >
                  <ChevronDown size={18} aria-hidden="true" /> Next
                </button>
                <div className="flex-1" />
                <button
                  className={railButtonClass}
                  type="button"
                  onClick={actions.onLike}
                  aria-label={liked ? "Unlike paper" : "Like paper"}
                  aria-pressed={liked}
                >
                  <Heart
                    size={18}
                    fill={liked ? "currentColor" : "none"}
                    aria-hidden="true"
                  />{" "}
                  Like
                </button>
                <button
                  className={railButtonClass}
                  type="button"
                  onClick={actions.onBookmark}
                  aria-label={bookmarked ? "Remove saved paper" : "Save paper"}
                  aria-pressed={bookmarked}
                >
                  <Bookmark
                    size={18}
                    fill={bookmarked ? "currentColor" : "none"}
                    aria-hidden="true"
                  />{" "}
                  Save
                </button>
                <button
                  className={railButtonClass}
                  type="button"
                  onClick={actions.onHide}
                  aria-label="Hide paper"
                >
                  <EyeOff size={18} aria-hidden="true" /> Hide
                </button>
                {externalUrl === undefined
                  ? null
                  : (
                    <a
                      className={railButtonClass}
                      href={externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={actions.onOpenSite}
                      aria-label="Open paper source in a new tab"
                    >
                      <ExternalLink size={18} aria-hidden="true" /> Open
                    </a>
                  )}
              </div>
            </>
          )}
      </article>
    )
  },
)
