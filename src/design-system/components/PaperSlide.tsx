import { Masthead } from "@/design-system/components/Masthead"
import { forwardRef } from "react"

/* Print idiom for one broadsheet row: caps, hairline rules, no chrome. */
const barButtonClass =
  "flex min-h-11 items-center justify-center border-0 border-l border-rule-soft bg-transparent px-s font-label text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink cursor-pointer hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-[-2px] aria-pressed:bg-ink aria-pressed:text-paper"

const pagerButtonClass =
  "flex min-h-11 w-11 items-center justify-center border-0 bg-transparent font-display text-[1rem] text-ink cursor-pointer hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-[-2px]"

const metaClass =
  "font-label text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink-muted"

/**
 * Splits an abstract into a printable deck and body: the first sentence, when
 * it is a reasonable length, is set as the bold deck under the headline.
 *
 * @param abstract - Paper abstract as served.
 * @returns The deck sentence and the remaining body copy.
 */
export function splitDeck(abstract: string): {
  readonly deck: string
  readonly body: string
} {
  const end = abstract.search(/[.!?](\s|$)/)
  if (end < 40 || end > 130 || abstract.length - end < 120) {
    return { body: abstract, deck: "" }
  }
  return {
    body: abstract.slice(end + 1).trim(),
    deck: abstract.slice(0, end + 1),
  }
}

type ActionHandlers = {
  readonly onLike: () => void
  readonly onBookmark: () => void
  readonly onHide: () => void
  readonly onOpenSite: () => void
  readonly onPrevious: () => void
  readonly onNext: () => void
}

type PaperMeta = {
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
  readonly topics: ReadonlyArray<string>
  readonly externalUrl: string | undefined
}

/** One headline from the rest of the edition, printed below the fold. */
export type DeckTeaser = {
  readonly position: number
  readonly topic: string
  readonly title: string
  readonly venue: string
  readonly year: number
  readonly summary: string
}

