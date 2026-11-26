import { forwardRef, useEffect, useRef } from "react"

/* Square ink stamp under the headline: outline at rest, inverted once pressed. */
const actionButtonClass =
  "flex h-10 w-10 shrink-0 items-center justify-center border border-rule-soft bg-paper text-ink cursor-pointer hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 aria-pressed:bg-ink aria-pressed:text-paper sm:h-11 sm:w-11"

const pagerButtonClass =
  "flex h-10 w-10 shrink-0 items-center justify-center border-0 bg-transparent font-display text-[1.15rem] text-ink cursor-pointer hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-[-2px] sm:h-11 sm:w-11"

const metaClass =
  "font-label text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink-muted"

type ActionHandlers = {
  readonly onLike: () => void
  readonly onBookmark: () => void
  readonly onShare: () => void
  readonly onOpenSite: () => void
  readonly onOpenDesk: () => void
  readonly onPrevious: () => void
  readonly onNext: () => void
}

type PaperIdentity = {
  readonly id: string
  readonly title: string
  readonly abstract: string
  readonly citations: number
  readonly readMinutes: number
  readonly topics: ReadonlyArray<string>
  readonly externalUrl: string | undefined
}

type PaperMeta = PaperIdentity & {
  readonly authors: string
  readonly venue: string
  readonly year: number
  readonly accessLabel: string
  readonly siteLabel: string
}

type DeckPaperSlideProps = PaperIdentity & {
  readonly variant?: "deck" | undefined
  readonly liked: boolean
  readonly bookmarked: boolean
  readonly actions: ActionHandlers
  readonly position: number
  readonly total: number
  readonly skeleton: boolean
}

type CompactPaperSlideProps = PaperMeta & {
  readonly variant: "compact"
  readonly filedByOthers?: number | undefined
  readonly onUnsave: () => void
}

type PaperSlideProps = DeckPaperSlideProps | CompactPaperSlideProps

/**
 * Renders one paper as a broadsheet clipping: a front-page slide in the deck,
 * a ruled list row in the saved shelf.
 *
 * @param props - Paper metadata plus either deck handlers or an unsave action.
 * @param props.id - Paper identifier, used for the permalink and heading id.
 * @param props.title - Paper headline.
 * @param props.actions - Deck action handlers.
 * @param props.onUnsave - Compact variant's unsave handler.
 * @returns A deck slide or a compact clipping row.
 */
