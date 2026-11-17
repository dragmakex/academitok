import { forwardRef } from "react"
import { NewsprintField } from "./NewsprintField"

/* Square ink stamp under the headline: outline at rest, inverted once pressed. */
const actionButtonClass =
  "flex h-11 w-11 items-center justify-center border border-rule-soft bg-paper text-ink cursor-pointer hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 aria-pressed:bg-ink aria-pressed:text-paper"

const pagerButtonClass =
  "flex min-h-12 w-12 items-center justify-center border-0 bg-transparent font-display text-[1.15rem] text-ink cursor-pointer hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-[-2px]"

const metaClass =
  "font-label text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink-muted"

type ActionHandlers = {
  readonly onLike: () => void
  readonly onBookmark: () => void
  readonly onShare: () => void
  readonly onOpenSite: () => void
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
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-[clamp(0.6rem,3vw,3.5rem)] py-[clamp(0.75rem,3vh,2.5rem)] text-ink focus-visible:outline-2 focus-visible:outline-offset-[-8px] focus-visible:outline-ink">
                {
                  /* m-auto, not justify-center: a centred flex child taller than
                    the sheet loses its first lines to the scroll box. */
                }
                <div className="m-auto w-full max-w-[min(94vw,clamp(54rem,42vw,84rem))] border-y-2 border-ink bg-paper px-[clamp(1.1rem,3.2vw,5rem)] py-[clamp(1.5rem,4.5vh,4rem)]">
                  <a
                    className="block text-ink no-underline"
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={actions.onOpenSite}
                    aria-label="Open paper source in a new tab"
                  >
                    <p className="m-0 font-label text-[clamp(0.7rem,0.85vmin,0.95rem)] font-bold uppercase tracking-[0.2em]">
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
                      className="mt-s max-w-[24ch] overflow-wrap-anywhere m-0 text-balance font-display text-[clamp(1.9rem,min(4.2vw,5.8vh),4.1rem)] font-bold leading-[1] tracking-[-0.03em]"
                    >
                      {title}
                    </h2>

                    <p className="mt-m m-0 hyphens-auto text-left font-body text-[clamp(1.02rem,min(1.6vw,2.4vh),1.6rem)] leading-[1.48] md:columns-2 md:gap-[2rem] md:text-justify md:[text-align-last:left]">
                      {abstract}
                    </p>

                    <p className="mt-l m-0 font-label text-[clamp(0.66rem,0.8vmin,0.9rem)] font-bold uppercase tracking-[0.18em] text-ink-muted">
                      Read the paper →
                    </p>
                  </a>

                  <div
                    role="group"
                    aria-label="Paper actions"
                    className="mt-l flex items-center gap-s"
                  >
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
                </div>
              </div>

              <div className="relative flex shrink-0 items-center justify-center border-t-4 border-ink bg-paper pt-xs pb-[max(0.7rem,env(safe-area-inset-bottom))] before:absolute before:inset-x-0 before:top-[6px] before:h-px before:bg-ink/40">
                {/* The foot band mirrors the nameplate: full-bleed stock, hairlines, one centred control. */}
                <NewsprintField variant="band" />
                <div className="relative flex items-stretch">
                  <button
                    className={pagerButtonClass}
                    type="button"
                    onClick={actions.onPrevious}
                    aria-label="Previous paper"
                  >
                    ↑
                  </button>
                  <span
                    aria-hidden="true"
                    className="w-px self-stretch bg-ink/30"
                  />
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