type DeckPaperSlideProps = PaperMeta & {
  readonly variant?: "deck" | undefined
  readonly teasers?: ReadonlyArray<DeckTeaser> | undefined
  readonly onJump?: ((position: number) => void) | undefined
  readonly origin: "pool" | "live" | "seed"
  readonly pinned: boolean
  readonly alsoKeptBy?: number | undefined
  readonly alsoLikedBy?: number | undefined
  readonly again: boolean
  readonly rationale: ReadonlyArray<string>
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
      accessLabel,
      actions,
      again,
      alsoKeptBy,
      teasers,
      onJump,
      alsoLikedBy,
      authors,
      bookmarked,
      externalUrl,
      id,
      liked,
      position,
      rationale,
      readMinutes,
      origin,
      pinned,
      siteLabel,
      skeleton,
      title,
      topics,
      total,
      venue,
      year,
      citations,
    } = props

    const folio = String(position).padStart(3, "0")
    const { body, deck } = splitDeck(abstract)

    return (
      <article
        ref={ref}
        aria-labelledby={headlineId}
        className="flex h-[100dvh] min-h-[100dvh] snap-start snap-always flex-col overflow-hidden bg-paper text-ink"
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
              <Masthead
                left={`${
                  origin === "seed" ? "Offline edition" : "Evening edition"
                } · No. ${folio}`}
                right={`${position} of ${total} · Metadata only`}
                section="The reading edition"
                trailing={pinned
                  ? (
                    <a
                      className="font-label text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink underline underline-offset-4 hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-ink"
                      href="/"
                    >
                      Your edition
                    </a>
                  )
                  : "Metadata only"}
              />

              <div className="flex min-h-0 flex-1 flex-col gap-y-s px-[clamp(1rem,4vw,2.5rem)] py-s">
                <div className="mx-auto grid w-full max-w-[76rem] grid-cols-1 gap-x-m gap-y-s md:grid-cols-[minmax(0,1fr)_9rem] lg:grid-cols-[minmax(0,5fr)_minmax(0,1.2fr)_minmax(0,3fr)] md:justify-between">
                  <div className="flex min-w-0 flex-col">
                    <p className="m-0 border-y border-rule-soft py-2xs font-label text-[0.66rem] font-bold uppercase tracking-[0.22em] text-ink">
                      {topics[0] ?? "Research"}
                      {again ? " · Again" : null}
                    </p>

                    <h2
                      id={headlineId}
                      className="mt-s line-clamp-3 max-w-[26ch] overflow-wrap-anywhere m-0 text-balance font-display text-[clamp(1.7rem,3.8vw,2.6rem)] leading-[1.02] font-bold tracking-[-0.03em]"
                    >
                      {title}
                    </h2>

                    {deck === ""
                      ? null
                      : (
                        <p className="mt-s line-clamp-3 m-0 max-w-[46ch] font-body text-[clamp(1.05rem,2.4vw,1.3rem)] leading-[1.3]">
                          {deck}
                        </p>
                      )}

                    <p className="mt-s m-0 font-body text-[0.8rem]">
                      <span className="font-label text-[0.62rem] font-bold uppercase tracking-[0.14em]">
                        By
                      </span>{" "}
                      {authors.toUpperCase()}
                    </p>

                    <div className="mt-xs h-px w-16 bg-ink" />

                    <p className="mt-s m-0 max-w-[64ch] hyphens-auto text-left font-body text-[clamp(1rem,1.5vw,1.08rem)] leading-[1.55] md:columns-2 md:gap-x-m md:[column-rule:1px_solid_var(--color-rule-soft)]">
                      {body}
                    </p>

                    <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-m gap-y-2xs border-t border-ink pt-2xs">
                      <p className={`m-0 ${metaClass}`}>
                        Filed under {topics.join(" · ")}
                      </p>
                      <p className={`m-0 ${metaClass}`}>
                        {`${siteLabel} · ${citations} citations`}
                      </p>
                    </div>
                  </div>

                  <aside className="flex flex-col border-t border-rule-soft pt-2xs sm:border-t-0 sm:border-l sm:pl-s">
                    <p className="m-0 font-label text-[0.62rem] font-bold uppercase tracking-[0.18em] text-ink">
                      The record
                    </p>
                    <dl className="mt-2xs m-0 flex flex-1 flex-col text-[0.8rem] leading-[1.3]">
                      {[
                        ["Venue", venue],
                        ["Year", String(year)],
                        ["Citations", String(citations)],
                        ["Abstract", `${readMinutes} min`],
                        ["Access", accessLabel],
                        ["Source", siteLabel],
                      ]
                        .map(([label, value]) => (
                          <div
                            key={label}
                            className="flex flex-1 items-baseline justify-between gap-xs border-b border-rule-soft py-2xs"
                          >
                            <dt className={metaClass}>
                              {label}
                            </dt>
                            <dd className="m-0 text-right font-body">
                              {value}
                            </dd>
                          </div>
                        ))}
                    </dl>

                    <p className="mt-s m-0 font-label text-[0.62rem] font-bold uppercase tracking-[0.18em] text-ink">
                      Why this
                    </p>
                    <p className="mt-2xs m-0 font-body text-[0.82rem] italic leading-[1.3] text-ink-muted">
                      {rationale.join(" · ")}
                    </p>

                    {alsoKeptBy === undefined || alsoKeptBy === 0
                      ? null
                      : (
                        <p className={`mt-s m-0 ${metaClass}`}>
                          {`Also kept by ${alsoKeptBy} ${
                            alsoKeptBy === 1 ? "reader" : "readers"
                          }`}
                        </p>
                      )}
                    {alsoLikedBy === undefined || alsoLikedBy === 0
                      ? null
                      : (
                        <p className={`mt-2xs m-0 ${metaClass}`}>
                          {`Also liked by ${alsoLikedBy} ${
                            alsoLikedBy === 1 ? "reader" : "readers"
                          }`}
                        </p>
                      )}
                  </aside>

                  {teasers === undefined || teasers.length === 0
                    ? null
                    : (
                      <div className="hidden min-h-0 flex-col border-t border-rule-soft pt-2xs md:flex md:border-t-0 md:border-l md:pl-s">
                        <p className="m-0 border-b border-rule-soft pb-2xs font-label text-[0.62rem] font-bold uppercase tracking-[0.18em] text-ink">
                          Also in this edition
                        </p>
                        <div className="flex min-h-0 flex-1 flex-col">
                          {teasers.map((teaser) => (
                            <button
                              key={teaser.position}
                              type="button"
                              onClick={() => onJump?.(teaser.position)}
                              aria-label={`Go to ${teaser.title}`}
                              className="flex flex-1 flex-col justify-start border-0 border-b border-rule-soft bg-transparent px-0 py-2xs text-left last:border-b-0 cursor-pointer hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-[-2px]"
                            >
                              <span className="block font-label text-[0.58rem] font-bold uppercase tracking-[0.18em]">
                                {teaser.topic} · p. {teaser.position}
                              </span>
                              <span className="mt-2xs line-clamp-2 font-display text-[clamp(1rem,1.35vw,1.15rem)] font-bold leading-[1.1] tracking-[-0.02em]">
                                {teaser.title}
                              </span>
                              <span className="mt-2xs line-clamp-1 font-body text-[0.8rem] leading-[1.3] text-ink">
                                {teaser.summary}
                              </span>
                              <span className="mt-2xs font-body text-[0.72rem] italic text-ink-muted">
                                {teaser.venue} · {teaser.year}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                </div>

                <p className="mx-auto mt-auto w-full max-w-[76rem] border-t border-rule-soft pt-2xs text-center font-label text-[0.58rem] font-bold uppercase tracking-[0.18em] text-ink-muted">
                  Set in Times and Chomsky · Metadata and open-access links only
                  · No PDFs are stored
                </p>
              </div>

              <div className="border-t border-rule-soft">
                <div
                  role="group"
                  aria-label="Paper actions"
                  className="mx-auto flex w-full max-w-[76rem] items-stretch justify-between px-[clamp(1rem,4vw,2.5rem)] pb-[env(safe-area-inset-bottom)]"
                >
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
                      className={`${pagerButtonClass} border-r border-rule-soft`}
                      type="button"
                      onClick={actions.onNext}
                      aria-label="Next paper"
                    >
                      ↓
                    </button>
                  </div>
                  <div className="flex items-stretch">
                    {externalUrl === undefined
                      ? null
                      : (
                        <a
                          className={barButtonClass}
                          href={externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={actions.onOpenSite}
                          aria-label="Open paper source in a new tab"
                        >
                          Source
                        </a>
                      )}
                    <a
                      className={barButtonClass}
                      href={`/paper/${encodeURIComponent(id)}`}
                      aria-label="Open the permalink page for this paper"
                    >
                      Permalink
                    </a>
                    <button
                      className={barButtonClass}
                      type="button"
                      onClick={actions.onHide}
                      aria-label="Hide paper"
                    >
                      Hide
                    </button>
                    <button
                      className={barButtonClass}
                      type="button"
                      onClick={actions.onBookmark}
                      aria-label={bookmarked
                        ? "Remove saved paper"
                        : "Save paper"}
                      aria-pressed={bookmarked}
                    >
                      Save
                    </button>
                    <button
                      className={barButtonClass}
                      type="button"
                      onClick={actions.onLike}
                      aria-label={liked ? "Unlike paper" : "Like paper"}
                      aria-pressed={liked}
                    >
                      Like
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
      </article>
    )
  },
)