export const PaperSlide = forwardRef<HTMLElement, PaperSlideProps>(
  function PaperSlide(props, ref) {
    const headlineId = `paper-headline-${
      props.id.replaceAll(/[^a-zA-Z0-9_-]/g, "-")
    }`
    const abstractBoxRef = useRef<HTMLParagraphElement | null>(null)
    const abstractTextRef = useRef<HTMLSpanElement | null>(null)
    const abstractText = props.abstract
    const deckSkeleton = props.variant === "compact" ? true : props.skeleton

    /*
     * Fit the abstract to the height the slide actually leaves. A fixed line
     * clamp either strands white space on tall screens or cuts a line mid-glyph
     * when the headline is long; the wrapper owns the flex height and the span
     * gets the exact number of lines that height can hold.
     */
    useEffect(() => {
      const box = abstractBoxRef.current
      const text = abstractTextRef.current
      if (box === null || text === null) {
        return
      }
      const fit = () => {
        const lineHeight = Number.parseFloat(getComputedStyle(text).lineHeight)
        if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
          return
        }
        const lines = Math.max(
          1,
          Math.floor((box.clientHeight - 2) / lineHeight),
        )
        text.style.setProperty("-webkit-line-clamp", String(lines))
      }
      fit()
      const observer = new ResizeObserver(fit)
      observer.observe(box)
      return () => observer.disconnect()
    }, [abstractText, deckSkeleton])

    if (props.variant === "compact") {
      const {
        abstract,
        authors,
        externalUrl,
        filedByOthers,
        id,
        onUnsave,
        title,
        topics,
        venue,
        year,
        siteLabel,
        citations,
        readMinutes,
        accessLabel,
      } = props

      return (
        <article
          ref={ref}
          aria-labelledby={headlineId}
          className="border-t border-rule-soft bg-paper py-m text-ink first:border-t-0"
        >
          <p className={metaClass}>
            {topics[0] ?? "Research"}
          </p>
          <h2
            id={headlineId}
            className="mt-2xs m-0 font-display text-[clamp(1.25rem,2.4vw,1.6rem)] leading-[1.08] font-bold tracking-[-0.015em]"
          >
            <a
              className="text-ink no-underline hover:underline focus-visible:outline-2 focus-visible:outline-ink"
              href={`/paper/${encodeURIComponent(id)}`}
            >
              {title}
            </a>
          </h2>
          <p className="mt-xs m-0 line-clamp-2 max-w-[62ch] font-body text-[0.95rem] leading-[1.4] text-ink-muted">
            {abstract}
          </p>
          <div className="mt-xs flex flex-wrap items-baseline justify-between gap-x-m gap-y-2xs border-t border-rule-soft pt-2xs">
            <p className="m-0 font-body text-[0.85rem]">
              {authors}
            </p>
            <div className="flex flex-wrap items-baseline gap-m">
              <span className={metaClass}>
                {venue} · {year} · {siteLabel} · {citations} citations ·{" "}
                {readMinutes} min abstract · {accessLabel}
              </span>
              {filedByOthers === undefined || filedByOthers === 0
                ? null
                : (
                  <span className={metaClass}>
                    {`Also kept by ${filedByOthers} ${
                      filedByOthers === 1 ? "reader" : "readers"
                    }`}
                  </span>
                )}
              {externalUrl === undefined
                ? null
                : (
                  <a
                    className="font-label text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink underline underline-offset-4 hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-ink"
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open source for ${title} in a new tab`}
                  >
                    Source
                  </a>
                )}
              <button
                className="border-0 bg-transparent p-0 font-label text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink-muted underline underline-offset-4 cursor-pointer hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
                type="button"
                onClick={onUnsave}
                aria-label={`Remove ${title} from saved`}
              >
                Remove
              </button>
            </div>
          </div>
        </article>
      )
    }

    const {
      abstract,
      actions,
      bookmarked,
      citations,
      externalUrl,
      liked,
      readMinutes,
      skeleton,
      title,
      topics,
    } = props

    return (
      <article
        ref={ref}
        aria-labelledby={headlineId}
        className="relative flex h-full min-h-full snap-start snap-always flex-col text-ink"
        onDoubleClick={actions.onLike}
      >
        {skeleton
          ? (
            <div className="flex flex-1 items-center justify-center font-label text-[0.68rem] font-bold uppercase tracking-[0.18em] text-ink-muted">
              Setting the next clipping…
            </div>
          )
          : (
            <>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-[clamp(0.65rem,1.8vw,3rem)] pt-[clamp(0.9rem,2.2dvh,2rem)] pb-2xs text-ink focus-visible:outline-2 focus-visible:outline-offset-[-8px] focus-visible:outline-ink">
                <a
                  className="mx-auto flex min-h-0 w-full max-w-[68rem] flex-1 flex-col text-ink no-underline"
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={actions.onOpenSite}
                  aria-label="Open paper source in a new tab"
                >
                  <p className="m-0 shrink-0 font-label text-[clamp(0.66rem,0.85vmin,0.9rem)] font-bold uppercase tracking-[0.2em]">
                    {topics[0] ?? "Research"}
                    <span className="text-ink-muted">
                      {"  ·  "}
                      {citations} {citations === 1 ? "citation" : "citations"}
                      {"  ·  "}
                      {readMinutes} min read
                    </span>
                  </p>

                  <h2
                    id={headlineId}
                    className="mt-s line-clamp-8 shrink-0 m-0 max-w-[27ch] overflow-wrap-anywhere font-display text-[clamp(1.4rem,4.6vh,2.75rem)] font-bold leading-[1.05] tracking-[-0.02em] md:line-clamp-7"
                  >
                    {title}
                  </h2>

                  <p
                    ref={abstractBoxRef}
                    className="mt-s min-h-0 flex-1 m-0 max-w-[62ch] overflow-hidden hyphens-auto text-left font-body text-[clamp(0.98rem,2.7vh,1.3rem)] leading-[1.45] md:text-justify md:[text-align-last:left]"
                  >
                    <span
                      ref={abstractTextRef}
                      className="line-clamp-5 [@media(min-height:680px)]:line-clamp-7 [@media(min-height:820px)]:line-clamp-8"
                    >
                      {abstract}
                    </span>
                  </p>

                  <p className="mt-m shrink-0 pt-2xs m-0 font-label text-[clamp(0.66rem,0.8vmin,0.9rem)] font-bold uppercase tracking-[0.18em] text-ink-muted">
                    Read the paper →
                  </p>
                </a>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-2xs border-t border-rule-soft bg-paper px-[clamp(0.65rem,1.8vw,3rem)] py-xs pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                <div
                  role="group"
                  aria-label="Paper actions"
                  className="flex items-center gap-2xs sm:gap-xs"
                >
                  <button
                    className={actionButtonClass}
                    type="button"
                    onClick={actions.onOpenDesk}
                    aria-label="Open the reading desk"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M3 5h14M3 10h14M3 15h14" />
                    </svg>
                  </button>
                  <button
                    className={actionButtonClass}
                    type="button"
                    onClick={actions.onLike}
                    aria-label={liked ? "Unlike paper" : "Like paper"}
                    aria-pressed={liked}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      fill={liked ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth={1.6}
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 20.3 5.6 14A4.6 4.6 0 0 1 12 7.4 4.6 4.6 0 0 1 18.4 14Z" />
                    </svg>
                  </button>
                  <button
                    className={actionButtonClass}
                    type="button"
                    onClick={actions.onBookmark}
                    aria-label={bookmarked
                      ? "Remove saved paper"
                      : "Save paper"}
                    aria-pressed={bookmarked}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      fill={bookmarked ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth={1.6}
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M7 4.5h10v15l-5-3.6-5 3.6Z" />
                    </svg>
                  </button>
                  <button
                    className={actionButtonClass}
                    type="button"
                    onClick={actions.onShare}
                    aria-label="Share paper"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 15.5V4m0 0L8 8m4-4 4 4" />
                      <path d="M6.5 11v8.5h11V11" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-stretch">
                  <button
                    className={pagerButtonClass}
                    type="button"
                    onClick={actions.onPrevious}
                    aria-label="Previous paper"
                  >
                    ↑
                  </button>
                  <button
                    className={pagerButtonClass}
                    type="button"
                    onClick={actions.onNext}
                    aria-label="Next paper"
                  >
                    ↓
                  </button>
                </div>
              </div>
            </>
          )}
      </article>
    )
  },
)
